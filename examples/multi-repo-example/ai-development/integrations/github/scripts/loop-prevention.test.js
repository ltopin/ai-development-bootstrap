'use strict';
// Loop prevention (protocol/LOOP-PREVENTION.md): provenance, produced, idempotency, recovery, retry, circuit breaker.
// Run with: node --test "ai-development/integrations/github/scripts/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const gate = require('./agent-gate.js');

const BOT = 'github-actions[bot]';
const APP = 'my-agent-app[bot]';
const { DECISION } = gate;
const trust = gate.parseTrustConfig({});
const config = gate.parseGateConfig({ AGENT_PUSH_ACTOR: APP });

const sha = (n) => n.toString(16).padStart(40, '0');
const ABC = sha(0xabc); // external change (human, Stitch, local Claude/Codex ...)
const DEF = sha(0xdef); // commit produced by the automated run
const GHI = sha(0x123); // a later external change
const trailerBlock = ({ run, source, change = 'PR-42' }) => `Agent-Generated: true\nAgent-Run: ${run}\nAgent-Change: ${change}\nSource-SHA: ${source}`;
const external = (s, message = 'feat: change something') => ({ sha: s, message });
const internal = (s, run, source, change = 'PR-42') => ({ sha: s, message: `fix: agent work\n\nbody\n\n${trailerBlock({ run, source, change })}` });

const record = (o = {}) => ({
  changeId: 'PR-42', sourceSha: ABC, headSha: ABC, runId: '100-1', trigger: 'external', status: 'RUNNING',
  iteration: 1, produced: [], question: '', resumeOf: '', resumeKey: '', answerComment: '', retryOf: '', failure: '', ...o,
});
const botComment = (id, body) => ({ id, body, user: { login: BOT, type: 'Bot' } });
const ledgerFrom = (comments) => gate.collectLedger(comments, BOT);
const runComment = (id, o) => botComment(id, gate.formatRunRecord(record(o)));
const question = (id, o = {}) => `<!-- agent-question\nid: ${o.id || 'Q1'}\ntype: HUMAN_DECISION\nstatus: ${o.status || 'OPEN'}\noptions: ${o.options || 'A,B'}\n${o.reason ? `reason: ${o.reason}\n` : ''}${o.answerComment ? `answer-comment: ${o.answerComment}\n` : ''}-->\n\n## Decision\n`;
const many = (n, o = {}) => Array.from({ length: n }, (_, i) => runComment(10 + i, { runId: `${i}-1`, sourceSha: sha(i + 1), headSha: sha(i + 1), status: 'READY', ...o }));

const change = (o = {}) => gate.gateChange({
  changeId: 'PR-42', headSha: ABC, sender: 'alice', fork: false, state: 'open',
  commits: [external(ABC)], ledger: ledgerFrom([]), config, ...o,
});

// --- provenance trailers ---------------------------------------------------

test('parseTrailers reads the provenance block of a commit message', () => {
  const msg = `fix: something\n\nlong body\n\nCo-Authored-By: Someone <a@b.c>\n${trailerBlock({ run: '100-1', source: ABC })}`;
  assert.deepEqual(gate.parseTrailers(msg), { run: '100-1', change: 'PR-42', source: ABC });
  assert.deepEqual(gate.parseTrailers(msg.replace(/\n/g, '\r\n')), { run: '100-1', change: 'PR-42', source: ABC }, 'CRLF');
});

test('formatTrailers output round-trips through parseTrailers', () => {
  const block = gate.formatTrailers({ changeId: 'PR-42', sourceSha: ABC, runId: '100-1' });
  assert.deepEqual(gate.parseTrailers(`subject\n\n${block}`), { run: '100-1', change: 'PR-42', source: ABC });
  assert.doesNotMatch(block, /skip ci/i, 'provenance must never suppress CI');
});

test('malformed or partial provenance is never accepted', () => {
  const ok = trailerBlock({ run: '100-1', source: ABC });
  const p = (block) => gate.parseTrailers(`subject\n\n${block}`);
  assert.equal(gate.parseTrailers('subject only'), null);
  assert.equal(p(ok.replace('true', 'false')), null, 'Agent-Generated must be exactly true');
  assert.equal(p(ok.replace('Agent-Generated: true\n', '')), null, 'missing Agent-Generated');
  assert.equal(p(ok.replace(/Source-SHA:.*/, '')), null, 'missing Source-SHA');
  assert.equal(p(ok.replace(/Source-SHA:.*/, 'Source-SHA: abc')), null, 'short sha');
  assert.equal(p(ok.replace(/Source-SHA:.*/, `Source-SHA: ${ABC.toUpperCase()}`)), null, 'sha must be lowercase hex');
  assert.equal(p(ok.replace('100-1', '100 1')), null, 'run id with a space');
  assert.equal(p(ok.replace('100-1', '$(id)')), null, 'run id with shell syntax');
  assert.equal(p(ok.replace('Agent-Run', 'agent-run')), null, 'keys are case-sensitive');
  assert.equal(p(`${ok}\nAgent-Run: 200-1`), null, 'duplicate key');
  assert.equal(gate.parseTrailers(`subject\n\n${ok}\n\nlast paragraph without trailers`), null, 'trailers must be in the last paragraph');
  assert.equal(gate.parseTrailers(`Agent-Generated: true\nAgent-Run: 100-1\nAgent-Change: PR-42\nSource-SHA: ${ABC}`), null, 'a message that is only trailers has no subject');
});

// --- ledger: persisted, bot-authored run records ---------------------------

test('run record round-trips and stays a strict, bot-only structure', () => {
  const r = record({ status: 'READY', produced: [DEF], question: 'Q2', resumeOf: '99-1', resumeKey: 'Q1', answerComment: '900', trigger: 'resume', iteration: 3 });
  const body = gate.formatRunRecord(r);
  assert.match(body, /^<!-- agent-run\n/);
  assert.deepEqual(gate.parseRunRecord(body), r);
  assert.equal(gate.parseRunRecord(body.replace('READY', 'DONE')), null, 'unknown status');
  assert.equal(gate.parseRunRecord(body.replace(ABC, 'abc')), null, 'bad sha');
  assert.equal(gate.parseRunRecord(`text\n${body}`), null, 'header must start the comment');
  assert.equal(gate.parseRunRecord(body.replace('trigger: resume', 'trigger: automation')), null, 'unknown trigger');
  assert.equal(gate.parseRunRecord(body.replace(/iteration: 3/, 'iteration: -1')), null);
  assert.equal(gate.parseRunRecord(body.replace('-->', 'status: RUNNING\n-->')), null, 'duplicate field');
  assert.equal(gate.parseRunRecord(body.replace(/resume-key: .*\n/, '')), null, 'a resume must name the question it claims');
  assert.equal(gate.parseRunRecord(body.replace(/answer-comment: .*\n/, '')), null, 'a resume must name the winning answer');
  const retry = record({ trigger: 'retry', retryOf: '100-1', runId: '101-1', status: 'FAILED', failure: 'branch-moved' });
  assert.deepEqual(gate.parseRunRecord(gate.formatRunRecord(retry)), retry);
  assert.equal(gate.parseRunRecord(gate.formatRunRecord(retry).replace(/retry-of: .*\n/, '')), null, 'a retry must name the run it replaces');
  assert.equal(gate.parseRunRecord(gate.formatRunRecord(retry).replace('branch-moved', 'whatever')), null, 'unknown failure');
  assert.equal(gate.parseRunRecord(gate.formatRunRecord(record({ status: 'STALE' }))).status, 'STALE', 'STALE is its own status');
});

test('collectLedger trusts only records and questions authored by the bot', () => {
  const forged = { id: 7, body: gate.formatRunRecord(record({ runId: '999-1' })), user: { login: 'mallory', type: 'User' } };
  const ledger = ledgerFrom([runComment(1, { runId: '100-1' }), forged, botComment(3, question(3))]);
  assert.deepEqual(ledger.records.map((r) => r.runId), ['100-1']);
  assert.equal(ledger.records[0].commentId, 1);
  assert.equal(ledger.questions.length, 1);
  assert.equal(ledger.openQuestions, 1);
});

test('collectLedger: one record per claim key, the lowest comment id wins, a crashed loser is void', () => {
  const ledger = ledgerFrom([runComment(5, { runId: '100-1' }), runComment(6, { runId: '101-1' })]);
  assert.deepEqual(ledger.records.map((r) => r.runId), ['100-1']);
  assert.deepEqual(ledger.voided.map((r) => r.runId), ['101-1'], 'kept for diagnostics, never counted');
  const resumes = ledgerFrom([
    runComment(5, { runId: '100-1', status: 'WAITING_FOR_HUMAN', question: 'Q1' }), botComment(6, question(6)),
    runComment(8, { runId: '102-1', trigger: 'resume', resumeKey: 'Q1', answerComment: '7' }),
    runComment(10, { runId: '103-1', trigger: 'resume', resumeKey: 'Q1', answerComment: '9' }),
  ]);
  assert.deepEqual(resumes.records.map((r) => r.runId), ['100-1', '102-1'], 'one resume per question');
  assert.equal(resumes.questions[0].state, 'CLAIMED', 'OPEN header + claim = CLAIMED');
  assert.equal(resumes.openQuestions, 0);
});

// --- gateChange: pull_request events ---------------------------------------

test('1. an external change by a human runs the agent', () => {
  const d = change();
  assert.equal(d.decision, DECISION.RUN_AGENT);
  assert.deepEqual(d.run, { changeId: 'PR-42', sourceSha: ABC, headSha: ABC, trigger: 'external', iteration: 1 });
});

test('2. an external change from a tool such as Stitch (a bot identity) runs the agent', () => {
  assert.equal(change({ sender: 'stitch-export[bot]' }).decision, DECISION.RUN_AGENT, 'only the configured automation actor is special');
});

test('3. a commit by a LOCAL Claude/Codex using the developer identity is an external intent', () => {
  const local = external(ABC, 'feat: add filter\n\nGenerated with Claude Code\n\nCo-Authored-By: Claude <noreply@anthropic.com>');
  assert.equal(change({ commits: [local], sender: 'developer' }).decision, DECISION.RUN_AGENT);
  const codex = external(ABC, 'feat: add filter\n\nCo-authored-by: codex <codex@example.com>\nAgent: codex');
  assert.equal(change({ commits: [codex], sender: 'developer' }).decision, DECISION.RUN_AGENT);
});

// produced is written by the trusted publish step BEFORE it pushes (write-ahead), so it exists while RUNNING too.
const RUNNING = () => ledgerFrom([runComment(10, { status: 'RUNNING', produced: [DEF] })]);
const SEALED = () => ledgerFrom([runComment(10, { status: 'READY', produced: [DEF] })]);
const LIVE_UNRECORDED = () => ledgerFrom([runComment(10, { status: 'RUNNING' })]);

test('4. a commit produced by the automated run is IGNORE_AUTOMATION_CHANGE (recorded-and-running, and sealed)', () => {
  const commits = [external(ABC), internal(DEF, '100-1', ABC)];
  const live = change({ headSha: DEF, commits, ledger: RUNNING(), sender: APP });
  assert.equal(live.decision, DECISION.IGNORE_AUTOMATION_CHANGE);
  assert.equal(live.run, undefined, 'no run is created');
  assert.equal(change({ headSha: DEF, commits, ledger: SEALED(), sender: APP }).decision, DECISION.IGNORE_AUTOMATION_CHANGE);
});

test('4b. an automation commit event is redelivered: still ignored as automation, not as a new run', () => {
  const commits = [external(ABC), internal(DEF, '100-1', ABC)];
  for (let i = 0; i < 3; i++) assert.equal(change({ headSha: DEF, commits, ledger: SEALED(), sender: APP }).decision, DECISION.IGNORE_AUTOMATION_CHANGE);
});

test('6. the same source sha delivered twice is IGNORE_DUPLICATE', () => {
  assert.equal(change({ ledger: SEALED() }).decision, DECISION.IGNORE_DUPLICATE);
  assert.equal(change({ ledger: RUNNING() }).decision, DECISION.IGNORE_DUPLICATE, 'also while the first run is still going');
  const resumed = ledgerFrom([runComment(10, { status: 'READY' }), runComment(11, { runId: '101-1', trigger: 'resume', headSha: GHI, resumeKey: 'Q1', answerComment: '5' })]);
  assert.equal(change({ headSha: GHI, commits: [external(ABC), external(GHI)], ledger: resumed }).decision, DECISION.IGNORE_DUPLICATE, 'a commit a resume already started from');
});

test('7. a new external change after the agent commit runs the agent again', () => {
  const commits = [external(ABC), internal(DEF, '100-1', ABC), external(GHI, 'feat: human follow-up')];
  const d = change({ headSha: GHI, commits, ledger: SEALED() });
  assert.equal(d.decision, DECISION.RUN_AGENT);
  assert.equal(d.run.sourceSha, GHI);
  assert.equal(d.run.iteration, 2);
});

test('7b. an external commit is never swallowed by a later commit that carries trailers', () => {
  // human pushes GHI while run 100-1 is going; a commit with 100-1's trailers follows it, but publish never recorded it
  const commits = [external(ABC), external(GHI, 'feat: human push during the run'), internal(DEF, '100-1', ABC)];
  const d = change({ headSha: DEF, commits, ledger: LIVE_UNRECORDED(), sender: APP });
  assert.equal(d.decision, DECISION.RUN_AGENT);
  assert.equal(d.run.sourceSha, DEF);
});

test('9. iteration limit reached (default 3): WAITING_FOR_HUMAN (iteration-limit), the agent does not run', () => {
  const d = change({ headSha: GHI, commits: [external(GHI)], ledger: ledgerFrom(many(3)) });
  assert.equal(d.decision, DECISION.WAITING_FOR_HUMAN);
  assert.equal(d.reason, 'iteration-limit');
  assert.equal(d.iterations, 3);
  assert.equal(change({ headSha: GHI, commits: [external(GHI)], ledger: ledgerFrom(many(2)) }).decision, DECISION.RUN_AGENT, 'below the limit');
  const ten = { ...config, maxIterations: 10 };
  assert.equal(change({ headSha: GHI, commits: [external(GHI)], ledger: ledgerFrom(many(3)), config: ten }).decision, DECISION.RUN_AGENT, 'higher limits are a configuration choice');
  assert.equal(change({ headSha: GHI, commits: [external(GHI)], ledger: ledgerFrom(many(10)), config: ten }).reason, 'iteration-limit');
});

test('9b. runs before an acknowledgement no longer count, but stay in the ledger', () => {
  const limitQ = botComment(30, question(30, { id: 'iteration-limit-1', status: 'ANSWERED', options: 'continue', reason: 'iteration-limit', answerComment: '40' }));
  const after = runComment(41, { runId: '900-1', sourceSha: sha(0x900), headSha: sha(0x900), status: 'READY' });
  const ledger = ledgerFrom([...many(3), limitQ, after]);
  const d = change({ headSha: GHI, commits: [external(GHI)], ledger });
  assert.equal(d.decision, DECISION.RUN_AGENT);
  assert.equal(d.run.iteration, 2, 'only the run after the acknowledgement counts');
  assert.equal(ledger.records.length, 4, 'history is kept');
});

test('9c. an OPEN question keeps the change waiting: new external pushes do not start a run', () => {
  const ledger = ledgerFrom([runComment(10, { status: 'WAITING_FOR_HUMAN', question: 'Q1' }), botComment(11, question(11))]);
  const d = change({ headSha: GHI, commits: [external(ABC), external(GHI)], ledger });
  assert.equal(d.decision, DECISION.WAITING_FOR_HUMAN);
  assert.equal(d.reason, 'open-question');
});

test('14. malformed or mismatching provenance on a recorded commit cannot be used to skip the agent', () => {
  const at = (msg) => change({ headSha: DEF, commits: [external(ABC), { sha: DEF, message: msg }], ledger: RUNNING(), sender: APP }).decision;
  const good = `fix\n\n${trailerBlock({ run: '100-1', source: ABC })}`;
  assert.equal(at(good), DECISION.IGNORE_AUTOMATION_CHANGE, 'control: the well-formed one is accepted');
  assert.equal(at(good.replace('Agent-Generated: true', 'Agent-Generated: yes')), DECISION.RUN_AGENT);
  assert.equal(at(good.replace('100-1', '999-1')), DECISION.RUN_AGENT, 'another run id than the one that recorded it');
  assert.equal(at(good.replace(ABC, GHI)), DECISION.RUN_AGENT, 'source sha differs from the ledger record');
  assert.equal(at(good.replace('PR-42', 'PR-43')), DECISION.RUN_AGENT, 'another change');
  assert.equal(at(`${good}\nAgent-Run: 100-1`), DECISION.RUN_AGENT, 'duplicated key');
  assert.equal(at('fix: Agent-Generated: true Agent-Run: 100-1'), DECISION.RUN_AGENT, 'free text is not provenance');
});

test('15. forged Agent-* trailers never skip the agent: only commits the run recorded count', () => {
  const forged = (s = DEF) => internal(s, '100-1', ABC);
  assert.equal(change({ headSha: DEF, commits: [external(ABC), forged()], ledger: ledgerFrom([]) }).decision, DECISION.RUN_AGENT, 'no record at all');
  const humanRecord = { id: 5, body: gate.formatRunRecord(record({ produced: [DEF] })), user: { login: 'mallory', type: 'User' } };
  assert.equal(change({ headSha: DEF, commits: [external(ABC), forged()], ledger: ledgerFrom([humanRecord]) }).decision, DECISION.RUN_AGENT, 'a record forged by a human');
  assert.equal(change({ headSha: GHI, commits: [external(ABC), internal(DEF, '100-1', ABC), forged(GHI)], ledger: SEALED() }).decision, DECISION.RUN_AGENT, 'sealed run did not produce it');
  // the decisive change: a LIVE run with matching trailers is no longer enough, even from the automation identity
  assert.equal(change({ headSha: DEF, commits: [external(ABC), forged()], ledger: LIVE_UNRECORDED(), sender: 'mallory' }).decision, DECISION.RUN_AGENT);
  assert.equal(change({ headSha: DEF, commits: [external(ABC), forged()], ledger: LIVE_UNRECORDED(), sender: APP }).decision, DECISION.RUN_AGENT);
  assert.equal(change({ headSha: DEF, commits: [external(ABC), forged()], ledger: RUNNING(), sender: 'MY-AGENT-APP[bot]' }).decision, DECISION.IGNORE_AUTOMATION_CHANGE, 'control: recorded, real identity, case-insensitive');
});

test('15b. the automation identity alone is not provenance', () => {
  const d = change({ headSha: DEF, commits: [external(ABC), external(DEF, 'chore: pushed by the app, no trailers')], ledger: LIVE_UNRECORDED(), sender: APP });
  assert.equal(d.decision, DECISION.RUN_AGENT, 'no matching provenance: treated as an external change (the circuit breaker bounds the damage)');
});

test('15c. a recorded commit whose push event did not come from AGENT_PUSH_ACTOR: no run, flagged', () => {
  const d = change({ headSha: DEF, commits: [external(ABC), internal(DEF, '100-1', ABC)], ledger: SEALED(), sender: 'mallory' });
  assert.deepEqual([d.decision, d.reason], [DECISION.IGNORE_DUPLICATE, 'push-actor-mismatch'], 'nothing new to run, but not accepted as automation');
});

test('event validation and trust: forks, closed PRs and inconsistent input are rejected', () => {
  assert.equal(change({ fork: true }).decision, DECISION.REJECT_UNTRUSTED);
  assert.equal(change({ state: 'closed' }).decision, DECISION.REJECT_INVALID);
  assert.equal(change({ headSha: 'not-a-sha' }).decision, DECISION.REJECT_INVALID);
  assert.equal(change({ changeId: 'PR 42' }).decision, DECISION.REJECT_INVALID);
  assert.equal(change({ commits: [] }).decision, DECISION.REJECT_INVALID);
  assert.equal(change({ commits: [external(GHI)] }).decision, DECISION.REJECT_INVALID, 'commit list must end at the head');
  assert.equal(change({ commits: [{ sha: 'zzz', message: 'x' }], headSha: 'zzz' }).decision, DECISION.REJECT_INVALID);
});

// --- configuration: AGENT_PUSH_ACTOR is mandatory in github mode -------------

test('configuration: github mode requires AGENT_PUSH_ACTOR; local mode must be explicit and never inside Actions', () => {
  const p = gate.parseGateConfig;
  assert.deepEqual(p({ AGENT_PUSH_ACTOR: ' App[bot] ' }), { mode: 'github', pushActor: 'App[bot]', maxIterations: 3, error: '' }, 'default mode and conservative default limit');
  assert.equal(p({}).error, 'push-actor-not-configured', 'missing identity fails closed');
  assert.equal(p({ AGENT_PUSH_ACTOR: '   ' }).error, 'push-actor-not-configured');
  assert.equal(p({ AGENT_GATE_MODE: 'local' }).error, '', 'explicit local mode may omit the identity');
  assert.equal(p({ AGENT_GATE_MODE: 'local', GITHUB_ACTIONS: 'true' }).error, 'local-mode-in-actions');
  assert.equal(p({ AGENT_GATE_MODE: 'LOCAL', AGENT_PUSH_ACTOR: APP }).error, 'invalid-gate-mode', 'no fuzzy mode names');
  assert.equal(p({ AGENT_PUSH_ACTOR: 'app; rm -rf' }).error, 'invalid-push-actor');
  assert.equal(p({ AGENT_PUSH_ACTOR: APP, AGENT_MAX_ITERATIONS: '10' }).maxIterations, 10, 'higher limits are possible by configuration');
  for (const bad of ['0', '-1', 'abc', '3; rm', '1000', '']) assert.equal(p({ AGENT_PUSH_ACTOR: APP, AGENT_MAX_ITERATIONS: bad }).maxIterations, 3, `"${bad}" falls back to the default`);
});

test('configuration: every gate fails closed without the automation identity', () => {
  const missing = gate.parseGateConfig({});
  assert.deepEqual([change({ config: missing }).decision, change({ config: missing }).reason], [DECISION.REJECT_INVALID, 'push-actor-not-configured']);
  const comments = [runComment(10, { status: 'WAITING_FOR_HUMAN', question: 'Q1' }), botComment(11, question(11))];
  assert.equal(gate.gateAnswer({ comment: human('/agent answer Q1 A'), comments, botLogin: BOT, trust, changeId: 'PR-42', headSha: GHI, config: missing }).reason, 'push-actor-not-configured');
  const failed = ledgerFrom([runComment(10, { status: 'FAILED' })]);
  assert.equal(gate.gateRetry({ comment: human('/agent retry 100-1'), botLogin: BOT, trust, changeId: 'PR-42', headSha: ABC, ledger: failed, config: missing }).reason, 'push-actor-not-configured');
  // explicit local mode keeps the old behaviour for tests/dry runs: identity is not required
  const local = gate.parseGateConfig({ AGENT_GATE_MODE: 'local' });
  assert.equal(change({ headSha: DEF, commits: [external(ABC), internal(DEF, '100-1', ABC)], ledger: SEALED(), sender: 'anyone', config: local }).decision, DECISION.IGNORE_AUTOMATION_CHANGE);
});

// --- gateAnswer: issue_comment answers --------------------------------------

function human(body, o = {}) { return { id: o.id || 900, body, user: { login: o.login || 'alice', type: o.type || 'User' }, author_association: o.assoc || 'COLLABORATOR' }; }
const waiting = (extra = []) => [runComment(10, { status: 'WAITING_FOR_HUMAN', question: 'Q1' }), botComment(11, question(11)), ...extra];
const answer = (c, comments, o = {}) => gate.gateAnswer({ comment: c, comments, botLogin: BOT, trust, changeId: 'PR-42', headSha: GHI, config, ...o });

test('10. a valid human answer resumes the SAME change and source sha, claiming the question', () => {
  const d = answer(human('/agent answer Q1 A'), waiting());
  assert.equal(d.decision, DECISION.RESUME_AGENT);
  assert.deepEqual(d.run, { changeId: 'PR-42', sourceSha: ABC, headSha: GHI, trigger: 'resume', iteration: 2, resumeOf: '100-1', resumeKey: 'Q1', answerComment: '900' });
  assert.equal(d.answer.option, 'A');
});

test('12. a duplicate answer does not create a second resume', () => {
  const answered = [runComment(10, { status: 'WAITING_FOR_HUMAN', question: 'Q1' }), botComment(11, question(11, { status: 'ANSWERED', answerComment: '900' }))];
  const d = answer(human('/agent answer Q1 B', { id: 901 }), answered);
  assert.equal(d.decision, DECISION.IGNORE_DUPLICATE);
  assert.equal(d.run, undefined);
});

test('12b. an answer to a CLAIMED question (resume record exists, header not yet projected) repairs, never resumes', () => {
  const claimed = waiting([runComment(20, { runId: '101-1', trigger: 'resume', resumeKey: 'Q1', answerComment: '15', resumeOf: '100-1' })]);
  const d = answer(human('/agent answer Q1 B', { id: 30 }), claimed);
  assert.deepEqual([d.decision, d.reason], [DECISION.IGNORE_DUPLICATE, 'resume-already-created']);
  assert.equal(d.repair.questionCommentId, 11);
  assert.equal(d.repair.claim.answerComment, '15', 'the winning answer is the one in the claim, not this one');
});

test('13. answers from untrusted actors, bots and the agent identity are rejected', () => {
  assert.equal(answer(human('/agent answer Q1 A', { assoc: 'NONE' }), waiting()).decision, DECISION.REJECT_UNTRUSTED);
  assert.equal(answer(human('/agent answer Q1 A', { type: 'Bot' }), waiting()).decision, DECISION.REJECT_UNTRUSTED);
  assert.equal(answer(human('/agent answer Q1 A', { login: BOT }), waiting()).decision, DECISION.REJECT_UNTRUSTED);
});

test('invalid answers are REJECT_INVALID and never resume', () => {
  assert.equal(answer(human('/agent answer Q1 Z'), waiting()).decision, DECISION.REJECT_INVALID);
  assert.equal(answer(human('/agent answer Q9 A'), waiting()).decision, DECISION.REJECT_INVALID);
  assert.equal(answer(human('go with A'), waiting()).decision, DECISION.REJECT_INVALID);
  assert.equal(answer(human('/agent answer Q1 A'), waiting(), { botLogin: '' }).decision, DECISION.REJECT_INVALID, 'fails closed without a bot login');
  assert.equal(answer(human('/agent answer Q1 A'), [botComment(11, question(11))]).decision, DECISION.REJECT_INVALID, 'no run in the ledger to resume');
});

test('an answer that leaves other questions OPEN records the answer but keeps waiting', () => {
  const d = answer(human('/agent answer Q1 A'), waiting([botComment(12, question(12, { id: 'Q2' }))]));
  assert.equal(d.decision, DECISION.WAITING_FOR_HUMAN);
  assert.equal(d.reason, 'questions-remaining');
  assert.equal(d.answer.option, 'A');
});

test('9d. a resume also counts toward the limit: at the limit the answer is recorded and the run is held', () => {
  const runs = many(3, { status: 'READY' }).map((c, i) => (i === 2 ? runComment(c.id, { runId: '2-1', sourceSha: sha(3), headSha: sha(3), status: 'WAITING_FOR_HUMAN', question: 'Q1' }) : c));
  const d = answer(human('/agent answer Q1 A'), [...runs, botComment(30, question(30))]);
  assert.equal(d.decision, DECISION.WAITING_FOR_HUMAN);
  assert.equal(d.reason, 'iteration-limit');
  assert.equal(d.answer.option, 'A');
});

test('9e. answering the iteration-limit question with "continue" opens a new budget window and resumes', () => {
  const limitQ = botComment(40, question(40, { id: 'iteration-limit-1', options: 'continue', reason: 'iteration-limit' }));
  const d = answer(human('/agent answer iteration-limit-1 continue', { id: 950 }), [...many(3), limitQ]);
  assert.equal(d.decision, DECISION.RESUME_AGENT);
  assert.equal(d.run.iteration, 1);
  assert.equal(d.run.sourceSha, sha(3), 'resumes the change from its latest source');
});

// --- gateRetry: `/agent retry <run-id>` --------------------------------------

const retryIn = (comments, body = '/agent retry 100-1', o = {}) => gate.gateRetry({
  comment: human(body, o), botLogin: BOT, trust, changeId: 'PR-42', headSha: GHI, ledger: ledgerFrom(comments), config, ...o.args,
});

test('retry: a FAILED run gets a new run of the same change and source, counted, never an external intent', () => {
  const d = retryIn([runComment(10, { status: 'FAILED', failure: 'branch-moved' })]);
  assert.deepEqual([d.decision, d.reason], [DECISION.RETRY_AGENT, 'retry-failed']);
  assert.deepEqual(d.run, { changeId: 'PR-42', sourceSha: ABC, headSha: GHI, trigger: 'retry', iteration: 2, retryOf: '100-1' });
});

test('retry: trusted actors only; bots and the automation identity cannot retry', () => {
  const failed = [runComment(10, { status: 'FAILED' })];
  assert.equal(retryIn(failed, '/agent retry 100-1', { assoc: 'NONE' }).decision, DECISION.REJECT_UNTRUSTED);
  assert.equal(retryIn(failed, '/agent retry 100-1', { type: 'Bot' }).decision, DECISION.REJECT_UNTRUSTED);
  assert.equal(retryIn(failed, '/agent retry 100-1', { login: BOT }).decision, DECISION.REJECT_UNTRUSTED);
});

test('retry: idempotent: a run that was already retried is IGNORE_DUPLICATE', () => {
  const d = retryIn([runComment(10, { status: 'FAILED' }), runComment(11, { runId: '101-1', trigger: 'retry', retryOf: '100-1' })]);
  assert.deepEqual([d.decision, d.reason], [DECISION.IGNORE_DUPLICATE, 'retry-already-created']);
});

test('retry: only FAILED or STALE, of this change, and only the latest run', () => {
  assert.equal(retryIn([]).reason, 'unknown-run');
  assert.equal(retryIn([runComment(10, { status: 'READY' })]).reason, 'not-retryable');
  assert.equal(retryIn([runComment(10, { status: 'WAITING_FOR_HUMAN' })]).reason, 'not-retryable');
  assert.equal(retryIn([runComment(10, { status: 'FAILED', changeId: 'PR-7' })]).reason, 'other-change');
  assert.equal(retryIn([runComment(10, { status: 'FAILED' }), runComment(11, { runId: '101-1', sourceSha: GHI, headSha: GHI, status: 'READY' })]).reason, 'superseded');
  assert.equal(retryIn([runComment(10, { status: 'STALE' })]).reason, 'retry-stale');
});

test('retry: a RUNNING record is STALE only if its execution has ended; active or unknown is refused', () => {
  const running = [runComment(10, { status: 'RUNNING' })];
  assert.equal(retryIn(running, undefined, { args: { liveness: () => 'active' } }).reason, 'run-active');
  assert.equal(retryIn(running, undefined, { args: { liveness: () => 'unknown' } }).reason, 'run-state-unknown');
  const d = retryIn(running, undefined, { args: { liveness: () => 'ended' } });
  assert.deepEqual([d.decision, d.reason, d.stale], [DECISION.RETRY_AGENT, 'retry-stale', true]);
});

test('retry: open questions take precedence; the limit holds it', () => {
  assert.deepEqual(Object.values((({ decision, reason }) => ({ decision, reason }))(retryIn([runComment(10, { status: 'FAILED' }), botComment(11, question(11))]))), [DECISION.WAITING_FOR_HUMAN, 'open-question']);
  const atLimit = [...many(2), runComment(20, { runId: '100-1', status: 'FAILED' })];
  const d = retryIn(atLimit);
  assert.deepEqual([d.decision, d.reason, d.iterations], [DECISION.WAITING_FOR_HUMAN, 'iteration-limit', 3]);
});

// --- orchestration against an in-memory GitHub -----------------------------
// The fake keeps PR comments, commits, labels and Actions executions, so a scenario is a sequence of real gate
// calls: nothing is remembered between them except what the gate itself persisted. `crash(method, when)` makes
// the next matching API call throw once, to simulate a runner dying at that exact point.

const path = require('node:path');
const TMP = '/tmp';
const owner = 'o';
const repo = 'r';

function world({ fork = false } = {}) {
  const w = {
    comments: [], commits: [], labels: new Set(), state: 'open', nextId: 1, runSeq: 100, files: {}, calls: [], fork, faults: [],
    executions: {}, clock: Date.UTC(2026, 8, 25, 10, 0, 0),
  };
  const key = (p) => path.resolve(p);
  const kind = (k) => Object.assign(() => {}, { kind: k });
  const find = (id) => w.comments.find((c) => c.id === id);
  const now = () => new Date((w.clock += 1000)).toISOString().replace('.000Z', 'Z');
  w.crash = (method, when = () => true) => w.faults.push({ method, when });
  const fault = (method, args) => {
    const i = w.faults.findIndex((f) => f.method === method && f.when(args));
    if (i >= 0) { w.faults.splice(i, 1); throw new Error(`injected crash: ${method}`); }
  };
  w.fs = {
    writeFileSync: (p, c) => { w.files[key(p)] = String(c); },
    readFileSync: (p) => { if (!(key(p) in w.files)) throw new Error('not found'); return w.files[key(p)]; },
  };
  w.github = {
    paginate: async (fn) => {
      if (fn.kind === 'comments') { fault('list'); return w.comments.map((c) => ({ ...c })); }
      if (fn.kind === 'commits') return w.commits.map((c) => ({ sha: c.sha, commit: { message: c.message } }));
      throw new Error('unexpected paginate');
    },
    rest: {
      pulls: {
        get: async () => ({ data: { state: w.state, head: { sha: w.commits[w.commits.length - 1].sha, ref: 'agent/x', repo: { full_name: w.fork ? 'evil/r' : `${owner}/${repo}` } } } }),
        listCommits: kind('commits'),
      },
      issues: {
        listComments: kind('comments'),
        getComment: async (a) => { fault('getComment', a); return { data: { ...find(a.comment_id) } }; },
        createComment: async (a) => { fault('create', a); const c = { id: w.nextId++, body: a.body, user: { login: BOT, type: 'Bot' }, created_at: now() }; w.comments.push(c); w.calls.push('create'); return { data: { ...c } }; },
        updateComment: async (a) => { fault('update', a); find(a.comment_id).body = a.body; w.calls.push('update'); },
        deleteComment: async (a) => { fault('delete', a); w.comments = w.comments.filter((c) => c.id !== a.comment_id); w.calls.push('delete'); },
        addLabels: async (a) => { fault('addLabels', a); a.labels.forEach((l) => w.labels.add(l)); },
        removeLabel: async ({ name }) => { if (!w.labels.delete(name)) { const e = new Error('nf'); e.status = 404; throw e; } },
      },
      actions: {
        getWorkflowRunAttempt: async ({ run_id, attempt_number }) => {
          w.calls.push('liveness');
          const s = w.executions[`${run_id}-${attempt_number}`] || 'completed';
          if (s === 404 || s === 500) { const e = new Error('x'); e.status = s; throw e; }
          return { data: { status: s } };
        },
      },
    },
  };
  const sink = () => { const o = {}; return { o, core: { setOutput: (k, v) => { o[k] = v; }, info() {}, warning: (m) => { o.warning = m; }, setFailed: (m) => { o.failed = m; } } }; };
  const ctx = (extra = {}) => ({ repo: { owner, repo }, serverUrl: 'https://github.com', runId: ++w.runSeq, ...extra });
  w.envOf = (extra = {}) => ({ AGENT_BOT_LOGIN: BOT, AGENT_PUSH_ACTOR: APP, RUNNER_TEMP: TMP, ...extra });

  w.push = (s, message = 'feat: change') => { w.commits.push({ sha: s, message }); return s; };
  w.say = (body, o = {}) => { const c = { id: w.nextId++, body, user: { login: o.login || 'alice', type: o.type || 'User' }, author_association: o.assoc || 'COLLABORATOR', created_at: now() }; w.comments.push(c); return c; };
  w.ledger = () => gate.collectLedger(w.comments, BOT);
  w.records = () => w.ledger().records;
  w.question = (id = 'Q1') => w.ledger().questions.find((x) => x.q.id === id);
  w.label = () => [...w.labels].sort().join(',');
  /** A pull_request event for the current head, sent by `sender`. */
  w.start = async (sender, env = {}) => {
    const { o, core } = sink();
    const head = w.commits[w.commits.length - 1].sha;
    const context = ctx({ payload: { pull_request: { number: 42, state: 'open', head: { sha: head, repo: { full_name: `${owner}/${repo}` } } }, sender: { login: sender } } });
    const r = await gate.startRun({ github: w.github, context, core, fs: w.fs, env: w.envOf(env) });
    return { ...r, o };
  };
  /** An issue_comment event: `comment` (from w.say) was just created. `ctxExtra` can re-use a run id (re-run of a job). */
  w.comment = async (comment, env = {}, ctxExtra = {}) => {
    const { o, core } = sink();
    const context = ctx({ payload: { issue: { number: 42, pull_request: {} }, comment, sender: { login: comment.user.login } }, ...ctxExtra });
    await gate.onComment({ github: w.github, context, core, fs: w.fs, env: w.envOf(env) });
    return o;
  };
  /**
   * The agent job: the agent step commits LOCALLY on top of the checked-out commit (with the runner-provided trailers),
   * writes the result, and never pushes; then the trusted publish step runs with this job's git view.
   * `local` overrides the commits verbatim; `beforePublish` runs between the agent step and publish.
   */
  w.agent = async (o, { commits = [], local, result = { status: 'READY' }, question, beforePublish, env = {} } = {}) => {
    const base = o.head_sha;
    const trailers = w.fs.readFileSync(o.trailers_file);
    const mine = local || commits.map(([s, message]) => ({ sha: s, message: `${message}\n\n${trailers}` }));
    const git = {
      head: () => (mine.length ? mine[mine.length - 1].sha : base),
      isAncestor: (a, b) => a === base && (b === base || mine.some((c) => c.sha === b)),
      revList: () => mine.map((c) => c.sha),
      message: (s) => mine.find((c) => c.sha === s).message,
      remoteHead: () => w.commits[w.commits.length - 1].sha,
      push: (ref, expected) => {
        fault('push');
        if (w.commits[w.commits.length - 1].sha !== expected) throw new Error('stale info (lease)');
        mine.forEach((c) => w.commits.push(c));
        w.calls.push('push');
      },
    };
    if (question) w.fs.writeFileSync(`${TMP}/q.md`, question);
    w.fs.writeFileSync(`${TMP}/agent-result.json`, JSON.stringify(result));
    if (beforePublish) await beforePublish();
    const { o: out, core } = sink();
    await gate.publish({
      github: w.github, context: ctx(), core, fs: w.fs, git,
      env: w.envOf({ AGENT_PR_NUMBER: '42', AGENT_RUN_ID: o.run_id, AGENT_CHANGE_ID: o.change_id, AGENT_HEAD_REF: 'agent/x', ...env }),
    });
    return out;
  };
  return w;
}

const QUESTION_FILE = (id = 'Q1') => `<!-- agent-question\nid: ${id}\ntype: HUMAN_DECISION\nstatus: OPEN\noptions: A,B\ndecision-key: payments.gateway\n-->\n\n## Decision required\n\n### Handoff\n- Completed independent work: none\n- Not started (depends on this decision): provider integration\n`;
const ASK = { result: { status: 'WAITING_FOR_HUMAN', question_file: 'q.md' }, question: QUESTION_FILE() };

test('EXTERNAL → AGENT → INTERNAL COMMIT → CI → STOP', async () => {
  const w = world();
  w.push(ABC);
  const first = await w.start('alice');
  assert.equal(first.decision, DECISION.RUN_AGENT);
  assert.equal(first.o.run, 'true');
  assert.equal(first.o.change_id, 'PR-42');
  assert.equal(first.o.source_sha, ABC);
  assert.equal(w.label(), 'agent:running');
  await w.agent(first.o, { commits: [[DEF, 'fix: agent work']] });
  assert.equal(w.label(), 'agent:ready');
  assert.deepEqual(w.records()[0].produced, [DEF], 'exactly what publish pushed');
  // GitHub delivers the push event of DEF (CI runs on it independently: see the workflow tests below)
  const self = await w.start(APP);
  assert.equal(self.decision, DECISION.IGNORE_AUTOMATION_CHANGE);
  assert.equal(self.o.run, 'false');
  for (let i = 0; i < 3; i++) assert.equal((await w.start(APP)).o.run, 'false', 'STOP: redeliveries keep being ignored');
  assert.equal(w.records().length, 1, 'exactly one agent run was ever recorded');
});

test('MANDATORY: RUNNING R → human injects H with valid trailers of R → agent ends → publish → H not produced → H is an external intent', async () => {
  const w = world();
  w.push(ABC);
  const r = await w.start('alice');
  const trailersOfR = w.fs.readFileSync(r.o.trailers_file);
  const H = sha(0x4444);
  const out = await w.agent(r.o, {
    commits: [[DEF, 'fix: agent work']],
    // while R runs, mallory pushes H carrying R's exact provenance
    beforePublish: () => w.push(H, `feat: sneaky\n\n${trailersOfR}`),
  });
  const rec = w.records()[0];
  assert.deepEqual(rec.produced, [], 'H never enters produced (and nothing of R was pushed over it)');
  assert.deepEqual([rec.status, rec.failure], ['FAILED', 'branch-moved']);
  assert.ok(out.failed);
  assert.ok(!w.commits.some((c) => c.sha === DEF), 'the agent commit was not force-pushed over the human one');
  // H's own event, delivered after the run (concurrency group) — or even from the automation identity
  const next = await w.start('mallory');
  assert.equal(next.decision, DECISION.RUN_AGENT, 'H is an external intent');
  assert.equal(next.o.source_sha, H);
});

test('MANDATORY (variant): the agent incorporates H locally (fetch/rebase) — H is still never produced', async () => {
  const w = world();
  w.push(ABC);
  const r = await w.start('alice');
  const trailersOfR = w.fs.readFileSync(r.o.trailers_file);
  const H = { sha: sha(0x4444), message: `feat: sneaky\n\n${trailersOfR}` };
  w.commits.push(H);
  await w.agent(r.o, { local: [H, { sha: DEF, message: `fix: agent\n\n${trailersOfR}` }] });
  assert.deepEqual([w.records()[0].status, w.records()[0].failure, w.records()[0].produced], ['FAILED', 'branch-moved', []]);
  assert.equal((await w.start(APP)).decision, DECISION.RUN_AGENT, 'even an event from the automation identity cannot make H internal');
});

test('publish builds produced only from the job\'s own commits since the start commit, all carrying this run\'s provenance', async () => {
  const noTrailer = world();
  noTrailer.push(ABC);
  const a = await noTrailer.start('alice');
  const t = noTrailer.fs.readFileSync(a.o.trailers_file);
  await noTrailer.agent(a.o, { local: [{ sha: DEF, message: `fix\n\n${t}` }, { sha: GHI, message: 'chore: no provenance' }] });
  assert.deepEqual([noTrailer.records()[0].failure, noTrailer.records()[0].produced, noTrailer.calls.includes('push')], ['missing-provenance', [], false]);

  const otherRun = world();
  otherRun.push(ABC);
  const b = await otherRun.start('alice');
  await otherRun.agent(b.o, { local: [internal(DEF, '999-1', ABC)] });
  assert.equal(otherRun.records()[0].failure, 'missing-provenance', 'trailers of another run');

  const rewritten = world();
  rewritten.push(ABC);
  const c = await rewritten.start('alice');
  const git = { head: () => DEF, isAncestor: () => false };
  const res = await gate.pushProduced({ git, rec: rewritten.records()[0], ref: 'agent/x', recordProduced: async () => assert.fail('nothing recorded') });
  assert.deepEqual(res, { produced: [], failure: 'history-rewritten' }, 'HEAD must descend from the start commit');
  assert.ok(c);
});

test('write-ahead: produced is recorded before the push; a crash after the push still classifies it as automation', async () => {
  const w = world();
  w.push(ABC);
  const r = await w.start('alice');
  // the publish step dies after pushing, before sealing (the seal is the 2nd update of the run record)
  let updates = 0;
  w.crash('update', () => ++updates === 2);
  await assert.rejects(w.agent(r.o, { commits: [[DEF, 'fix: agent work']] }), /injected crash/);
  assert.equal(w.records()[0].status, 'RUNNING');
  assert.deepEqual(w.records()[0].produced, [DEF]);
  assert.equal((await w.start(APP)).decision, DECISION.IGNORE_AUTOMATION_CHANGE);
});

test('a push rejected by the compare-and-swap is FAILED(push-failed); the write-ahead list is kept', async () => {
  const w = world();
  w.push(ABC);
  const r = await w.start('alice');
  w.crash('push');
  const out = await w.agent(r.o, { commits: [[DEF, 'fix: agent work']] });
  assert.ok(out.failed);
  assert.deepEqual([w.records()[0].status, w.records()[0].failure, w.records()[0].produced], ['FAILED', 'push-failed', [DEF]]);
});

test('an agent step that pushes by itself (bypassing publish) is not automation: its commits are external', async () => {
  const w = world();
  w.push(ABC);
  const r = await w.start('alice');
  const trailers = w.fs.readFileSync(r.o.trailers_file);
  w.push(DEF, `fix: pushed by the agent step itself\n\n${trailers}`);
  assert.equal((await w.start(APP)).decision, DECISION.RUN_AGENT, 'not recorded by publish');
});

test('AGENT_PUSH_ACTOR: missing → no run and nothing written; correct → automation; incorrect → not automation', async () => {
  const missing = world();
  missing.push(ABC);
  const m = await missing.start('alice', { AGENT_PUSH_ACTOR: '' });
  assert.deepEqual([m.decision, m.reason, m.o.run], [DECISION.REJECT_INVALID, 'push-actor-not-configured', 'false']);
  assert.deepEqual([missing.comments.length, missing.label()], [0, '']);
  const inActions = await missing.start('alice', { AGENT_PUSH_ACTOR: '', AGENT_GATE_MODE: 'local', GITHUB_ACTIONS: 'true' });
  assert.equal(inActions.reason, 'local-mode-in-actions');

  const w = world();
  w.push(ABC);
  const r = await w.start('alice');
  await w.agent(r.o, { commits: [[DEF, 'fix: agent work']] });
  assert.equal((await w.start(APP)).decision, DECISION.IGNORE_AUTOMATION_CHANGE, 'correct actor');
  const wrong = await w.start('someone-else');
  assert.deepEqual([wrong.decision, wrong.reason, wrong.o.run], [DECISION.IGNORE_DUPLICATE, 'push-actor-mismatch', 'false'], 'incorrect actor: not accepted as automation');
  assert.ok(wrong.o.warning, 'and it is reported');
});

test('publish fails closed without AGENT_PUSH_ACTOR: nothing is pushed, the run is FAILED(misconfigured)', async () => {
  const w = world();
  w.push(ABC);
  const r = await w.start('alice');
  const out = await w.agent(r.o, { commits: [[DEF, 'fix']], env: { AGENT_PUSH_ACTOR: '' } });
  assert.ok(out.failed);
  assert.deepEqual([w.records()[0].status, w.records()[0].failure, w.calls.includes('push')], ['FAILED', 'misconfigured', false]);
});

test('EXTERNAL → AGENT → WAITING_FOR_HUMAN → ANSWER → RESUME → COMPLETE', async () => {
  const w = world();
  w.push(ABC);
  const first = await w.start('alice');
  const waitingOut = await w.agent(first.o, ASK);
  assert.ok(!waitingOut.failed);
  assert.equal(w.label(), 'agent:waiting-human');
  assert.equal(w.records()[0].status, 'WAITING_FOR_HUMAN');
  assert.equal(w.records()[0].question, 'Q1');

  w.push(GHI, 'feat: human push while waiting');
  const held = await w.start('alice');
  assert.equal(held.decision, DECISION.WAITING_FOR_HUMAN, 'a push while waiting does not start a competing run');

  const resumed = await w.comment(w.say('/agent answer Q1 A'));
  assert.equal(resumed.run, 'true');
  assert.equal(resumed.mode, 'resume');
  assert.equal(resumed.change_id, 'PR-42', '10. same change_id');
  assert.equal(resumed.source_sha, ABC, '11. same source_sha');
  assert.equal(resumed.head_sha, GHI, 'starts from the current head');
  assert.notEqual(resumed.run_id, first.o.run_id, '11. new run_id');
  assert.equal(w.label(), 'agent:running');
  const recs = w.records();
  assert.equal(recs.length, 2);
  assert.deepEqual([recs[1].trigger, recs[1].resumeOf, recs[1].resumeKey, recs[1].iteration], ['resume', first.o.run_id, 'Q1', 2]);
  assert.equal(w.question().q.status, 'ANSWERED');

  await w.agent(resumed, { commits: [[DEF, 'feat: apply the decision']] });
  assert.equal(w.label(), 'agent:ready');
  assert.equal(w.records()[1].status, 'READY');
  assert.deepEqual(w.records()[1].produced, [DEF]);
  assert.equal((await w.start(APP)).decision, DECISION.IGNORE_AUTOMATION_CHANGE);
});

test('EXTERNAL → AGENT → INTERNAL COMMIT → NEW EXTERNAL CHANGE → NEW AGENT RUN', async () => {
  const w = world();
  w.push(ABC);
  const first = await w.start('alice');
  await w.agent(first.o, { commits: [[DEF, 'fix: agent work']] });
  assert.equal((await w.start(APP)).decision, DECISION.IGNORE_AUTOMATION_CHANGE);
  w.push(GHI, 'feat: local Claude Code change, pushed with the developer identity');
  const next = await w.start('developer');
  assert.equal(next.decision, DECISION.RUN_AGENT);
  assert.equal(next.o.source_sha, GHI);
  assert.equal(w.records().length, 2);
  assert.equal(w.records()[1].iteration, 2);
});

test('DUPLICATE EVENT → NO SECOND RUN', async () => {
  const w = world();
  w.push(ABC);
  assert.equal((await w.start('alice')).decision, DECISION.RUN_AGENT);
  const again = await w.start('alice');
  assert.equal(again.decision, DECISION.IGNORE_DUPLICATE);
  assert.equal(again.o.run, 'false');
  assert.equal(w.records().length, 1);
});

test('LOOP LIMIT (default 3) → WAITING_FOR_HUMAN → "continue" opens a new window; history and audit are kept', async () => {
  const w = world();
  // a misbehaving setup: every change is seen as external, so it keeps re-triggering
  for (let i = 1; i <= 3; i++) {
    w.push(sha(0x1000 + i), `feat: change ${i}`);
    const r = await w.start('developer');
    assert.equal(r.decision, DECISION.RUN_AGENT, `run ${i}`);
    await w.agent(r.o);
  }
  w.push(sha(0x1004), 'feat: change 4');
  const blocked = await w.start('developer');
  assert.deepEqual([blocked.decision, blocked.reason, blocked.o.run], [DECISION.WAITING_FOR_HUMAN, 'iteration-limit', 'false']);
  assert.equal(w.label(), 'agent:waiting-human');
  assert.equal(w.records().length, 3, 'no fourth run');
  const q = w.question('iteration-limit-1').q;
  assert.deepEqual([q.status, q.reason, q.options, q.window, q.lastRun], ['OPEN', 'iteration-limit', ['continue'], '1', w.records()[2].runId]);
  const posted = w.comments.find((c) => /iteration-limit-1/.test(c.body)).body;
  for (const r of w.records()) assert.match(posted, new RegExp(r.runId), 'diagnostics list every run');
  assert.match(posted, /### Handoff/);

  w.push(sha(0x1005), 'feat: change 5');
  assert.equal((await w.start('developer')).reason, 'open-question', 'further events neither run nor add a second question');
  assert.equal(w.ledger().questions.length, 1);

  const ack = w.say('/agent answer iteration-limit-1 continue', { login: 'carol' });
  const cont = await w.comment(ack);
  assert.equal(cont.run, 'true');
  const recs = w.records();
  assert.equal(recs.length, 4, 'R1-R4 all exist');
  assert.equal(recs[3].iteration, 1, 'first run of the new budget window');

  const audit = gate.auditChange(w.ledger(), 'PR-42');
  assert.equal(audit.totalRuns, 4, 'how many runs in total');
  assert.equal(audit.breakerOpened, 1, 'how many times the breaker opened');
  assert.deepEqual(audit.runs.map((r) => r.window), [1, 1, 1, 2]);
  assert.equal(audit.currentWindow, 2);
  assert.deepEqual(audit.acknowledgements, [{
    question: 'iteration-limit-1', by: 'carol', at: ack.created_at, answerComment: ack.id, opensWindow: 2,
    heldAtRun: recs[2].runId, activeRun: recs[2].runId,
  }], 'who authorised, when, and which run was active');
});

test('8./17. two concurrent deliveries of the same event: only one run proceeds', async () => {
  const w = world();
  w.push(ABC);
  const [a, b] = await Promise.all([w.start('alice'), w.start('alice')]);
  assert.deepEqual([a.o.run, b.o.run].sort(), ['false', 'true']);
  assert.equal(w.records().length, 1, 'the losing claim removed its own record');
  assert.equal(w.calls.filter((c) => c === 'create').length, 2, 'both really raced: each created a record');
});

test('17. two concurrent copies of the same answer: only one resume proceeds', async () => {
  const w = world();
  w.push(ABC);
  await w.agent((await w.start('alice')).o, ASK);
  const c = w.say('/agent answer Q1 A');
  const [a, b] = await Promise.all([w.comment(c), w.comment(c)]);
  assert.deepEqual([a.run, b.run].sort(), ['false', 'true']);
  assert.equal(w.records().length, 2);
});

test('12. a second answer to an answered question does not resume again', async () => {
  const w = world();
  w.push(ABC);
  await w.agent((await w.start('alice')).o, ASK);
  assert.equal((await w.comment(w.say('/agent answer Q1 A'))).run, 'true');
  const second = await w.comment(w.say('/agent answer Q1 B', { login: 'bob' }));
  assert.equal(second.run, 'false');
  assert.equal(w.records().length, 2);
});

test('13. an answer from an untrusted actor changes nothing', async () => {
  const w = world();
  w.push(ABC);
  await w.agent((await w.start('alice')).o, ASK);
  const before = JSON.stringify(w.comments);
  const out = await w.comment(w.say('/agent answer Q1 A', { login: 'mallory', assoc: 'NONE' }));
  assert.equal(out.run, 'false');
  assert.equal(w.label(), 'agent:waiting-human');
  assert.equal(JSON.stringify(w.comments.slice(0, -1)), before, 'the question is still OPEN and untouched');
});

test('forks: no run, no comments, no labels', async () => {
  const w = world({ fork: true });
  w.push(ABC);
  const r = await w.start('mallory');
  assert.equal(r.decision, DECISION.REJECT_UNTRUSTED);
  assert.equal(r.o.run, 'false');
  assert.equal(w.comments.length, 0);
  assert.equal(w.label(), '');
});

test('fails closed without AGENT_BOT_LOGIN', async () => {
  const w = world();
  w.push(ABC);
  const r = await w.start('alice', { AGENT_BOT_LOGIN: '' });
  assert.equal(r.decision, DECISION.REJECT_INVALID);
  assert.equal(r.o.run, 'false');
  assert.equal(w.comments.length, 0);
});

test('a human forging Agent-* trailers after the run (even a copied run id) still triggers the agent', async () => {
  const w = world();
  w.push(ABC);
  const first = await w.start('alice');
  await w.agent(first.o, { commits: [[DEF, 'fix: agent work']] });
  w.push(GHI, `feat: sneaky\n\n${w.fs.readFileSync(first.o.trailers_file)}`);
  assert.equal((await w.start('mallory')).decision, DECISION.RUN_AGENT);
});

// --- resume recovery: a crash at every point between answer and new run ---

const asking = async () => {
  const w = world();
  w.push(ABC);
  const first = await w.start('alice');
  await w.agent(first.o, ASK);
  return { w, first };
};
const isResumeRecord = (a) => /trigger: resume/.test(a.body || '');
const resumes = (w) => w.records().filter((r) => r.trigger === 'resume');

test('R1. crash while writing the claim: nothing persisted, question still OPEN; the redelivery resumes exactly once', async () => {
  const { w } = await asking();
  const c = w.say('/agent answer Q1 A');
  w.crash('create', isResumeRecord);
  await assert.rejects(w.comment(c), /injected crash/);
  assert.deepEqual([resumes(w).length, w.question().state], [0, 'OPEN']);
  assert.equal((await w.comment(c)).run, 'true');
  assert.equal(resumes(w).length, 1);
});

test('R2. crash after the claim, before the tie-break: CLAIMED; redelivery repairs, creates nothing; the orphan run is STALE and retryable', async () => {
  const { w } = await asking();
  const c = w.say('/agent answer Q1 A');
  w.crash('list', () => w.comments.some(isResumeRecord));
  await assert.rejects(w.comment(c), /injected crash/);
  assert.deepEqual([resumes(w).length, w.question().state], [1, 'CLAIMED'], 'the resume record is the claim');
  assert.equal(w.ledger().openQuestions, 0, 'a claimed question does not hold the change');
  const again = await w.comment(c);
  assert.deepEqual([again.run, again.reason], ['false', 'resume-already-created']);
  assert.deepEqual([resumes(w).length, w.question().q.status, w.question().q.answerComment], [1, 'ANSWERED', String(c.id)]);
  // the orphan never started an agent job; once its execution has ended, it is STALE and can be retried
  const orphan = resumes(w)[0];
  const retried = await w.comment(w.say(`/agent retry ${orphan.runId}`));
  assert.deepEqual([retried.run, retried.mode, retried.reason, retried.retry_of], ['true', 'retry', 'retry-stale', orphan.runId]);
  assert.equal(w.records().find((r) => r.runId === orphan.runId).status, 'STALE', 'diagnosable as STALE, not rewritten as FAILED');
});

test('R3. crash after winning the claim, before projecting the header: redelivery projects the winning answer, creates nothing', async () => {
  const { w } = await asking();
  const c = w.say('/agent answer Q1 A');
  w.crash('getComment');
  await assert.rejects(w.comment(c), /injected crash/);
  assert.equal(w.question().state, 'CLAIMED');
  const again = await w.comment(c);
  assert.equal(again.run, 'false');
  const q = w.question().q;
  assert.deepEqual([q.status, q.answeredBy, q.answerComment, q.answeredAt], ['ANSWERED', 'alice', String(c.id), c.created_at]);
  assert.equal(resumes(w).length, 1);
});

test('R4. crash after the header, before labels/outputs: redelivery creates nothing; the run is retryable once its execution ended', async () => {
  const { w } = await asking();
  const c = w.say('/agent answer Q1 A');
  w.crash('addLabels', (a) => a.labels.includes('agent:running'));
  await assert.rejects(w.comment(c), /injected crash/);
  assert.equal(w.question().q.status, 'ANSWERED');
  assert.equal((await w.comment(c)).run, 'false');
  assert.equal(resumes(w).length, 1);
  const orphan = resumes(w)[0];
  w.executions[orphan.runId] = 'in_progress';
  assert.equal((await w.comment(w.say(`/agent retry ${orphan.runId}`))).reason, 'run-active', 'never while its execution may still run');
  w.executions[orphan.runId] = 'completed';
  assert.equal((await w.comment(w.say(`/agent retry ${orphan.runId}`))).run, 'true');
});

test('R5. a different answer Y arriving while Q is CLAIMED by X completes X; Y is not applied', async () => {
  const { w } = await asking();
  const x = w.say('/agent answer Q1 A');
  w.crash('getComment');
  await assert.rejects(w.comment(x), /injected crash/);
  const y = await w.comment(w.say('/agent answer Q1 B', { login: 'bob' }));
  assert.deepEqual([y.run, y.reason], ['false', 'resume-already-created']);
  const q = w.question().q;
  assert.deepEqual([q.status, q.answeredBy, q.answerComment], ['ANSWERED', 'alice', String(x.id)]);
  assert.match(w.comments.find((cm) => cm.id === w.question().commentId).body, /answer: A/);
  assert.equal(resumes(w).length, 1);
});

test('R6. two different answers X and Y racing: one resume record, the header reflects the winner', async () => {
  const { w } = await asking();
  const x = w.say('/agent answer Q1 A');
  const y = w.say('/agent answer Q1 B', { login: 'bob' });
  const [a, b] = await Promise.all([w.comment(x), w.comment(y)]);
  assert.deepEqual([a.run, b.run].sort(), ['false', 'true']);
  assert.equal(resumes(w).length, 1);
  const winner = resumes(w)[0].answerComment;
  assert.equal(w.question().q.answerComment, winner, 'the projection follows the claim');
  assert.equal((a.run === 'true' ? a : b).option, winner === String(x.id) ? 'A' : 'B');
});

test('R7. re-running the gate job (attempt 2) after the head advanced creates no second resume', async () => {
  const { w } = await asking();
  const c = w.say('/agent answer Q1 A');
  const runId = 777;
  w.crash('addLabels', (a) => a.labels.includes('agent:running'));
  await assert.rejects(w.comment(c, {}, { runId }), /injected crash/);
  w.push(GHI, 'feat: human push in between');
  const rerun = await w.comment(c, { GITHUB_RUN_ATTEMPT: '2' }, { runId });
  assert.deepEqual([rerun.run, rerun.reason], ['false', 'resume-already-created']);
  assert.equal(resumes(w).length, 1);
});

test('R8. answer at the limit: crash between the limit question and the answer; redelivery completes it, one limit question', async () => {
  const w = world();
  for (let i = 1; i <= 2; i++) {
    w.push(sha(0x2000 + i));
    const r = await w.start('developer');
    await w.agent(r.o);
  }
  w.push(sha(0x2003));
  await w.agent((await w.start('developer')).o, ASK); // 3rd run asks Q1
  const c = w.say('/agent answer Q1 A');
  w.crash('update', (a) => /id: Q1/.test(a.body));
  await assert.rejects(w.comment(c), /injected crash/);
  assert.equal(w.question('iteration-limit-1').q.status, 'OPEN');
  assert.equal(w.question('Q1').q.status, 'OPEN');
  const again = await w.comment(c);
  assert.equal(again.run, 'false');
  assert.equal(w.question('Q1').q.status, 'ANSWERED');
  assert.equal(w.ledger().questions.filter((x) => x.q.reason === 'iteration-limit').length, 1);
  assert.equal(resumes(w).length, 0, 'held: nothing resumed');
});

// --- /agent retry against the in-memory GitHub ------------------------------

const failedRun = async (w) => {
  w.push(ABC);
  const r = await w.start('alice');
  await w.agent(r.o, { result: { status: 'BROKEN' } });
  return r.o;
};

test('RETRY: valid retry of a FAILED run: same change and source, new run id, retry-of, trigger retry, counted', async () => {
  const w = world();
  const r1 = await failedRun(w);
  assert.equal(w.records()[0].status, 'FAILED');
  w.push(GHI, 'feat: human push after the failure');
  const out = await w.comment(w.say(`/agent retry ${r1.run_id}`));
  assert.deepEqual([out.run, out.mode, out.change_id, out.source_sha, out.retry_of, out.head_sha], ['true', 'retry', 'PR-42', ABC, r1.run_id, GHI]);
  assert.notEqual(out.run_id, r1.run_id);
  const rec = w.records()[1];
  assert.deepEqual([rec.trigger, rec.retryOf, rec.sourceSha, rec.iteration, rec.status], ['retry', r1.run_id, ABC, 2, 'RUNNING']);
  assert.equal(w.label(), 'agent:running');
  // its commits are automation; its trigger is never an external intent
  await w.agent(out, { commits: [[DEF, 'fix: second attempt']] });
  assert.equal((await w.start(APP)).decision, DECISION.IGNORE_AUTOMATION_CHANGE);
  assert.equal(w.records().filter((r) => r.trigger === 'external').length, 1);
});

test('RETRY: duplicate (sequential) is IGNORE_DUPLICATE with a hint; nothing runs twice', async () => {
  const w = world();
  const r1 = await failedRun(w);
  assert.equal((await w.comment(w.say(`/agent retry ${r1.run_id}`))).run, 'true');
  const dup = await w.comment(w.say(`/agent retry ${r1.run_id}`, { login: 'bob' }));
  assert.deepEqual([dup.run, dup.decision, dup.reason], ['false', DECISION.IGNORE_DUPLICATE, 'retry-already-created']);
  assert.equal(w.records().filter((r) => r.trigger === 'retry').length, 1);
  assert.match(w.comments[w.comments.length - 1].body, /already retried/);
});

test('RETRY: two simultaneous /agent retry for the same run: exactly one proceeds', async () => {
  const w = world();
  const r1 = await failedRun(w);
  const [a, b] = await Promise.all([w.comment(w.say(`/agent retry ${r1.run_id}`)), w.comment(w.say(`/agent retry ${r1.run_id}`, { login: 'bob' }))]);
  assert.deepEqual([a.run, b.run].sort(), ['false', 'true']);
  assert.equal(w.records().filter((r) => r.trigger === 'retry').length, 1);
});

test('RETRY: untrusted actors and bots cannot retry; nothing is written', async () => {
  const w = world();
  const r1 = await failedRun(w);
  const before = w.comments.length;
  for (const who of [{ login: 'mallory', assoc: 'NONE' }, { login: 'ci', type: 'Bot' }, { login: BOT, type: 'Bot' }]) {
    const out = await w.comment(w.say(`/agent retry ${r1.run_id}`, who));
    assert.deepEqual([out.run, out.decision], ['false', DECISION.REJECT_UNTRUSTED]);
  }
  assert.equal(w.comments.length, before + 3, 'only the three commands themselves');
  assert.equal(w.calls.includes('liveness'), false, 'no platform lookups for untrusted input');
});

test('RETRY: limit reached → WAITING_FOR_HUMAN (iteration-limit), the limit question is posted, nothing runs', async () => {
  const w = world();
  for (let i = 1; i <= 2; i++) {
    w.push(sha(0x3000 + i));
    await w.agent((await w.start('developer')).o);
  }
  w.push(sha(0x3003));
  const r3 = (await w.start('developer')).o;
  await w.agent(r3, { result: { status: 'BROKEN' } });
  const out = await w.comment(w.say(`/agent retry ${r3.run_id}`));
  assert.deepEqual([out.run, out.decision, out.reason], ['false', DECISION.WAITING_FOR_HUMAN, 'iteration-limit']);
  assert.equal(w.records().length, 3);
  assert.equal(w.question('iteration-limit-1').q.status, 'OPEN');
  assert.equal(w.label(), 'agent:waiting-human');
});

test('RETRY: chain R1 failed → retry → R2 failed → retry R2 → R3; retrying R1 again is a duplicate', async () => {
  const w = world();
  const r1 = await failedRun(w);
  const r2 = await w.comment(w.say(`/agent retry ${r1.run_id}`));
  await w.agent(r2, { result: { status: 'BROKEN' } });
  const r3 = await w.comment(w.say(`/agent retry ${r2.run_id}`));
  assert.equal(r3.run, 'true');
  assert.deepEqual(w.records().map((r) => [r.trigger, r.retryOf || '-', r.iteration]), [['external', '-', 1], ['retry', r1.run_id, 2], ['retry', r2.run_id, 3]]);
  assert.equal((await w.comment(w.say(`/agent retry ${r1.run_id}`))).reason, 'retry-already-created');
});

test('RETRY: refusals: unknown run, READY run, superseded run, open question, unverifiable execution', async () => {
  const w = world();
  const r1 = await failedRun(w);
  assert.equal((await w.comment(w.say('/agent retry 999-1'))).reason, 'unknown-run');
  w.push(GHI, 'feat: new intent');
  const r2 = (await w.start('alice')).o;
  assert.equal((await w.comment(w.say(`/agent retry ${r1.run_id}`))).reason, 'superseded');
  w.executions[r2.run_id] = 500;
  assert.equal((await w.comment(w.say(`/agent retry ${r2.run_id}`))).reason, 'run-state-unknown', 'fails closed when the platform cannot say');
  await w.agent(r2, ASK);
  assert.equal((await w.comment(w.say(`/agent retry ${r2.run_id}`))).reason, 'not-retryable', 'WAITING_FOR_HUMAN is not a failure');
  const w2 = world();
  const f = await failedRun(w2);
  w2.comments.push({ id: w2.nextId++, body: question(0, { id: 'Q9' }), user: { login: BOT, type: 'Bot' } });
  assert.equal((await w2.comment(w2.say(`/agent retry ${f.run_id}`))).reason, 'open-question');
});

// --- publish(): the trusted post-step seals the ledger ---------------------

const publishWith = async (questionText, resultOverride) => {
  const w = world();
  w.push(ABC);
  const first = await w.start('alice');
  return { w, first, run: () => w.agent(first.o, { result: resultOverride || { status: 'WAITING_FOR_HUMAN', question_file: 'q.md' }, question: questionText }) };
};
const SECRET_HANDOFF = '### Handoff\n- Completed work: reads the key from the environment\n- Blocked step (needs the secret): live call\n';

test('publish(): posts a valid question and sets waiting-human; rejects bad input without pushing', async () => {
  const ok = await publishWith(QUESTION_FILE());
  await ok.run();
  assert.equal(ok.w.comments.filter((c) => /agent-question/.test(c.body)).length, 1);
  assert.equal(ok.w.label(), 'agent:waiting-human');

  const traversal = await publishWith(QUESTION_FILE(), { status: 'WAITING_FOR_HUMAN', question_file: '../etc/passwd' });
  await assert.rejects(traversal.run, /inside RUNNER_TEMP/);

  const notQuestion = await publishWith('not a question');
  await assert.rejects(notQuestion.run, /valid OPEN/);

  const noHandoff = await publishWith(QUESTION_FILE().split('### Handoff')[0] + 'Decision needed, no handoff.');
  await assert.rejects(noHandoff.run, /Handoff/);
  assert.equal(noHandoff.w.comments.filter((c) => /agent-question/.test(c.body)).length, 0);
  assert.equal(noHandoff.w.label(), '');
  assert.equal(noHandoff.w.records()[0].failure, 'invalid-question');

  const answered = await publishWith(QUESTION_FILE().replace('status: OPEN', 'status: OPEN\nanswer-comment: 5'));
  await assert.rejects(answered.run, /answer fields/, 'an agent cannot pre-answer its own question');

  const secret = await publishWith(`<!-- agent-question\nid: S1\ntype: HUMAN_SECRET\nstatus: OPEN\n-->\n\n## Secret needed\n\n${SECRET_HANDOFF}`);
  await secret.run();
  assert.equal(secret.w.label(), 'agent:waiting-human');
});

test('publish(): a question id already used in the pull request is refused', async () => {
  const { w } = await asking();
  const resumed = await w.comment(w.say('/agent answer Q1 A'));
  await assert.rejects(() => w.agent(resumed, ASK), /already used/);
});

test('publish(): the agent cannot emit a circuit-breaker question, and a failed publish marks the run FAILED', async () => {
  const w = world();
  w.push(ABC);
  const first = await w.start('alice');
  const forgedLimit = QUESTION_FILE('iteration-limit-1').replace('decision-key', 'reason: iteration-limit\ndecision-key');
  await assert.rejects(() => w.agent(first.o, { result: { status: 'WAITING_FOR_HUMAN', question_file: 'q.md' }, question: forgedLimit }), /reason/);
  assert.equal(w.records()[0].status, 'FAILED');
  assert.equal(w.label(), '', 'a failed run is neither running nor waiting');
  assert.equal(w.comments.filter((c) => /agent-question/.test(c.body)).length, 0, 'the rejected question was not posted');
});

test('publish(): a run without a valid result is FAILED in the ledger, not silently READY, and nothing is pushed', async () => {
  const w = world();
  w.push(ABC);
  const first = await w.start('alice');
  const out = await w.agent(first.o, { commits: [[DEF, 'fix']], result: { status: 'DONE' } });
  assert.ok(out.failed);
  assert.deepEqual([w.records()[0].status, w.records()[0].failure, w.calls.includes('push')], ['FAILED', 'invalid-result', false]);
  assert.match(w.comments[w.comments.length - 1].body, /\/agent retry/, 'the failure says how to retry');
});

test('publish(): refuses to run without a ledger record for AGENT_RUN_ID', async () => {
  const w = world();
  w.push(ABC);
  w.fs.writeFileSync(`${TMP}/agent-result.json`, JSON.stringify({ status: 'READY' }));
  const core = { setOutput() {}, info() {}, setFailed() {} };
  await assert.rejects(() => gate.publish({ github: w.github, context: { repo: { owner, repo } }, core, fs: w.fs, env: w.envOf({ AGENT_PR_NUMBER: '42', AGENT_RUN_ID: '999-1', AGENT_CHANGE_ID: 'PR-42' }) }), /no run record/);
});

test('publish(): a stale run cannot be published after its retry replaced it', async () => {
  const { w } = await asking();
  const c = w.say('/agent answer Q1 A');
  w.crash('addLabels', (a) => a.labels.includes('agent:running'));
  await assert.rejects(w.comment(c), /injected crash/);
  const orphan = resumes(w)[0];
  await w.comment(w.say(`/agent retry ${orphan.runId}`));
  const zombie = { run_id: orphan.runId, change_id: 'PR-42', head_sha: orphan.headSha, trailers_file: `${TMP}/agent-trailers.txt` };
  await assert.rejects(() => w.agent(zombie), /already STALE/);
});

// --- gitCli: the real git calls publish makes --------------------------------

test('gitCli: repository hooks are disabled, the push is a compare-and-swap, the token never appears in errors', () => {
  const calls = [];
  const exec = (cmd, args) => {
    calls.push(args);
    if (args.includes('push')) { const e = new Error(`Command failed: git ${args.join(' ')}`); e.status = 1; throw e; }
    return 'x';
  };
  const g = gate.gitCli({ token: 's3cr3t', serverUrl: 'https://github.com', owner, repo, execFileSync: exec });
  let err;
  try { g.push('agent/x', ABC); } catch (e) { err = e; }
  assert.ok(err);
  assert.doesNotMatch(err.message, /s3cr3t/);
  const push = calls[0];
  assert.ok(push.includes('core.hooksPath=/dev/null'));
  assert.ok(push.includes('--no-verify'));
  assert.ok(push.includes(`--force-with-lease=refs/heads/agent/x:${ABC}`), 'the server refuses the update unless the branch is still at the start commit');
  assert.ok(push.includes('HEAD:refs/heads/agent/x'));
  assert.throws(() => gate.gitCli({ token: '', serverUrl: 'https://github.com', owner, repo, execFileSync: exec }).remoteHead('agent/x'), /AGENT_PUSH_TOKEN/);
});

test('gitCli + pushProduced against REAL git: produced push, compare-and-swap race, moved branch, hooks ignored', async (t) => {
  const cp = require('node:child_process');
  const os = require('node:os');
  const fsx = require('node:fs');
  try { cp.execFileSync('git', ['--version'], { stdio: 'ignore' }); } catch { t.skip('git not available'); return; }
  const dir = fsx.mkdtempSync(path.join(os.tmpdir(), 'agent-gate-'));
  const g = (cwd, ...args) => cp.execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=main', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const remote = path.join(dir, 'remote.git');
  const seed = path.join(dir, 'seed');
  g(dir, 'init', '--bare', remote);
  g(dir, 'init', seed);
  fsx.writeFileSync(path.join(seed, 'a.txt'), 'a');
  g(seed, 'add', '.');
  g(seed, 'commit', '-m', 'feat: external change');
  g(seed, 'push', remote, 'HEAD:refs/heads/agent/x');
  const start = g(seed, 'rev-parse', 'HEAD');
  const rec = { runId: '100-1', changeId: 'PR-42', sourceSha: start, headSha: start };
  // publish's view: the job's checkout. The https remote (with token) is redirected to the local bare repository.
  const job = (name, { beforePush } = {}) => {
    const cwd = path.join(dir, name);
    g(dir, 'clone', '-q', remote, cwd);
    g(cwd, 'checkout', '-q', '--detach', start);
    const exec = (cmd, args, opts) => {
      if (args.includes('push') && beforePush) beforePush();
      return cp.execFileSync(cmd, args.map((a) => (a.startsWith('https://') ? remote : a)), opts);
    };
    return { cwd, git: gate.gitCli({ token: 't0k', serverUrl: 'https://github.com', owner, repo, cwd, execFileSync: exec }) };
  };
  const agentCommit = (cwd, msg) => { fsx.writeFileSync(path.join(cwd, `${msg.length}.txt`), msg); g(cwd, 'add', '.'); g(cwd, 'commit', '-q', '-m', msg); return g(cwd, 'rev-parse', 'HEAD'); };
  const trailers = gate.formatTrailers({ changeId: 'PR-42', sourceSha: start, runId: '100-1' });
  const branch = () => g(remote, 'rev-parse', 'refs/heads/agent/x');
  try {
    // 1. normal run: a repository hook must not run; produced is exactly the job's commit
    const ok = job('ok');
    fsx.writeFileSync(path.join(ok.cwd, '.git', 'hooks', 'pre-push'), '#!/bin/sh\necho ran > "$GIT_DIR/../HOOK_RAN"\n', { mode: 0o755 });
    const d = agentCommit(ok.cwd, `fix: agent work\n\n${trailers}`);
    let recorded = null;
    const res = await gate.pushProduced({ git: ok.git, rec, ref: 'agent/x', recordProduced: (r) => { recorded = r; assert.equal(branch(), start, 'recorded BEFORE the push'); } });
    assert.deepEqual([res, recorded, branch()], [{ produced: [d] }, [d], d]);
    assert.equal(fsx.existsSync(path.join(ok.cwd, 'HOOK_RAN')), false, 'repository hooks are ignored');

    // 2. a human pushes H between publish's check and its push: the compare-and-swap refuses; H is kept
    const humanClone = path.join(dir, 'human');
    g(dir, 'clone', '-q', remote, humanClone);
    g(humanClone, 'checkout', '-q', 'agent/x');
    let humanPushed = false;
    const racing = job('race', {
      beforePush: () => { const h = agentCommit(humanClone, `feat: human\n\n${trailers}`); g(humanClone, 'push', '-q', remote, `${h}:refs/heads/agent/x`); humanPushed = true; },
    });
    const rec2 = { ...rec, headSha: d, sourceSha: start };
    g(racing.cwd, 'fetch', '-q', remote, 'agent/x');
    g(racing.cwd, 'checkout', '-q', '--detach', d);
    agentCommit(racing.cwd, `fix: second\n\n${trailers}`);
    const raced = await gate.pushProduced({ git: racing.git, rec: rec2, ref: 'agent/x', recordProduced: () => {} });
    assert.equal(humanPushed, true, 'the human push really landed between the check and the push');
    assert.equal(raced.failure, 'push-failed');
    assert.equal(branch(), g(humanClone, 'rev-parse', 'HEAD'), 'the human commit was not overwritten');

    // 2b. the case only the compare-and-swap catches: the branch is rewound to an ANCESTOR (a plain push would
    // fast-forward over it). The server must refuse because the branch no longer points at the recorded start.
    const current = branch();
    const rewind = job('rewind', { beforePush: () => g(humanClone, 'push', '-q', '--force', remote, `${start}:refs/heads/agent/x`) });
    g(rewind.cwd, 'fetch', '-q', remote, 'agent/x');
    g(rewind.cwd, 'checkout', '-q', '--detach', current);
    agentCommit(rewind.cwd, `fix: third\n\n${trailers}`);
    const cas = await gate.pushProduced({ git: rewind.git, rec: { ...rec, headSha: current }, ref: 'agent/x', recordProduced: () => {} });
    assert.equal(cas.failure, 'push-failed', 'refused by the lease, not by fast-forward rules');
    assert.equal(branch(), start, 'the rewind (a human decision) stands');
    g(humanClone, 'push', '-q', '--force', remote, `${current}:refs/heads/agent/x`);

    // 3. the branch already moved before publish: branch-moved, nothing recorded, nothing pushed
    const late = job('late');
    agentCommit(late.cwd, `fix: late\n\n${trailers}`);
    const before = branch();
    const moved = await gate.pushProduced({ git: late.git, rec, ref: 'agent/x', recordProduced: () => assert.fail('must not record') });
    assert.deepEqual([moved, branch()], [{ produced: [], failure: 'branch-moved' }, before]);
  } finally {
    fsx.rmSync(dir, { recursive: true, force: true });
  }
});

// --- CI is never affected ---------------------------------------------------

const fsSync = require('node:fs');
const wf = (name) => fsSync.readFileSync(path.join(__dirname, '..', 'workflows', name), 'utf8');

test('5./16. loop protection is an agent-job condition only: nothing in the examples can suppress CI', () => {
  const run = wf('agent-run.yml.example');
  const resume = wf('agent-resume.yml.example');
  for (const text of [run, resume, gate.formatTrailers({ changeId: 'PR-42', sourceSha: ABC, runId: '1-1' })]) {
    assert.doesNotMatch(text, /\[(skip ci|ci skip|no ci|skip actions|actions skip)\]/i);
    assert.doesNotMatch(text, /paths-ignore|branches-ignore/);
  }
  assert.match(run, /types: \[opened, reopened, synchronize\]/, 'the gate sees every push, including the agent\'s own');
  assert.match(run, /^  agent:\n(?:.*\n)*?    needs: gate\n    if: needs\.gate\.outputs\.run == 'true'/m, 'only the agent job is conditional on the gate');
  assert.doesNotMatch(run, /github\.actor/, 'the actor is evidence inside the gate, never the sole switch');
});

test('8. concurrency: one group per PR shared by run and resume, never cancelling a run in progress', () => {
  const group = (text) => (/^concurrency:\n  group: (.+)\n  cancel-in-progress: (\w+)/m.exec(text) || []).slice(1);
  const [runGroup, runCancel] = group(wf('agent-run.yml.example'));
  const [resumeGroup, resumeCancel] = group(wf('agent-resume.yml.example'));
  assert.equal(runGroup, 'agent-${{ github.event.pull_request.number }}');
  assert.equal(resumeGroup, 'agent-${{ github.event.issue.number }}', 'same group name as agent-run for the same PR number');
  assert.deepEqual([runCancel, resumeCancel], ['false', 'false']);
});

test('workflows: the push credential reaches only the trusted publish step; the identity is configured for every gate', () => {
  for (const name of ['agent-run.yml.example', 'agent-resume.yml.example']) {
    const text = wf(name);
    const steps = text.split(/\n      - /);
    const agentStep = steps.find((s) => /run: \.\/scripts\/run-agent\.sh/.test(s));
    const publishStep = steps.find((s) => /gate\.publish\(/.test(s));
    assert.ok(agentStep && publishStep, name);
    assert.doesNotMatch(agentStep.replace(/^\s*#.*$/gm, ''), /AGENT_PUSH_TOKEN|GH_TOKEN|github\.token/, `${name}: the agent step has no push credential`);
    assert.match(publishStep, /AGENT_PUSH_TOKEN:/, `${name}: publish pushes`);
    assert.match(text, /AGENT_PUSH_ACTOR: \$\{\{ vars\.AGENT_PUSH_ACTOR \}\}/, `${name}: gate needs the identity`);
    assert.match(text, /AGENT_HEAD_REF:/, `${name}: publish knows the branch`);
  }
  const resume = wf('agent-resume.yml.example');
  assert.match(resume, /actions: read/, 'retry reads the execution state of a RUNNING record (STALE detection)');
  assert.match(resume, /startsWith\(github\.event\.comment\.body, '\/agent retry '\)/);
  assert.match(resume, /gate\.onComment\(/);
});
