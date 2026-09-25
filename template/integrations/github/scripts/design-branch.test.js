'use strict';
// Run with: node --test "ai-development/integrations/github/scripts/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('./design-branch.js');

const config = db.parseDesignConfig({});
const SHA = 'a'.repeat(40);
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

/** A fake GitHub client that records every call. `status` is the comparison result of base...head. */
function fake({ openPulls = [], status = 'ahead', updateRef, merge, create, associated = [] } = {}) {
  const calls = [];
  const rec = (name, fn) => async (args) => { calls.push({ name, args }); return fn ? fn(args) : { data: {} }; };
  const github = {
    paginate: async (fn, args) => (await fn(args)).data,
    rest: {
      pulls: {
        list: rec('pulls.list', () => ({ data: openPulls })),
        create: rec('pulls.create', create),
      },
      repos: {
        compareCommitsWithBasehead: rec('repos.compare', () => ({ data: { status } })),
        merge: rec('repos.merge', merge || (() => ({ status: 201, data: {} }))),
        listPullRequestsAssociatedWithCommit: rec('repos.associated', () => ({ data: associated })),
      },
      git: { updateRef: rec('git.updateRef', updateRef) },
      issues: { createComment: rec('issues.createComment') },
    },
  };
  const outputs = {};
  const core = { info() {}, setOutput: (k, v) => { outputs[k] = v; }, setFailed: (m) => { outputs.failed = m; } };
  return { github, core, calls, outputs, names: () => calls.map((c) => c.name) };
}
const ctx = (ref, sha = SHA) => ({ repo: { owner: 'acme', repo: 'shop' }, ref, sha });
const WRITES = ['pulls.create', 'git.updateRef', 'repos.merge', 'issues.createComment'];

// --- configuration ---

test('parseDesignConfig defaults to studio -> main and rejects unsafe or equal branches', () => {
  assert.deepEqual(config, { source: 'studio', production: 'main', error: '' });
  assert.equal(db.parseDesignConfig({ DESIGN_SOURCE_BRANCH: 'design', PRODUCTION_BRANCH: 'release' }).error, '');
  assert.equal(db.parseDesignConfig({ DESIGN_SOURCE_BRANCH: 'a..b' }).error, 'invalid-branch');
  assert.equal(db.parseDesignConfig({ DESIGN_SOURCE_BRANCH: 'x;rm -rf /' }).error, 'invalid-branch');
  assert.equal(db.parseDesignConfig({ DESIGN_SOURCE_BRANCH: 'main' }).error, 'same-branch');
});

// --- promotion: a builder push leads to exactly one design pull request ---

test('decidePromotion: first push of a cycle opens the design pull request', () => {
  assert.deepEqual(db.decidePromotion({ config, openPulls: [], status: 'ahead' }), { action: db.PROMOTION.OPEN, reason: 'source-ahead' });
});

test('decidePromotion: a subsequent push while the pull request is open opens nothing', () => {
  assert.equal(db.decidePromotion({ config, openPulls: [{ number: 7 }], status: 'ahead' }).reason, 'pull-request-open');
});

test('decidePromotion: nothing to promote when not ahead of production', () => {
  for (const status of ['identical', 'behind']) {
    assert.deepEqual(db.decidePromotion({ config, openPulls: [], status }), { action: db.PROMOTION.NONE, reason: 'nothing-to-promote' });
  }
});

test('decidePromotion: waits for the back-sync while production is not contained', () => {
  assert.deepEqual(db.decidePromotion({ config, openPulls: [], status: 'diverged' }), { action: db.PROMOTION.NONE, reason: 'back-sync-pending' });
  assert.equal(db.decidePromotion({ config, openPulls: [], status: 'weird' }).action, db.PROMOTION.NONE);
  assert.equal(db.decidePromotion({ config: { error: 'same-branch' }, openPulls: [], status: 'ahead' }).reason, 'same-branch');
});

test('ensureDesignPr: first push opens one pull request studio -> main and writes nothing else', async () => {
  const f = fake({ status: 'ahead' });
  const r = await db.ensureDesignPr({ github: f.github, context: ctx('refs/heads/studio'), core: f.core, env: {} });
  assert.equal(r.action, db.PROMOTION.OPEN);
  const create = f.calls.find((c) => c.name === 'pulls.create');
  assert.equal(create.args.head, 'studio');
  assert.equal(create.args.base, 'main');
  assert.deepEqual(f.names().filter((n) => WRITES.includes(n)), ['pulls.create'], 'never pushes, merges or comments');
  const compare = f.calls.find((c) => c.name === 'repos.compare');
  assert.equal(compare.args.basehead, 'main...studio');
});

test('ensureDesignPr: subsequent push and nothing-to-promote open nothing', async () => {
  for (const o of [{ openPulls: [{ number: 7 }], status: 'ahead' }, { status: 'identical' }, { status: 'diverged' }]) {
    const f = fake(o);
    await db.ensureDesignPr({ github: f.github, context: ctx('refs/heads/studio'), core: f.core, env: {} });
    assert.deepEqual(f.names().filter((n) => WRITES.includes(n)), []);
  }
});

test('ensureDesignPr: a concurrent run that already opened the pull request is not an error', async () => {
  const f = fake({ status: 'ahead', create: () => { throw httpError(422); } });
  const r = await db.ensureDesignPr({ github: f.github, context: ctx('refs/heads/studio'), core: f.core, env: {} });
  assert.deepEqual(r, { action: db.PROMOTION.NONE, reason: 'pull-request-open' });
});

test('ensureDesignPr: ignores pushes to any other branch', async () => {
  const f = fake({ status: 'ahead' });
  const r = await db.ensureDesignPr({ github: f.github, context: ctx('refs/heads/main'), core: f.core, env: {} });
  assert.equal(r.reason, 'not-design-source-branch');
  assert.deepEqual(f.calls, []);
});

// --- back-sync after merge ---

test('decideBackSync: fast-forward, merge or nothing', () => {
  assert.equal(db.decideBackSync({ config, status: 'behind' }).action, db.BACK_SYNC.FAST_FORWARD);
  assert.equal(db.decideBackSync({ config, status: 'diverged' }).action, db.BACK_SYNC.MERGE);
  assert.equal(db.decideBackSync({ config, status: 'identical' }).action, db.BACK_SYNC.NONE);
  assert.equal(db.decideBackSync({ config, status: 'ahead' }).action, db.BACK_SYNC.NONE);
  assert.equal(db.decideBackSync({ config, status: 'weird' }).action, db.BACK_SYNC.NONE);
});

test('backSync: clean back-sync fast-forwards the design source branch, never by force', async () => {
  const f = fake({ status: 'behind' });
  const r = await db.backSync({ github: f.github, context: ctx('refs/heads/main'), core: f.core, env: {} });
  assert.equal(r.action, db.BACK_SYNC.FAST_FORWARD);
  const u = f.calls.find((c) => c.name === 'git.updateRef');
  assert.deepEqual(u.args, { owner: 'acme', repo: 'shop', ref: 'heads/studio', sha: SHA, force: false });
  assert.deepEqual(f.names().filter((n) => WRITES.includes(n)), ['git.updateRef'], 'production untouched, no pull request');
  assert.equal(f.calls.find((c) => c.name === 'repos.compare').args.basehead, `${SHA}...studio`);
});

test('backSync: builder commits after merge are kept by merging production into the design source branch', async () => {
  const f = fake({ status: 'diverged' });
  const r = await db.backSync({ github: f.github, context: ctx('refs/heads/main'), core: f.core, env: {} });
  assert.equal(r.action, db.BACK_SYNC.MERGE);
  const m = f.calls.find((c) => c.name === 'repos.merge');
  assert.equal(m.args.base, 'studio', 'the merge commit lands on the design source branch');
  assert.equal(m.args.head, SHA);
  assert.deepEqual(f.names().filter((n) => WRITES.includes(n)), ['repos.merge']);
});

test('backSync: a builder push racing the fast-forward falls back to a merge', async () => {
  const f = fake({ status: 'behind', updateRef: () => { throw httpError(422); } });
  const r = await db.backSync({ github: f.github, context: ctx('refs/heads/main'), core: f.core, env: {} });
  assert.equal(r.action, db.BACK_SYNC.MERGE);
  assert.deepEqual(f.names().filter((n) => WRITES.includes(n)), ['git.updateRef', 'repos.merge']);
});

test('backSync: conflict pushes nothing and reports on the merged pull request', async () => {
  const f = fake({
    status: 'diverged',
    merge: () => { throw httpError(409); },
    associated: [{ number: 3, merged_at: null, base: { ref: 'main' } }, { number: 12, merged_at: '2026-09-25T10:00:00Z', base: { ref: 'main' } }],
  });
  const r = await db.backSync({ github: f.github, context: ctx('refs/heads/main'), core: f.core, env: {} });
  assert.deepEqual(r, { action: db.BACK_SYNC.NONE, reason: 'conflict' });
  const c = f.calls.find((x) => x.name === 'issues.createComment');
  assert.equal(c.args.issue_number, 12);
  assert.ok(c.args.body.startsWith(db.REPORT_MARKER));
  assert.ok(!f.names().includes('git.updateRef') && !f.names().includes('pulls.create'));
  assert.match(f.outputs.failed, /conflict/);
});

test('backSync: nothing to do when the design source branch already contains production', async () => {
  const f = fake({ status: 'identical' });
  assert.equal((await db.backSync({ github: f.github, context: ctx('refs/heads/main'), core: f.core, env: {} })).reason, 'in-sync');
  const g = fake({ status: 'diverged', merge: () => ({ status: 204 }) });
  assert.equal((await db.backSync({ github: g.github, context: ctx('refs/heads/main'), core: g.core, env: {} })).reason, 'in-sync');
});

test('backSync: ignores other branches and invalid events', async () => {
  const f = fake({ status: 'behind' });
  assert.equal((await db.backSync({ github: f.github, context: ctx('refs/heads/studio'), core: f.core, env: {} })).reason, 'not-production-branch');
  assert.equal((await db.backSync({ github: f.github, context: ctx('refs/heads/main', 'nope'), core: f.core, env: {} })).reason, 'invalid-event');
  assert.deepEqual(f.calls, []);
});

// --- the round trip: the back-sync push does not start work ---

test('the back-sync push leaves nothing to promote, so no pull request and no agent run', async () => {
  // After a fast-forward, studio == main: the push event on studio compares as identical.
  const f = fake({ status: 'identical' });
  const r = await db.ensureDesignPr({ github: f.github, context: ctx('refs/heads/studio'), core: f.core, env: {} });
  assert.deepEqual(r, { action: db.PROMOTION.NONE, reason: 'nothing-to-promote' });
  assert.ok(!f.names().includes('pulls.create'));
});

test('builder commits after merge: the back-sync merge push opens the next design pull request once', async () => {
  // studio had builder commits and now contains main (merge commit): strictly ahead, no pull request open.
  const f = fake({ status: 'ahead' });
  assert.equal((await db.ensureDesignPr({ github: f.github, context: ctx('refs/heads/studio'), core: f.core, env: {} })).action, db.PROMOTION.OPEN);
});
