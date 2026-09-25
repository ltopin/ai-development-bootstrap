'use strict';
// Run with: node --test "ai-development/integrations/github/scripts/*.test.js"
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
  assert.deepEqual(q, {
    id: 'Q1', type: 'HUMAN_DECISION', status: 'OPEN', options: ['A', 'B', 'other'], decisionKey: 'payments.gateway', change: 'add-payment-method',
    reason: '', answerComment: '', answeredBy: '', answeredAt: '', window: '', lastRun: '',
  });
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
  const out = gate.markAnswered(header() + 'Body text', { by: 'alice', option: 'B', commentId: 900, at: '2026-09-25T10:00:00Z' });
  const q = gate.parseQuestion(out);
  assert.equal(q.status, 'ANSWERED');
  assert.equal(q.id, 'Q1');
  assert.deepEqual([q.answeredBy, q.answerComment, q.answeredAt], ['alice', '900', '2026-09-25T10:00:00Z']);
  assert.match(out, /Body text/);
  assert.doesNotMatch(out, /status: OPEN/);
});

test('markAnswered leaves out unknown fields instead of inventing them (repair after a deleted answer)', () => {
  const q = gate.parseQuestion(gate.markAnswered(header(), { commentId: 900 }));
  assert.deepEqual([q.status, q.answerComment, q.answeredBy, q.answeredAt], ['ANSWERED', '900', '', '']);
});

test('a claimed question (its resume record exists) is not open, whatever its header says', () => {
  const d = gate.decide({ comment: human('/agent answer Q1 B'), comments: [qc(1, header())], botLogin: BOT, trust, claimed: new Set(['Q1']) });
  assert.equal(d.reason, 'already-answered');
  const two = gate.decide({ comment: human('/agent answer Q2 A'), comments: [qc(1, header()), qc(2, header({ id: 'Q2' }))], botLogin: BOT, trust, claimed: new Set(['Q1']) });
  assert.equal(two.resume, true, 'a claimed question does not hold back the last open one');
});

test('parseRetryCommand uses a strict grammar on the first line only', () => {
  assert.deepEqual(gate.parseRetryCommand('/agent retry 123-1'), { runId: '123-1' });
  assert.deepEqual(gate.parseRetryCommand('/agent retry 123-1\nbecause the runner died'), { runId: '123-1' });
  assert.equal(gate.parseRetryCommand('/agent retry'), null);
  assert.equal(gate.parseRetryCommand('/agent retry 123-1 now'), null, 'no trailing arguments');
  assert.equal(gate.parseRetryCommand('/agent retry $(id)'), null);
  assert.equal(gate.parseRetryCommand('please /agent retry 123-1'), null);
  assert.equal(gate.parseRetryCommand('\n/agent retry 123-1'), null, 'must be the first line');
  assert.equal(gate.parseCommand('/agent retry 123-1'), null, 'a retry is not an answer');
});
