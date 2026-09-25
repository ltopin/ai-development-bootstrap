'use strict';
// Run with: node --test ai-development/integrations/github/scripts/agent-gate.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const gate = require('./agent-gate.js');

const BOT = 'github-actions[bot]';
const trust = gate.parseTrustConfig({});
const header = (o = {}) => `<!-- agent-question\nid: ${o.id || 'Q1'}\ntype: ${o.type || 'HUMAN_DECISION'}\nstatus: ${o.status || 'OPEN'}\n${o.options === null ? '' : `options: ${o.options || 'A,B,other'}\n`}decision-key: payments.gateway\nchange: add-payment-method\n-->\n\n## Decision required\n`;
const qc = (id, body, login = BOT) => ({ id, body, user: { login, type: 'Bot' } });
const human = (body, o = {}) => ({ id: 900, body, user: { login: o.login || 'alice', type: o.type || 'User' }, author_association: o.assoc || 'COLLABORATOR' });
const run = (comment, comments) => gate.decide({ comment, comments, botLogin: BOT, trust });

test('parseQuestion accepts a valid header and rejects malformed ones', () => {
  const q = gate.parseQuestion(header());
  assert.deepEqual(q, { id: 'Q1', type: 'HUMAN_DECISION', status: 'OPEN', options: ['A', 'B', 'other'], decisionKey: 'payments.gateway', change: 'add-payment-method' });
  assert.equal(gate.parseQuestion('no header'), null);
  assert.equal(gate.parseQuestion('text first\n' + header()), null, 'header must start the comment');
  assert.equal(gate.parseQuestion(header({ status: 'MAYBE' })), null);
  assert.equal(gate.parseQuestion(header({ type: 'OTHER' })), null);
  assert.equal(gate.parseQuestion(header({ options: null })), null, 'decision needs options');
  assert.equal(gate.parseQuestion(header({ options: 'A,A' })), null, 'duplicate options');
  assert.equal(gate.parseQuestion(header({ options: 'A;rm -rf' })), null);
  assert.equal(gate.parseQuestion(header({ id: 'Q 1' })), null);
  assert.equal(gate.parseQuestion('<!-- agent-question\nid: Q1\nid: Q2\ntype: HUMAN_DECISION\nstatus: OPEN\noptions: A\n-->'), null, 'duplicate field');
});

test('HUMAN_SECRET only accepts "configured"', () => {
  assert.deepEqual(gate.parseQuestion(header({ type: 'HUMAN_SECRET', options: null })).options, ['configured']);
  assert.equal(gate.parseQuestion(header({ type: 'HUMAN_SECRET', options: 'value' })), null);
});

// --- interruption rule: handoff declares what is done and what was NOT started ---

const DECISION_HANDOFF = [
  '### Handoff',
  '- Classification / impact set: D',
  '- Completed independent work: order state model committed on agent/x (tests pass)',
  '- Not started (depends on this decision): provider integration, checkout call',
  '- If A / If B: next steps',
  '',
].join('\n');
const SECRET_HANDOFF = [
  '### Handoff',
  '- Completed work: client reads PAYMENTS_API_KEY from the environment; mocked tests pass',
  '- Blocked step (needs the secret): live call to the provider; not validated',
  '',
].join('\n');

test('HUMAN_DECISION handoff must declare completed independent work and what was not started', () => {
  const ok = (h) => gate.validateHandoff(header() + h, 'HUMAN_DECISION');
  assert.equal(ok(DECISION_HANDOFF), null);
  assert.equal(ok(DECISION_HANDOFF.replace('order state model committed on agent/x (tests pass)', 'none')), null, '"none" is a valid answer when nothing is independent');
  assert.match(gate.validateHandoff(header() + 'no handoff here', 'HUMAN_DECISION'), /no "### Handoff"/);
  assert.match(ok(DECISION_HANDOFF.replace(/- Not started.*\n/, '')), /Not started/, 'must say what was left unstarted');
  assert.match(ok(DECISION_HANDOFF.replace(/- Completed independent work:.*\n/, '')), /Completed independent work/);
  assert.match(ok(DECISION_HANDOFF.replace(/(- Not started \(depends on this decision\):).*/, '$1')), /Not started/, 'an empty line does not count');
  assert.match(gate.validateHandoff(header() + SECRET_HANDOFF, 'HUMAN_DECISION'), /Completed independent work/, 'secret-style handoff is not enough for a decision');
});

test('HUMAN_SECRET handoff must declare completed work and the blocked step', () => {
  const ok = (h) => gate.validateHandoff(header({ type: 'HUMAN_SECRET', options: null }) + h, 'HUMAN_SECRET');
  assert.equal(ok(SECRET_HANDOFF), null);
  assert.match(ok(SECRET_HANDOFF.replace(/- Blocked step.*\n/, '')), /Blocked step/);
  assert.match(ok(SECRET_HANDOFF.replace(/- Completed work:.*\n/, '')), /Completed work/);
});

test('handoff lines only count inside the Handoff section', () => {
  const misplaced = header() + '### Handoff\n- Classification: D\n\n## Notes\n- Completed independent work: x\n- Not started (depends on this decision): y\n';
  assert.match(gate.validateHandoff(misplaced, 'HUMAN_DECISION'), /Completed independent work/);
});

test('parseCommand uses a strict grammar on the first line only', () => {
  assert.deepEqual(gate.parseCommand('/agent answer Q1 A'), { id: 'Q1', option: 'A', note: '' });
  assert.deepEqual(gate.parseCommand('/agent answer Q1 other use provider Z\nsecond line'), { id: 'Q1', option: 'other', note: 'use provider Z' });
  assert.equal(gate.parseCommand('please /agent answer Q1 A'), null);
  assert.equal(gate.parseCommand('\n/agent answer Q1 A'), null, 'must be the first line');
  assert.equal(gate.parseCommand('/agent answer Q1 A;id'), null);
  assert.equal(gate.parseCommand('/agent answer Q1'), null);
  assert.equal(gate.parseCommand('/agent answer $(id) A'), null);
  assert.equal(gate.parseCommand('/agent answer Q1 A ' + 'x'.repeat(600)), null, 'note length bound');
});

test('trusted actors: association or allowlist; never bots', () => {
  const t = (o, cfg = trust) => gate.isTrustedActor(o, cfg);
  assert.ok(t({ login: 'a', type: 'User', association: 'OWNER' }));
  assert.ok(t({ login: 'a', type: 'User', association: 'MEMBER' }));
  assert.ok(t({ login: 'a', type: 'User', association: 'COLLABORATOR' }));
  assert.ok(!t({ login: 'a', type: 'User', association: 'CONTRIBUTOR' }));
  assert.ok(!t({ login: 'a', type: 'User', association: 'NONE' }));
  assert.ok(!t({ login: 'a', type: 'Bot', association: 'OWNER' }));
  const allow = gate.parseTrustConfig({ AGENT_TRUSTED_ACTORS: 'Carol, dave' });
  assert.ok(t({ login: 'carol', type: 'User', association: 'CONTRIBUTOR' }, allow));
  assert.ok(!t({ login: 'carol', type: 'Bot', association: 'CONTRIBUTOR' }, allow));
  const strict = gate.parseTrustConfig({ AGENT_TRUSTED_ASSOCIATIONS: 'NONE', AGENT_TRUSTED_ACTORS: 'carol' });
  assert.ok(!t({ login: 'a', type: 'User', association: 'OWNER' }, strict));
  assert.ok(t({ login: 'carol', type: 'User', association: 'NONE' }, strict));
});

test('a trusted answer to an OPEN question resumes', () => {
  const d = run(human('/agent answer Q1 A'), [qc(1, header())]);
  assert.equal(d.action, 'answer');
  assert.equal(d.option, 'A');
  assert.equal(d.questionCommentId, 1);
  assert.equal(d.resume, true);
  assert.equal(d.question.decisionKey, 'payments.gateway');
});

test('untrusted, bot and self answers are ignored silently', () => {
  const qs = [qc(1, header())];
  assert.equal(run(human('/agent answer Q1 A', { assoc: 'NONE' }), qs).reason, 'untrusted');
  assert.equal(run(human('/agent answer Q1 A', { assoc: 'CONTRIBUTOR' }), qs).reason, 'untrusted');
  assert.equal(run(human('/agent answer Q1 A', { type: 'Bot' }), qs).reason, 'bot');
  assert.equal(run(human('/agent answer Q1 A', { login: BOT }), qs).reason, 'bot');
  assert.equal(run(human('/agent answer Q1 A', { assoc: 'NONE' }), qs).hint, null);
});

test('a look-alike question posted by a human is not a question', () => {
  const forged = qc(2, header(), 'mallory');
  assert.equal(run(human('/agent answer Q1 A'), [forged]).reason, 'unknown-question');
});

test('duplicate answers are rejected once the question is ANSWERED', () => {
  const answered = gate.markAnswered(header(), { by: 'alice', option: 'A', commentId: 900 });
  const q = gate.parseQuestion(answered);
  assert.equal(q.status, 'ANSWERED');
  assert.equal(run(human('/agent answer Q1 B'), [qc(1, answered)]).reason, 'already-answered');
});

test('invalid option, unknown id and ambiguous id are refused with a fixed hint', () => {
  assert.equal(run(human('/agent answer Q1 Z'), [qc(1, header())]).hint, 'invalid-option');
  assert.equal(run(human('/agent answer Q9 A'), [qc(1, header())]).hint, 'unknown-question');
  assert.equal(run(human('/agent answer Q1 A'), [qc(1, header()), qc(2, header())]).hint, 'ambiguous-question');
});

test('resume waits until every OPEN question is answered', () => {
  const qs = [qc(1, header({ id: 'Q1' })), qc(2, header({ id: 'Q2' }))];
  const d = run(human('/agent answer Q1 A'), qs);
  assert.equal(d.action, 'answer');
  assert.equal(d.remainingOpen, 1);
  assert.equal(d.resume, false);
});

test('markAnswered keeps a valid header and preserves the visible body', () => {
  const out = gate.markAnswered(header() + 'Body text', { by: 'alice', option: 'B', commentId: 900 });
  const q = gate.parseQuestion(out);
  assert.equal(q.status, 'ANSWERED');
  assert.equal(q.id, 'Q1');
  assert.match(out, /answered-by: alice/);
  assert.match(out, /Body text/);
  assert.doesNotMatch(out, /status: OPEN/);
});

// --- orchestration with a mocked GitHub client ------------------------------

function mock({ pr, comments, fresh }) {
  const calls = { created: [], updated: [], added: [], removed: [] };
  const github = {
    paginate: async () => comments,
    rest: {
      pulls: { get: async () => ({ data: pr }) },
      issues: {
        listComments: () => {},
        getComment: async ({ comment_id }) => ({ data: fresh || comments.find((c) => c.id === comment_id) }),
        updateComment: async (a) => calls.updated.push(a),
        createComment: async (a) => calls.created.push(a),
        addLabels: async (a) => calls.added.push(a.labels[0]),
        removeLabel: async (a) => calls.removed.push(a.name),
      },
    },
  };
  return { github, calls };
}
const ctx = (comment) => ({ repo: { owner: 'o', repo: 'r' }, payload: { issue: { number: 7, pull_request: {} }, comment }, serverUrl: 'https://github.com', runId: 1 });
const sink = () => { const o = {}; return { o, core: { setOutput: (k, v) => { o[k] = v; }, info() {}, setFailed: (m) => { o.failed = m; } }, fs: { writeFileSync() {}, readFileSync() { throw new Error('nf'); } } }; };
const sameRepoPr = { state: 'open', head: { ref: 'agent/x', repo: { full_name: 'o/r' } } };

test('resume(): claims the question, swaps labels, outputs sanitized values', async () => {
  const { github, calls } = mock({ pr: sameRepoPr, comments: [qc(1, header())] });
  const { o, core, fs } = sink();
  await gate.resume({ github, context: ctx(human('/agent answer Q1 A')), core, fs, env: { AGENT_BOT_LOGIN: BOT, RUNNER_TEMP: '/tmp' } });
  assert.equal(o.resume, 'true');
  assert.equal(o.option, 'A');
  assert.equal(o.question_id, 'Q1');
  assert.equal(o.head_ref, 'agent/x');
  assert.equal(calls.updated.length, 1);
  assert.match(calls.updated[0].body, /status: ANSWERED/);
  assert.deepEqual(calls.added, ['agent:running']);
  assert.ok(calls.removed.includes('agent:waiting-human'));
});

test('resume(): never resumes fork PRs or closed PRs', async () => {
  for (const pr of [{ state: 'open', head: { ref: 'x', repo: { full_name: 'evil/r' } } }, { state: 'open', head: { ref: 'x', repo: null } }, { state: 'closed', head: { ref: 'x', repo: { full_name: 'o/r' } } }]) {
    const { github, calls } = mock({ pr, comments: [qc(1, header())] });
    const { o, core, fs } = sink();
    await gate.resume({ github, context: ctx(human('/agent answer Q1 A')), core, fs, env: { AGENT_BOT_LOGIN: BOT } });
    assert.equal(o.resume, 'false');
    assert.equal(calls.updated.length, 0);
  }
});

test('resume(): fails closed without AGENT_BOT_LOGIN', async () => {
  const { github, calls } = mock({ pr: sameRepoPr, comments: [qc(1, header())] });
  const { o, core, fs } = sink();
  await gate.resume({ github, context: ctx(human('/agent answer Q1 A')), core, fs, env: {} });
  assert.equal(o.resume, 'false');
  assert.equal(calls.updated.length, 0);
});

test('resume(): the question is claimed only if still OPEN at claim time', async () => {
  const stale = qc(1, gate.markAnswered(header(), { by: 'bob', option: 'B', commentId: 5 }));
  const { github, calls } = mock({ pr: sameRepoPr, comments: [qc(1, header())], fresh: stale });
  const { o, core, fs } = sink();
  await gate.resume({ github, context: ctx(human('/agent answer Q1 A')), core, fs, env: { AGENT_BOT_LOGIN: BOT } });
  assert.equal(o.resume, 'false');
  assert.equal(calls.updated.length, 0);
});

test('resume(): comments on issues (not PRs) are ignored', async () => {
  const { github } = mock({ pr: sameRepoPr, comments: [] });
  const { o, core, fs } = sink();
  const c = ctx(human('/agent answer Q1 A'));
  c.payload.issue = { number: 7 };
  await gate.resume({ github, context: c, core, fs, env: { AGENT_BOT_LOGIN: BOT } });
  assert.equal(o.resume, 'false');
});

test('publish(): posts a valid question and sets waiting-human; rejects bad input', async () => {
  const path = require('node:path');
  const files = { [path.resolve('/tmp/q.md')]: header() + DECISION_HANDOFF,[path.resolve('/tmp/agent-result.json')]: JSON.stringify({ status: 'WAITING_FOR_HUMAN', question_file: 'q.md' }) };
  const fs = { readFileSync: (p) => { if (!(path.resolve(p) in files)) throw new Error('nf'); return files[path.resolve(p)]; } };
  const env = { AGENT_PR_NUMBER: '7', AGENT_BOT_LOGIN: BOT, RUNNER_TEMP: '/tmp' };
  const { github, calls } = mock({ pr: sameRepoPr, comments: [] });
  const { o, core } = sink();
  await gate.publish({ github, context: ctx({}), core, fs, env });
  assert.equal(calls.created.length, 1);
  assert.deepEqual(calls.added, ['agent:waiting-human']);

  files[path.resolve('/tmp/agent-result.json')] = JSON.stringify({ status: 'WAITING_FOR_HUMAN', question_file: '../etc/passwd' });
  await assert.rejects(() => gate.publish({ github: mock({ pr: sameRepoPr, comments: [] }).github, context: ctx({}), core, fs, env }), /inside RUNNER_TEMP/);

  files[path.resolve('/tmp/agent-result.json')] = JSON.stringify({ status: 'WAITING_FOR_HUMAN', question_file: 'q.md' });
  const dup = mock({ pr: sameRepoPr, comments: [qc(1, header())] });
  await assert.rejects(() => gate.publish({ github: dup.github, context: ctx({}), core, fs, env }), /already used/);

  files[path.resolve('/tmp/q.md')] = 'not a question';
  await assert.rejects(() => gate.publish({ github: mock({ pr: sameRepoPr, comments: [] }).github, context: ctx({}), core, fs, env }), /valid OPEN/);

  // a decision question that does not say what was left unstarted is refused, not posted
  files[path.resolve('/tmp/q.md')] = header() + 'Decision needed, no handoff.';
  const noHandoff = mock({ pr: sameRepoPr, comments: [] });
  await assert.rejects(() => gate.publish({ github: noHandoff.github, context: ctx({}), core, fs, env }), /Handoff/);
  assert.equal(noHandoff.calls.created.length, 0);
  assert.deepEqual(noHandoff.calls.added, []);

  // a secret question with the secret-style handoff is accepted
  files[path.resolve('/tmp/q.md')] = header({ type: 'HUMAN_SECRET', options: null }) + SECRET_HANDOFF;
  const secret = mock({ pr: sameRepoPr, comments: [] });
  await gate.publish({ github: secret.github, context: ctx({}), core, fs, env });
  assert.equal(secret.calls.created.length, 1);
  assert.ok(o);
});

test('publish(): missing result is a failed run, not silent success', async () => {
  const { github, calls } = mock({ pr: sameRepoPr, comments: [] });
  const { o, core } = sink();
  const fs = { readFileSync() { throw new Error('nf'); } };
  await gate.publish({ github, context: ctx({}), core, fs, env: { AGENT_PR_NUMBER: '7', RUNNER_TEMP: '/tmp' } });
  assert.ok(o.failed);
  assert.equal(calls.created.length, 1);
  assert.deepEqual(calls.added, []);
});
