'use strict';
// Reference implementation of the deterministic parts of protocol/HUMAN-IN-THE-LOOP.md
// for GitHub pull requests. Dependency-free; meant for actions/github-script.
//
// Security properties (see protocol/SECURITY.md):
//  - comment text is data: parsed with strict grammars, never executed or interpolated;
//  - a question exists only if published by BOT_LOGIN, and its header starts the comment;
//  - only trusted actors (platform-reported association or allowlist, never a bot) answer or retry;
//  - the ledger decides: the first resume record of a question claims it; the header follows;
//  - fork PRs are never resumed.

const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const OPTION_RE = /^[A-Za-z0-9_-]{1,32}$/;
const DECISION_KEY_RE = /^[a-z0-9_.-]{1,64}$/;
const LOGIN_RE = /^[A-Za-z0-9-]{1,39}$/;
const TIME_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
const HEADER_RE = /^\s*<!--[ \t]*agent-question[ \t]*\r?\n([\s\S]*?)-->/;
const FIELD_RE = /^([a-z-]+):[ \t]*([A-Za-z0-9_.,:+-]*)[ \t]*$/;
const COMMAND_RE = /^\/agent[ \t]+answer[ \t]+([A-Za-z0-9_.-]{1,64})[ \t]+([A-Za-z0-9_-]{1,32})(?:[ \t]+(\S.{0,499}))?[ \t]*$/;
const RETRY_RE = /^\/agent[ \t]+retry[ \t]+([A-Za-z0-9_.-]{1,64})[ \t]*$/;

const TYPES = new Set(['HUMAN_DECISION', 'HUMAN_SECRET']);
const STATUSES = new Set(['OPEN', 'ANSWERED', 'CANCELLED']);
const REASONS = new Set(['iteration-limit']);
const LABELS = { RUNNING: 'agent:running', WAITING: 'agent:waiting-human', READY: 'agent:ready' };
const HINTS = {
  'already-answered': 'That question was already answered (or cancelled); the answer was not applied.',
  'resume-already-created': 'That question was already answered and its resume run exists; nothing was repeated.',
  'invalid-option': 'That option is not one of the question\'s options; the answer was not applied.',
  'unknown-question': 'No open question with that id was found in this pull request.',
  'ambiguous-question': 'More than one question uses that id; the answer was not applied.',
  'unknown-run': 'No agent run with that id was found in this pull request.',
  'not-retryable': 'Only a FAILED or STALE run can be retried; that run was not retried.',
  'run-active': 'That run is still executing; it was not retried.',
  'run-state-unknown': 'Could not verify that the run has ended; it was not retried.',
  superseded: 'A later run exists in this pull request; only the latest run can be retried.',
  'retry-already-created': 'That run was already retried; nothing was repeated.',
};

/** Parses the machine-readable header of a question comment. Returns null if invalid. */
function parseQuestion(body) {
  const m = HEADER_RE.exec(String(body || ''));
  if (!m) return null;
  const f = new Map();
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = FIELD_RE.exec(line);
    if (!kv || f.has(kv[1])) return null;
    f.set(kv[1], kv[2]);
  }
  const id = f.get('id');
  const type = f.get('type');
  const status = f.get('status');
  if (!ID_RE.test(id || '') || !TYPES.has(type) || !STATUSES.has(status)) return null;
  let options = f.has('options') ? f.get('options').split(',') : type === 'HUMAN_SECRET' ? ['configured'] : null;
  if (!options || options.some((o) => !OPTION_RE.test(o)) || new Set(options).size !== options.length) return null;
  if (type === 'HUMAN_SECRET' && (options.length !== 1 || options[0] !== 'configured')) return null;
  const decisionKey = f.get('decision-key') || '';
  if (decisionKey && !DECISION_KEY_RE.test(decisionKey)) return null;
  const change = f.get('change') || '';
  if (change && !ID_RE.test(change)) return null;
  // `reason`, `window` and `last-run` are set only by the gate itself (circuit breaker); the answer fields only by markAnswered.
  const reason = f.get('reason') || '';
  if (reason && !REASONS.has(reason)) return null;
  const answerComment = f.get('answer-comment') || '';
  if (answerComment && !/^\d{1,15}$/.test(answerComment)) return null;
  const answeredBy = f.get('answered-by') || '';
  if (answeredBy && !LOGIN_RE.test(answeredBy)) return null;
  const answeredAt = f.get('answered-at') || '';
  if (answeredAt && !TIME_RE.test(answeredAt)) return null;
  const window = f.get('window') || '';
  if (window && !/^[1-9]\d{0,5}$/.test(window)) return null;
  const lastRun = f.get('last-run') || '';
  if (lastRun && !ID_RE.test(lastRun)) return null;
  return { id, type, status, options, decisionKey, change, reason, answerComment, answeredBy, answeredAt, window, lastRun };
}

// Required "### Handoff" lines per question type (protocol/HUMAN-IN-THE-LOOP.md, "Interrupting safely").
const HANDOFF_HEADING_RE = /^### Handoff[ \t]*$/m;
const HANDOFF_LINES = {
  HUMAN_DECISION: ['- Completed independent work:', '- Not started (depends on this decision):'],
  HUMAN_SECRET: ['- Completed work:', '- Blocked step (needs the secret):'],
};

/** Returns an error message when the handoff is missing or lacks a filled required line, else null. */
function validateHandoff(body, type) {
  const text = String(body || '');
  const m = HANDOFF_HEADING_RE.exec(text);
  if (!m) return 'question has no "### Handoff" section';
  const section = text.slice(m.index + m[0].length).split(/^#{1,3} /m)[0].split(/\r?\n/);
  for (const prefix of HANDOFF_LINES[type] || []) {
    const line = section.find((l) => l.startsWith(prefix));
    if (!line || !line.slice(prefix.length).trim()) return `handoff is missing a filled "${prefix}" line`;
  }
  return null;
}

/** Parses `/agent answer <id> <option> [note]` from the FIRST line only. */
function parseCommand(body) {
  const first = String(body || '').split(/\r?\n/, 1)[0];
  const m = COMMAND_RE.exec(first);
  return m ? { id: m[1], option: m[2], note: m[3] || '' } : null;
}

/** Parses `/agent retry <run-id>` from the FIRST line only. */
function parseRetryCommand(body) {
  const first = String(body || '').split(/\r?\n/, 1)[0];
  const m = RETRY_RE.exec(first);
  return m ? { runId: m[1] } : null;
}

function parseTrustConfig(env) {
  const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
  const raw = list(env.AGENT_TRUSTED_ASSOCIATIONS);
  return {
    associations: raw.length ? raw.filter((a) => a.toUpperCase() !== 'NONE').map((a) => a.toUpperCase()) : ['OWNER', 'MEMBER', 'COLLABORATOR'],
    actors: list(env.AGENT_TRUSTED_ACTORS).map((a) => a.toLowerCase()),
  };
}

/** Trust comes from platform data (login, type, author_association), never from comment text. */
function isTrustedActor({ login, type, association }, trust) {
  if (!login || type === 'Bot') return false;
  if (trust.actors.includes(String(login).toLowerCase())) return true;
  return trust.associations.includes(String(association || '').toUpperCase());
}

const sameLogin = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

/** Shared by every command: who may speak to the gate. Returns a rejection reason or null. */
function commandSender(comment, botLogin, trust) {
  const user = comment.user || {};
  if (!botLogin) return 'bot-login-not-configured';
  if (user.type === 'Bot' || sameLogin(user.login, botLogin)) return 'bot';
  if (!isTrustedActor({ login: user.login, type: user.type, association: comment.author_association }, trust)) return 'untrusted';
  return null;
}

/**
 * Pure decision. comment: the new comment ({ body, user:{login,type}, author_association });
 * comments: every comment of the PR; claimed: ids of questions that already have a resume record (see collectLedger).
 * Returns { action:'ignore'|'answer', reason, hint?, ... }.
 */
function decide({ comment, comments, botLogin, trust, claimed = new Set() }) {
  const ignore = (reason, hint, extra) => ({ action: 'ignore', reason, hint: hint || null, ...extra });
  const rejected = commandSender(comment, botLogin, trust);
  if (rejected) return ignore(rejected);
  const cmd = parseCommand(comment.body);
  if (!cmd) return ignore('no-command');

  const questions = [];
  for (const c of comments) {
    if (!c.user || !sameLogin(c.user.login, botLogin)) continue;
    const q = parseQuestion(c.body);
    if (q) questions.push({ comment: c, q });
  }
  const matches = questions.filter((x) => x.q.id === cmd.id);
  if (matches.length === 0) return ignore('unknown-question', 'unknown-question');
  if (matches.length > 1) return ignore('ambiguous-question', 'ambiguous-question');
  const { comment: qc, q } = matches[0];
  if (q.status !== 'OPEN' || claimed.has(q.id)) return ignore('already-answered', 'already-answered', { questionCommentId: qc.id, question: q });
  if (!q.options.includes(cmd.option)) return ignore('invalid-option', 'invalid-option');

  const remainingOpen = questions.filter((x) => x.q.status === 'OPEN' && !claimed.has(x.q.id) && x.comment.id !== qc.id).length;
  return {
    action: 'answer',
    questionCommentId: qc.id,
    question: q,
    option: cmd.option,
    note: cmd.note,
    answeredBy: (comment.user || {}).login,
    answerCommentId: comment.id,
    remainingOpen,
    resume: remainingOpen === 0,
  };
}

/**
 * Projects an answer onto a question comment: OPEN -> ANSWERED, recording who, what, which comment and when.
 * Fields that are unknown (e.g. the answer comment was deleted before a repair) are left out. Header stays valid.
 */
function markAnswered(body, { by, option, commentId, at }) {
  const extra = [];
  if (by && LOGIN_RE.test(by)) extra.push(`answered-by: ${by}`);
  if (option && OPTION_RE.test(option)) extra.push(`answer: ${option}`);
  if (commentId) extra.push(`answer-comment: ${commentId}`);
  if (at && TIME_RE.test(at)) extra.push(`answered-at: ${at}`);
  return String(body).replace(HEADER_RE, (whole, inner) => {
    const lines = inner.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.replace(/^status:.*$/, 'status: ANSWERED'));
    return `${whole.slice(0, whole.indexOf('agent-question'))}agent-question\n${[...lines, ...extra].join('\n')}\n-->`;
  }) + (by && option ? `\n\n> Answered by ${by}: \`${option}\`.\n` : '\n\n> Answered.\n');
}

// --------------------------------------------------------------------------
// Loop prevention (protocol/LOOP-PREVENTION.md): provenance and the run ledger
// --------------------------------------------------------------------------

const DECISION = Object.freeze({
  RUN_AGENT: 'RUN_AGENT',
  RESUME_AGENT: 'RESUME_AGENT',
  RETRY_AGENT: 'RETRY_AGENT',
  IGNORE_AUTOMATION_CHANGE: 'IGNORE_AUTOMATION_CHANGE',
  IGNORE_DUPLICATE: 'IGNORE_DUPLICATE',
  WAITING_FOR_HUMAN: 'WAITING_FOR_HUMAN',
  REJECT_UNTRUSTED: 'REJECT_UNTRUSTED',
  REJECT_INVALID: 'REJECT_INVALID',
});
const DEFAULT_MAX_ITERATIONS = 3;
const MAX_ITERATIONS_CAP = 100;
const MAX_PRODUCED = 200;
const SHA_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const REF_RE = /^(?!\/)(?!.*\/\/)(?!.*\.\.)(?!.*\/$)(?!.*\.lock$)[A-Za-z0-9._/-]{1,200}$/;
const RUN_HEADER_RE = /^\s*<!--[ \t]*agent-run[ \t]*\r?\n([\s\S]*?)-->/;
// STALE: the ledger said RUNNING but no execution of that run exists any more (set when a retry replaces it).
const RUN_STATUSES = new Set(['RUNNING', 'READY', 'WAITING_FOR_HUMAN', 'FAILED', 'STALE']);
const RUN_TRIGGERS = new Set(['external', 'resume', 'retry']);
const FAILURES = new Set([
  'invalid-result', 'invalid-question', 'misconfigured', 'history-rewritten', 'missing-provenance',
  'too-many-commits', 'branch-moved', 'push-failed',
]);
const TRAILER_LINE_RE = /^([A-Za-z][A-Za-z-]*):[ \t]*(.*?)[ \t]*$/;

/**
 * Reads the provenance trailers an automated run puts on its commits. Strict: exact keys, one of each,
 * valid values, all in the LAST paragraph. Returns null for anything else. A trailer is only a CLAIM:
 * it counts only for a commit the run's trusted publish step recorded in `produced` (see gateChange).
 */
function parseTrailers(message) {
  const paragraphs = String(message || '').replace(/\r\n?/g, '\n').trimEnd().split(/\n[ \t]*\n/);
  if (paragraphs.length < 2) return null;
  const seen = new Map();
  for (const line of paragraphs[paragraphs.length - 1].split('\n')) {
    const m = TRAILER_LINE_RE.exec(line);
    if (!m) return null;
    if (/^Agent-|^Source-SHA$/.test(m[1])) {
      if (seen.has(m[1])) return null;
      seen.set(m[1], m[2]);
    }
  }
  const run = seen.get('Agent-Run');
  const change = seen.get('Agent-Change');
  const source = seen.get('Source-SHA');
  if (seen.get('Agent-Generated') !== 'true' || !ID_RE.test(run || '') || !ID_RE.test(change || '') || !SHA_RE.test(source || '')) return null;
  return { run, change, source };
}

/** The trailer block a runner hands to the agent step; every commit of the run must carry it. */
function formatTrailers({ changeId, sourceSha, runId }) {
  return `Agent-Generated: true\nAgent-Run: ${runId}\nAgent-Change: ${changeId}\nSource-SHA: ${sourceSha}`;
}

const carriesRun = (message, r) => {
  const t = parseTrailers(message);
  return Boolean(t && t.run === r.runId && t.change === r.changeId && t.source === r.sourceSha);
};

/** Parses the header of a run record comment. Returns null if invalid. */
function parseRunRecord(body) {
  const m = RUN_HEADER_RE.exec(String(body || ''));
  if (!m) return null;
  const f = new Map();
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = FIELD_RE.exec(line);
    if (!kv || f.has(kv[1])) return null;
    f.set(kv[1], kv[2]);
  }
  const changeId = f.get('change-id');
  const sourceSha = f.get('source-sha');
  const headSha = f.get('head-sha');
  const runId = f.get('run-id');
  const trigger = f.get('trigger');
  const status = f.get('status');
  const iteration = f.get('iteration');
  const question = f.get('question') || '';
  const resumeOf = f.get('resume-of') || '';
  const resumeKey = f.get('resume-key') || '';
  const answerComment = f.get('answer-comment') || '';
  const retryOf = f.get('retry-of') || '';
  const failure = f.get('failure') || '';
  const produced = f.get('produced') ? f.get('produced').split(',') : [];
  if (!ID_RE.test(changeId || '') || !ID_RE.test(runId || '')) return null;
  if (!SHA_RE.test(sourceSha || '') || !SHA_RE.test(headSha || '')) return null;
  if (!RUN_TRIGGERS.has(trigger) || !RUN_STATUSES.has(status) || !/^[1-9]\d{0,5}$/.test(iteration || '')) return null;
  if ([question, resumeOf, resumeKey, retryOf].some((v) => v && !ID_RE.test(v))) return null;
  if (answerComment && !/^\d{1,15}$/.test(answerComment)) return null;
  if (failure && !FAILURES.has(failure)) return null;
  // The claim key must be complete: a resume names its question, a retry the run it replaces.
  if (trigger === 'resume' && (!resumeKey || !answerComment)) return null;
  if (trigger === 'retry' && !retryOf) return null;
  if (produced.length > MAX_PRODUCED || produced.some((s) => !SHA_RE.test(s))) return null;
  return {
    changeId, sourceSha, headSha, runId, trigger, status, iteration: Number(iteration), produced, question, resumeOf,
    resumeKey, answerComment, retryOf, failure,
  };
}

/** Renders a run record as a bot comment: machine-readable header + one human-readable line. */
function formatRunRecord(r) {
  const lines = [
    `change-id: ${r.changeId}`, `source-sha: ${r.sourceSha}`, `head-sha: ${r.headSha}`, `run-id: ${r.runId}`,
    `trigger: ${r.trigger}`, `status: ${r.status}`, `iteration: ${r.iteration}`,
  ];
  if (r.produced && r.produced.length) lines.push(`produced: ${r.produced.join(',')}`);
  if (r.question) lines.push(`question: ${r.question}`);
  if (r.resumeOf) lines.push(`resume-of: ${r.resumeOf}`);
  if (r.resumeKey) lines.push(`resume-key: ${r.resumeKey}`);
  if (r.answerComment) lines.push(`answer-comment: ${r.answerComment}`);
  if (r.retryOf) lines.push(`retry-of: ${r.retryOf}`);
  if (r.failure) lines.push(`failure: ${r.failure}`);
  const why = r.failure ? ` (${r.failure})` : '';
  return `<!-- agent-run\n${lines.join('\n')}\n-->\n\nAgent run \`${r.runId}\` (${r.trigger}, iteration ${r.iteration}) on \`${r.sourceSha.slice(0, 7)}\`: **${r.status}**${why}\n`;
}

/**
 * The idempotency key of a run. One logical run per key; the lowest comment id holds it.
 * external: one run per source commit. resume: one per question. retry: one per replaced run.
 */
function claimKey(r) {
  if (r.trigger === 'resume') return `resume|${r.changeId}|${r.resumeKey}`;
  if (r.trigger === 'retry') return `retry|${r.changeId}|${r.retryOf}`;
  return `external|${r.changeId}|${r.sourceSha}`;
}

/**
 * Everything persisted about a change, rebuilt from its comments on every event (nothing lives on the
 * runner). Only comments authored by botLogin count. Ordered by comment id, which the platform assigns.
 * Derived, never written: the effective state of each question, the claim winners and the budget windows.
 */
function collectLedger(comments, botLogin) {
  const all = [];
  const questions = [];
  const byId = new Map(comments.map((c) => [c.id, c]));
  const mine = [...comments].filter((c) => c.user && sameLogin(c.user.login, botLogin)).sort((a, b) => a.id - b.id);
  for (const c of mine) {
    const r = parseRunRecord(c.body);
    if (r) { all.push({ commentId: c.id, ...r }); continue; }
    const q = parseQuestion(c.body);
    if (q) questions.push({ commentId: c.id, comment: c, q });
  }
  // A claim left behind by a crashed loser shares its key with the winner: only the lowest id counts.
  const seen = new Set();
  const records = [];
  const voided = [];
  for (const r of all) {
    const k = claimKey(r);
    if (seen.has(k)) { voided.push(r); continue; }
    seen.add(k);
    records.push(r);
  }
  // The resume record IS the claim of a question: OPEN + claim = CLAIMED, until the header is projected.
  const claims = new Map(records.filter((r) => r.trigger === 'resume').map((r) => [r.resumeKey, r]));
  for (const x of questions) x.state = x.q.status === 'OPEN' && claims.has(x.q.id) ? 'CLAIMED' : x.q.status;

  // Budget windows: each answered iteration-limit question is a human acknowledgement that opens a new one.
  // The answer comment (platform data) says who and when; the header is the fallback if it was deleted.
  const acknowledgements = questions.filter((x) => x.q.reason === 'iteration-limit').map((x) => {
    const claim = claims.get(x.q.id);
    const answerComment = Number(x.q.answerComment || (claim && claim.answerComment) || 0);
    if (!answerComment) return null;
    const c = byId.get(answerComment);
    return {
      question: x.q.id, questionCommentId: x.commentId, answerComment, heldAtRun: x.q.lastRun || null,
      by: (c && c.user && c.user.login) || x.q.answeredBy || null,
      at: (c && c.created_at) || x.q.answeredAt || null,
    };
  }).filter(Boolean).sort((a, b) => a.answerComment - b.answerComment);

  return {
    records,
    voided,
    questions,
    claims,
    openQuestions: questions.filter((x) => x.state === 'OPEN').length,
    acknowledgements,
    // Runs before the newest acknowledgement no longer count toward the breaker (they stay in the ledger).
    epochStart: acknowledgements.length ? acknowledgements[acknowledgements.length - 1].answerComment : 0,
  };
}

/** Budget window (1-based) a ledger position belongs to. */
const windowAt = (ledger, commentId) => 1 + ledger.acknowledgements.filter((a) => a.answerComment < commentId).length;

/**
 * Audit view of a change, derived from the ledger only: every run (history is never reset), how often the
 * circuit breaker opened, and each human acknowledgement (who, when, which run was active).
 */
function auditChange(ledger, changeId) {
  const runs = ledger.records.filter((r) => r.changeId === changeId);
  return {
    totalRuns: runs.length,
    runs: runs.map((r) => ({
      runId: r.runId, trigger: r.trigger, status: r.status, iteration: r.iteration, window: windowAt(ledger, r.commentId),
      resumeOf: r.resumeOf || null, retryOf: r.retryOf || null, failure: r.failure || null,
    })),
    breakerOpened: ledger.questions.filter((x) => x.q.reason === 'iteration-limit').length,
    currentWindow: ledger.acknowledgements.length + 1,
    acknowledgements: ledger.acknowledgements.map((a, i) => {
      const before = runs.filter((r) => r.commentId < a.answerComment);
      return {
        question: a.question, by: a.by, at: a.at, answerComment: a.answerComment, opensWindow: i + 2,
        heldAtRun: a.heldAtRun, activeRun: before.length ? before[before.length - 1].runId : null,
      };
    }),
  };
}

const PUSH_ACTOR_RE = /^[A-Za-z0-9-]{1,39}(?:\[bot\])?$/;

/**
 * Gate configuration. In `github` mode (the default) the automation identity is mandatory: without it the
 * gate fails closed. `local` mode (tests, local dry runs) must be declared and is refused inside Actions.
 */
function parseGateConfig(env) {
  const n = /^\d{1,3}$/.test(String(env.AGENT_MAX_ITERATIONS || '').trim()) ? Number(env.AGENT_MAX_ITERATIONS) : 0;
  const mode = String(env.AGENT_GATE_MODE || '').trim() || 'github';
  const pushActor = String(env.AGENT_PUSH_ACTOR || '').trim();
  let error = '';
  if (mode !== 'github' && mode !== 'local') error = 'invalid-gate-mode';
  else if (mode === 'local' && String(env.GITHUB_ACTIONS || '').toLowerCase() === 'true') error = 'local-mode-in-actions';
  else if (mode === 'github' && !pushActor) error = 'push-actor-not-configured';
  else if (pushActor && !PUSH_ACTOR_RE.test(pushActor)) error = 'invalid-push-actor';
  return {
    mode,
    pushActor,
    maxIterations: n >= 1 && n <= MAX_ITERATIONS_CAP ? n : DEFAULT_MAX_ITERATIONS,
    error,
  };
}

/** Runs of this change that count toward the circuit breaker: those after the last acknowledgement. */
const iterationsUsed = (records, ledger) => records.filter((r) => r.commentId > ledger.epochStart).length;

/**
 * Pure decision for a pull_request event. commits: every commit of the PR, oldest first, as
 * [{ sha, message }]; ledger: collectLedger() of the PR's comments. Flow (see protocol/LOOP-PREVENTION.md):
 *   configured? -> valid event? -> trusted source? -> anything not produced by a run pending? ->
 *   waiting for a human? -> iteration limit reached? -> RUN_AGENT
 * A commit is "produced" only when a run's trusted publish step recorded it (before pushing it itself) AND it
 * carries that run's provenance. Trailers alone never qualify a commit. Pending are the commits after the last
 * run start that no run produced; the event's own sha is not trusted to say more.
 */
function gateChange({ changeId, headSha, sender, fork, state, commits, ledger, config }) {
  const out = (decision, reason, extra) => ({ decision, reason, ...extra });
  if (config.error) return out(DECISION.REJECT_INVALID, config.error);
  const valid = ID_RE.test(changeId || '') && SHA_RE.test(headSha || '') && Array.isArray(commits) && commits.length > 0
    && commits.every((c) => c && SHA_RE.test(c.sha || ''));
  if (!valid) return out(DECISION.REJECT_INVALID, 'invalid-event');
  if (commits[commits.length - 1].sha !== headSha) return out(DECISION.REJECT_INVALID, 'commits-out-of-date');
  if (fork) return out(DECISION.REJECT_UNTRUSTED, 'fork');
  if (state !== 'open') return out(DECISION.REJECT_INVALID, 'not-open');

  const records = ledger.records.filter((r) => r.changeId === changeId);
  const starts = new Set();
  const producedBy = new Map();
  for (const r of records) { starts.add(r.sourceSha); starts.add(r.headSha); r.produced.forEach((s) => producedBy.set(s, r)); }
  const isProduced = (c) => { const r = producedBy.get(c.sha); return Boolean(r && carriesRun(c.message, r)); };
  // The cursor is the last commit a run STARTED from. Commits a run produced are skipped, but do not
  // move it: a human commit pushed while the agent was working sits before the agent's commit and must
  // not be swallowed as history.
  let cursor = -1;
  commits.forEach((c, i) => { if (starts.has(c.sha)) cursor = i; });
  const pending = commits.slice(cursor + 1).filter((c) => !isProduced(c));

  if (pending.length === 0) {
    if (starts.has(headSha)) return out(DECISION.IGNORE_DUPLICATE, 'already-processed');
    // Nothing new: the head is a commit a run produced. It is the automation's own push only when the
    // event came from the automation identity; anything else is a no-op worth a diagnostic, not a run.
    if (config.mode === 'local' || sameLogin(sender, config.pushActor)) return out(DECISION.IGNORE_AUTOMATION_CHANGE, 'produced-by-run');
    return out(DECISION.IGNORE_DUPLICATE, 'push-actor-mismatch');
  }

  if (ledger.openQuestions > 0) return out(DECISION.WAITING_FOR_HUMAN, 'open-question');
  const used = iterationsUsed(records, ledger);
  if (used >= config.maxIterations) return out(DECISION.WAITING_FOR_HUMAN, 'iteration-limit', { iterations: used });
  return out(DECISION.RUN_AGENT, 'external-intent', { run: { changeId, sourceSha: headSha, headSha, trigger: 'external', iteration: used + 1 } });
}

const COMMAND_REJECTIONS = {
  'bot-login-not-configured': DECISION.REJECT_INVALID,
  bot: DECISION.REJECT_UNTRUSTED,
  untrusted: DECISION.REJECT_UNTRUSTED,
  'already-answered': DECISION.IGNORE_DUPLICATE,
};

/**
 * Pure decision for an issue_comment answer. Wraps decide() (grammar, trust, question state) and adds the
 * ledger rules: a question is claimed by its first resume record; the resume keeps the change and source sha of
 * the run that asked, and counts as an iteration. `repair` tells the caller to project a claim onto the header.
 */
function gateAnswer({ comment, comments, botLogin, trust, changeId, headSha, config, ledger = collectLedger(comments, botLogin) }) {
  if (config.error) return { decision: DECISION.REJECT_INVALID, reason: config.error, hint: null };
  const d = decide({ comment, comments, botLogin, trust, claimed: new Set(ledger.claims.keys()) });
  if (d.action === 'ignore') {
    const claim = d.reason === 'already-answered' ? ledger.claims.get(d.question.id) : null;
    if (claim) {
      return {
        decision: DECISION.IGNORE_DUPLICATE, reason: 'resume-already-created', hint: 'resume-already-created',
        repair: d.question.status === 'OPEN' ? { questionCommentId: d.questionCommentId, claim } : null,
      };
    }
    return { decision: COMMAND_REJECTIONS[d.reason] || DECISION.REJECT_INVALID, reason: d.reason, hint: d.hint };
  }

  const answer = {
    questionCommentId: d.questionCommentId, question: d.question, option: d.option, note: d.note,
    answeredBy: d.answeredBy, answerCommentId: d.answerCommentId, remainingOpen: d.remainingOpen,
  };
  if (!d.resume) return { decision: DECISION.WAITING_FOR_HUMAN, reason: 'questions-remaining', answer };

  const records = ledger.records.filter((r) => r.changeId === changeId);
  const source = [...records].reverse().find((r) => r.question === d.question.id) || records[records.length - 1];
  if (!source) return { decision: DECISION.REJECT_INVALID, reason: 'no-run-to-resume', hint: null };

  // Answering the iteration-limit question is the human acknowledgement that opens a new budget window.
  const used = d.question.reason === 'iteration-limit' ? 0 : iterationsUsed(records, ledger);
  if (used >= config.maxIterations) return { decision: DECISION.WAITING_FOR_HUMAN, reason: 'iteration-limit', iterations: used, answer };
  return {
    decision: DECISION.RESUME_AGENT, reason: 'answer', answer,
    run: {
      changeId, sourceSha: source.sourceSha, headSha, trigger: 'resume', iteration: used + 1, resumeOf: source.runId,
      resumeKey: d.question.id, answerComment: String(d.answerCommentId),
    },
  };
}

/**
 * Pure decision for `/agent retry <run-id>`. liveness(runId) -> 'active' | 'ended' | 'unknown' is consulted only for
 * a run the ledger still calls RUNNING: if its execution has ended, the run is STALE (retryable, and diagnosable as
 * such); if that cannot be verified, nothing is retried. A retry is never an external intent.
 */
function gateRetry({ comment, botLogin, trust, changeId, headSha, ledger, config, liveness = () => 'unknown' }) {
  const out = (decision, reason, extra) => ({ decision, reason, hint: null, ...extra });
  const refuse = (reason) => out(DECISION.REJECT_INVALID, reason, { hint: HINTS[reason] ? reason : null });
  if (config.error) return out(DECISION.REJECT_INVALID, config.error);
  const rejected = commandSender(comment, botLogin, trust);
  if (rejected) return out(COMMAND_REJECTIONS[rejected], rejected);
  const cmd = parseRetryCommand(comment.body);
  if (!cmd) return out(DECISION.REJECT_INVALID, 'no-command');

  const target = ledger.records.find((r) => r.runId === cmd.runId);
  if (!target) return refuse('unknown-run');
  if (target.changeId !== changeId) return refuse('other-change');
  const records = ledger.records.filter((r) => r.changeId === changeId);
  if (records.some((r) => r.trigger === 'retry' && r.retryOf === target.runId)) {
    return out(DECISION.IGNORE_DUPLICATE, 'retry-already-created', { hint: 'retry-already-created', target });
  }
  if (records[records.length - 1] !== target) return refuse('superseded');

  let stale = target.status === 'STALE';
  if (target.status === 'RUNNING') {
    const l = liveness(target.runId);
    if (l === 'active') return refuse('run-active');
    if (l !== 'ended') return refuse('run-state-unknown');
    stale = true;
  } else if (target.status !== 'FAILED' && !stale) {
    return refuse('not-retryable');
  }

  if (ledger.openQuestions > 0) return out(DECISION.WAITING_FOR_HUMAN, 'open-question', { target });
  const used = iterationsUsed(records, ledger);
  if (used >= config.maxIterations) return out(DECISION.WAITING_FOR_HUMAN, 'iteration-limit', { iterations: used, target });
  return out(DECISION.RETRY_AGENT, stale ? 'retry-stale' : 'retry-failed', {
    target, stale,
    run: { changeId, sourceSha: target.sourceSha, headSha, trigger: 'retry', iteration: used + 1, retryOf: target.runId },
  });
}

// --------------------------------------------------------------------------
// GitHub orchestration (used from actions/github-script)
// --------------------------------------------------------------------------

async function setState({ github, context }, number, state) {
  const { owner, repo } = context.repo;
  const target = LABELS[state];
  for (const label of Object.values(LABELS)) {
    if (label === target) continue;
    try { await github.rest.issues.removeLabel({ owner, repo, issue_number: number, name: label }); } catch (e) { if (e.status !== 404) throw e; }
  }
  if (target) await github.rest.issues.addLabels({ owner, repo, issue_number: number, labels: [target] });
}

const listComments = (github, owner, repo, number) => github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: number, per_page: 100 });

async function listCommits(github, owner, repo, number) {
  const all = await github.paginate(github.rest.pulls.listCommits, { owner, repo, pull_number: number, per_page: 100 });
  return all.map((c) => ({ sha: c.sha, message: (c.commit && c.commit.message) || '' }));
}

/**
 * Registers a run in the ledger BEFORE the agent starts. The record is a new bot comment and is itself the claim
 * of its key (claimKey). If two gate runs race, both create one, both re-read the ledger, and the record with the
 * lowest comment id wins. The loser deletes its own record and stops; if it crashes first, collectLedger voids it.
 */
async function claimRun({ github, context, env }, number, run) {
  const { owner, repo } = context.repo;
  const rec = {
    changeId: run.changeId, sourceSha: run.sourceSha, headSha: run.headSha, runId: `${context.runId}-${env.GITHUB_RUN_ATTEMPT || 1}`,
    trigger: run.trigger, status: 'RUNNING', iteration: run.iteration, produced: [], question: '', resumeOf: run.resumeOf || '',
    resumeKey: run.resumeKey || '', answerComment: run.answerComment || '', retryOf: run.retryOf || '', failure: '',
  };
  const { data: mine } = await github.rest.issues.createComment({ owner, repo, issue_number: number, body: formatRunRecord(rec) });
  const ledger = collectLedger(await listComments(github, owner, repo, number), env.AGENT_BOT_LOGIN);
  const winner = ledger.records.find((r) => claimKey(r) === claimKey(rec));
  if (winner && winner.commentId === mine.id) return { won: true, record: { commentId: mine.id, ...rec } };
  await github.rest.issues.deleteComment({ owner, repo, comment_id: mine.id });
  if (!winner) throw new Error('the run record was not found in the ledger: AGENT_BOT_LOGIN must be the identity that posts comments');
  return { won: false };
}

function limitQuestion({ id, changeId, ledger, used, max, held }) {
  const rows = ledger.records.filter((r) => r.changeId === changeId && r.commentId > ledger.epochStart).slice(-20)
    .map((r) => `| \`${r.runId}\` | ${r.trigger} | ${r.iteration} | \`${r.sourceSha.slice(0, 7)}\` | ${r.status}${r.failure ? ` (${r.failure})` : ''} |`);
  const all = ledger.records.filter((r) => r.changeId === changeId);
  const window = ledger.acknowledgements.length + 1;
  const last = all.length ? all[all.length - 1].runId : '';
  return [
    '<!-- agent-question', `id: ${id}`, 'type: HUMAN_DECISION', 'status: OPEN', 'options: continue', 'reason: iteration-limit',
    `window: ${window}`, ...(last ? [`last-run: ${last}`] : []), '-->', '',
    `## Automatic run limit reached: ${changeId}`, '',
    `The agent already ran ${used} time(s) on this change in budget window ${window} (limit ${max}, \`AGENT_MAX_ITERATIONS\`; ${all.length} run(s) in total). It was **not** started again. The limit is a safety net against loops and unexpected retries, not a normal budget.`, '',
    `**Held:** ${held}`, '',
    '| Run | Trigger | Iteration | Source | Status |', '|---|---|---|---|---|', ...rows, '',
    '**Why this needs a human:** if the runs above are not all expected, look for a loop first: agent commits missing their provenance trailers, `AGENT_PUSH_ACTOR` not matching the identity that pushes, or an unexpected retry.', '',
    '### Handoff',
    '- Completed independent work: everything shown above; this stop changes nothing in the branch',
    `- Not started (depends on this decision): further automatic runs on ${changeId}`,
    `- If continue: budget window ${window + 1} opens and the agent resumes this change from the current head; the run history above is kept`, '',
    `**Reply with:** \`/agent answer ${id} continue\``, '',
  ].join('\n');
}

/** Circuit breaker: publishes the iteration-limit question (once) and marks the PR as waiting for a human. */
async function holdForHuman({ github, context }, number, { changeId, ledger, used, max, held }) {
  const { owner, repo } = context.repo;
  const limitQs = ledger.questions.filter((x) => x.q.reason === 'iteration-limit');
  if (!limitQs.some((x) => x.state === 'OPEN')) {
    const id = `iteration-limit-${limitQs.length + 1}`;
    await github.rest.issues.createComment({ owner, repo, issue_number: number, body: limitQuestion({ id, changeId, ledger, used, max, held }) });
  }
  await setState({ github, context }, number, 'WAITING');
}

/** Writes the provenance trailers the agent step must put on every commit of this run. */
function writeTrailers({ fs, env, run, runId }) {
  const file = `${env.RUNNER_TEMP || '.'}/agent-trailers.txt`;
  fs.writeFileSync(file, `${formatTrailers({ changeId: run.changeId, sourceSha: run.sourceSha, runId })}\n`);
  return file;
}

/**
 * pull_request gate: decides whether this event is a new external intent that starts the agent, or the
 * consequence of an automated run / a duplicate / a held change. Sets step outputs; `run` is 'true' only for RUN_AGENT.
 */
async function startRun({ github, context, core, env = process.env, fs = require('fs') }) {
  const { owner, repo } = context.repo;
  const number = Number((context.payload.pull_request || {}).number);
  const out = (o) => Object.entries(o).forEach(([k, v]) => core.setOutput(k, String(v)));
  const done = (decision, reason) => { core.info(`${decision}: ${reason}`); out({ decision, reason, run: false }); return { decision, reason }; };

  if (!Number.isInteger(number) || number < 1) return done(DECISION.REJECT_INVALID, 'invalid-event');
  if (!env.AGENT_BOT_LOGIN) return done(DECISION.REJECT_INVALID, 'bot-login-not-configured');
  const config = parseGateConfig(env);
  if (config.error) return done(DECISION.REJECT_INVALID, config.error);
  const changeId = `PR-${number}`;
  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: number });
  const ledger = collectLedger(await listComments(github, owner, repo, number), env.AGENT_BOT_LOGIN);
  const g = gateChange({
    changeId, headSha: pr.head.sha, sender: (context.payload.sender || {}).login,
    fork: !pr.head.repo || pr.head.repo.full_name !== `${owner}/${repo}`, state: pr.state,
    commits: await listCommits(github, owner, repo, number), ledger, config,
  });

  if (g.reason === 'push-actor-mismatch' && core.warning) core.warning('the head is a commit a run produced, but the event did not come from AGENT_PUSH_ACTOR');
  if (g.decision === DECISION.WAITING_FOR_HUMAN && g.reason === 'iteration-limit') {
    await holdForHuman({ github, context }, number, { changeId, ledger, used: g.iterations, max: config.maxIterations, held: `new change \`${pr.head.sha.slice(0, 7)}\`` });
  }
  if (g.decision !== DECISION.RUN_AGENT) return done(g.decision, g.reason);

  const claim = await claimRun({ github, context, env }, number, g.run);
  if (!claim.won) return done(DECISION.IGNORE_DUPLICATE, 'lost-claim');
  await setState({ github, context }, number, 'RUNNING');
  out({
    decision: g.decision, reason: g.reason, run: true, mode: 'start', change_id: changeId, source_sha: g.run.sourceSha, head_sha: g.run.headSha,
    run_id: claim.record.runId, head_ref: pr.head.ref, pr_number: number, trailers_file: writeTrailers({ fs, env, run: g.run, runId: claim.record.runId }),
  });
  return { decision: g.decision, reason: g.reason };
}

/** Writes an answer onto an OPEN question header (projection). Re-reads it first; never touches a closed one. */
async function projectAnswer({ github, owner, repo }, questionCommentId, answer) {
  const { data: fresh } = await github.rest.issues.getComment({ owner, repo, comment_id: questionCommentId });
  const q = parseQuestion(fresh.body);
  if (!q || q.status !== 'OPEN') return false;
  await github.rest.issues.updateComment({ owner, repo, comment_id: questionCommentId, body: markAnswered(fresh.body, answer) });
  return true;
}

/** Projects a claim found in the ledger onto its question header, from the winning answer comment. */
async function repairQuestion(ctx, { questionCommentId, claim }) {
  const c = ctx.comments.find((x) => String(x.id) === claim.answerComment);
  const cmd = c ? parseCommand(c.body) : null;
  await projectAnswer(ctx, questionCommentId, {
    by: c && c.user ? c.user.login : '', option: cmd ? cmd.option : '', commentId: claim.answerComment, at: c ? c.created_at : '',
  });
}

/** `/agent answer`: records the answer and, when no question remains, resumes the change. */
async function answerCommand(ctx, comment) {
  const { github, context, core, env, fs, owner, repo, number, pr, comments, ledger, config, changeId, out, skip } = ctx;
  const g = gateAnswer({ comment, comments, botLogin: env.AGENT_BOT_LOGIN, trust: parseTrustConfig(env), changeId, headSha: pr.head.sha, config, ledger });
  if (g.repair) await repairQuestion(ctx, g.repair);
  if (!g.answer) {
    if (g.hint) await github.rest.issues.createComment({ owner, repo, issue_number: number, body: HINTS[g.hint] });
    return skip(g.reason, g.decision);
  }
  const a = g.answer;
  const projection = { by: a.answeredBy, option: a.option, commentId: a.answerCommentId, at: comment.created_at };

  if (g.decision === DECISION.WAITING_FOR_HUMAN) {
    // No run is owed now. Post the limit question BEFORE recording the answer: after a crash in between, a
    // redelivery finds the question still OPEN and completes it, and holdForHuman never posts a second one.
    if (g.reason === 'iteration-limit') {
      await holdForHuman({ github, context }, number, { changeId, ledger, used: g.iterations, max: config.maxIterations, held: `resume after the answer to \`${a.question.id}\`` });
    }
    if (!(await projectAnswer(ctx, a.questionCommentId, projection))) return skip('already-answered', DECISION.IGNORE_DUPLICATE);
    return skip(g.reason, g.decision);
  }

  // The run record is the claim of the question (resume-key). The header only follows it; any later event repairs it.
  const claim = await claimRun({ github, context, env }, number, g.run);
  if (!claim.won) return skip('lost-claim', DECISION.IGNORE_DUPLICATE);
  await projectAnswer(ctx, a.questionCommentId, projection);
  const noteFile = `${env.RUNNER_TEMP || '.'}/agent-answer-note.txt`;
  fs.writeFileSync(noteFile, a.note);
  await setState({ github, context }, number, 'RUNNING');
  out({
    run: true, mode: 'resume', decision: g.decision, reason: g.reason, question_id: a.question.id, question_type: a.question.type, option: a.option,
    decision_key: a.question.decisionKey, openspec_change: a.question.change, note_file: noteFile,
    pr_number: number, head_ref: pr.head.ref, head_sha: g.run.headSha, remaining_open: a.remainingOpen,
    change_id: changeId, source_sha: g.run.sourceSha, run_id: claim.record.runId, retry_of: '',
    trailers_file: writeTrailers({ fs, env, run: g.run, runId: claim.record.runId }),
  });
  core.info(`${g.decision}: ${g.reason}`);
  return { decision: g.decision, reason: g.reason };
}

/**
 * Whether the Actions execution behind a run record still exists. run ids are `<workflow run id>-<attempt>`,
 * so the attempt is queried exactly. 404: that execution does not exist any more. Anything else unexpected: unknown.
 */
async function runLiveness({ github, owner, repo }, runId) {
  const m = /^(\d{1,20})-(\d{1,5})$/.exec(runId);
  if (!m) return 'unknown';
  try {
    const { data } = await github.rest.actions.getWorkflowRunAttempt({ owner, repo, run_id: Number(m[1]), attempt_number: Number(m[2]) });
    return data && data.status === 'completed' ? 'ended' : 'active';
  } catch (e) {
    return e.status === 404 ? 'ended' : 'unknown';
  }
}

async function markStale({ github, owner, repo }, target) {
  await github.rest.issues.updateComment({ owner, repo, comment_id: target.commentId, body: formatRunRecord({ ...target, status: 'STALE' }) });
}

/** `/agent retry <run-id>`: a new run of the same change and source, replacing a FAILED or STALE run. */
async function retryCommand(ctx, comment) {
  const { github, context, core, env, fs, number, pr, ledger, config, changeId, out, skip, owner, repo } = ctx;
  const args = { comment, botLogin: env.AGENT_BOT_LOGIN, trust: parseTrustConfig(env), changeId, headSha: pr.head.sha, ledger, config };
  let g = gateRetry(args);
  // The execution state is platform data, fetched only once everything cheaper has passed.
  if (g.reason === 'run-state-unknown') {
    const live = await runLiveness(ctx, g.target ? g.target.runId : parseRetryCommand(comment.body).runId);
    g = gateRetry({ ...args, liveness: () => live });
  }
  if (g.decision === DECISION.WAITING_FOR_HUMAN && g.reason === 'iteration-limit') {
    await holdForHuman({ github, context }, number, { changeId, ledger, used: g.iterations, max: config.maxIterations, held: `retry of \`${g.target.runId}\`` });
  }
  if (g.decision === DECISION.IGNORE_DUPLICATE && g.target && g.target.status === 'RUNNING' && (await runLiveness(ctx, g.target.runId)) === 'ended') {
    await markStale(ctx, g.target); // repair: a retry exists but the crash happened before the target was marked
  }
  if (g.decision !== DECISION.RETRY_AGENT) {
    if (g.hint) await github.rest.issues.createComment({ owner, repo, issue_number: number, body: HINTS[g.hint] });
    return skip(g.reason, g.decision);
  }

  const claim = await claimRun({ github, context, env }, number, g.run);
  if (!claim.won) return skip('lost-claim', DECISION.IGNORE_DUPLICATE);
  if (g.target.status === 'RUNNING') await markStale(ctx, g.target);
  await setState({ github, context }, number, 'RUNNING');
  out({
    run: true, mode: 'retry', decision: g.decision, reason: g.reason, retry_of: g.target.runId,
    pr_number: number, head_ref: pr.head.ref, head_sha: g.run.headSha,
    change_id: changeId, source_sha: g.run.sourceSha, run_id: claim.record.runId,
    trailers_file: writeTrailers({ fs, env, run: g.run, runId: claim.record.runId }),
  });
  core.info(`${g.decision}: ${g.reason}`);
  return { decision: g.decision, reason: g.reason };
}

/** issue_comment gate: `/agent answer …` and `/agent retry …`. Sets step outputs; `run` is 'true' when an agent job starts. */
async function onComment({ github, context, core, env = process.env, fs = require('fs') }) {
  const { owner, repo } = context.repo;
  const issue = context.payload.issue;
  const comment = context.payload.comment;
  const out = (o) => Object.entries(o).forEach(([k, v]) => core.setOutput(k, String(v)));
  const skip = (reason, decision = DECISION.REJECT_INVALID) => { core.info(`${decision}: ${reason}`); out({ run: false, decision, reason }); return { decision, reason }; };

  if (!issue || !issue.pull_request) return skip('not-a-pull-request');
  if (!env.AGENT_BOT_LOGIN) return skip('bot-login-not-configured');
  const config = parseGateConfig(env);
  if (config.error) return skip(config.error);
  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: issue.number });
  if (pr.state !== 'open') return skip('closed');
  if (!pr.head.repo || pr.head.repo.full_name !== `${owner}/${repo}`) return skip('fork', DECISION.REJECT_UNTRUSTED);

  const comments = await listComments(github, owner, repo, issue.number);
  const ctx = {
    github, context, core, env, fs, owner, repo, number: issue.number, pr, comments, config, out, skip,
    ledger: collectLedger(comments, env.AGENT_BOT_LOGIN), changeId: `PR-${issue.number}`,
  };
  return parseRetryCommand(comment.body) ? retryCommand(ctx, comment) : answerCommand(ctx, comment);
}

// --------------------------------------------------------------------------
// publish: the trusted post-step builds `produced` from its own evidence and pushes
// --------------------------------------------------------------------------

/**
 * The git operations publish needs, on the job's checkout. Repository hooks and fsmonitor are disabled, the token
 * travels only in the remote URL of the two network calls, and error messages never include the command line.
 */
function gitCli({ token, serverUrl, owner, repo, cwd = process.cwd(), execFileSync = require('child_process').execFileSync }) {
  const safe = ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'credential.helper='];
  const git = (args) => {
    try {
      return execFileSync('git', [...safe, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    } catch (e) {
      const err = new Error(`git ${args[0]} failed`);
      err.status = e.status;
      throw err;
    }
  };
  const remote = () => {
    if (!token) throw new Error('AGENT_PUSH_TOKEN is required to push');
    const u = new URL(`${serverUrl}/${owner}/${repo}.git`);
    u.username = 'x-access-token';
    u.password = token;
    return u.toString();
  };
  return {
    head: () => git(['rev-parse', 'HEAD']).trim(),
    isAncestor: (a, b) => { try { git(['merge-base', '--is-ancestor', a, b]); return true; } catch (e) { if (e.status === 1) return false; throw e; } },
    revList: (a, b) => git(['rev-list', '--reverse', `${a}..${b}`]).split('\n').filter(Boolean),
    message: (s) => git(['log', '-1', '--format=%B', s]),
    remoteHead: (ref) => git(['ls-remote', remote(), `refs/heads/${ref}`]).split(/\s+/)[0] || '',
    // Compare-and-swap on the branch: the server updates the ref only if it still points at `expected`.
    push: (ref, expected) => { git(['push', '--no-verify', `--force-with-lease=refs/heads/${ref}:${expected}`, remote(), `HEAD:refs/heads/${ref}`]); },
  };
}

/**
 * Builds `produced` from the job's own evidence and pushes it (protocol/LOOP-PREVENTION.md, "What a run produced").
 * Accepted only if: the commits are exactly those between the run's start commit (rec.headSha) and the job's HEAD
 * (so none existed before the run), every one carries this run's provenance, and the branch still points at the
 * start commit. The list is written to the run record BEFORE the push (write-ahead), then pushed with a
 * compare-and-swap by this trusted step, with the automation credential. Nothing found only in remote history
 * can enter `produced`. Returns { produced, failure? }.
 */
async function pushProduced({ git, rec, ref, recordProduced }) {
  const head = String(await git.head());
  if (!SHA_RE.test(head)) return { produced: [], failure: 'history-rewritten' };
  if (head === rec.headSha) return { produced: [] };
  if (!(await git.isAncestor(rec.headSha, head))) return { produced: [], failure: 'history-rewritten' };
  const range = await git.revList(rec.headSha, head);
  if (!range.length || range.some((s) => !SHA_RE.test(s))) return { produced: [], failure: 'history-rewritten' };
  if (range.length > MAX_PRODUCED) return { produced: [], failure: 'too-many-commits' };
  for (const s of range) {
    if (!carriesRun(await git.message(s), rec)) return { produced: [], failure: 'missing-provenance' };
  }
  if (!REF_RE.test(String(ref || ''))) return { produced: [], failure: 'misconfigured' };
  if ((await git.remoteHead(ref)) !== rec.headSha) return { produced: [], failure: 'branch-moved' };
  await recordProduced(range);
  try {
    await git.push(ref, rec.headSha);
  } catch {
    // The push may or may not have landed; the write-ahead list stays, so either way nothing is misclassified.
    return { produced: range, failure: 'push-failed' };
  }
  return { produced: range };
}

function readQuestionFile({ fs, path, tmp, result, ledger }) {
  const file = path.resolve(tmp, String(result.question_file || ''));
  if (!file.startsWith(tmp + path.sep)) throw new Error('question_file must be inside RUNNER_TEMP');
  const body = fs.readFileSync(file, 'utf8');
  const q = parseQuestion(body);
  if (!q || q.status !== 'OPEN') throw new Error('question file has no valid OPEN agent-question header');
  if (q.reason || q.window || q.lastRun) throw new Error('a question written by the agent may not set a reason: it is reserved for the circuit breaker');
  if (q.answerComment || q.answeredBy || q.answeredAt) throw new Error('a question written by the agent may not carry answer fields');
  const handoffError = validateHandoff(body, q.type);
  if (handoffError) throw new Error(handoffError);
  if (body.length > 60000) throw new Error('question is too long');
  if (ledger.questions.some((x) => x.q.id === q.id)) throw new Error(`question id ${q.id} is already used in this pull request`);
  return { body, q };
}

/**
 * Trusted post-step. Reads $RUNNER_TEMP/agent-result.json written by the agent step:
 *   { "status": "READY" | "WAITING_FOR_HUMAN", "question_file": "<path under RUNNER_TEMP>" }
 * Anything else (including a missing file) is a failed run. The agent step commits locally and never pushes,
 * writes comments or labels: this step validates, pushes the run's commits (pushProduced), applies the
 * outcome, and seals the run's ledger record with its final status and exactly the commits it pushed.
 */
async function publish({ github, context, core, env = process.env, fs = require('fs'), path = require('path'), git }) {
  const { owner, repo } = context.repo;
  const number = Number(env.AGENT_PR_NUMBER);
  if (!Number.isInteger(number) || number < 1) throw new Error('AGENT_PR_NUMBER must be a pull request number');
  const tmp = path.resolve(env.RUNNER_TEMP || '.');
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const comment = (body) => github.rest.issues.createComment({ owner, repo, issue_number: number, body });

  const ledger = collectLedger(await listComments(github, owner, repo, number), env.AGENT_BOT_LOGIN);
  const rec = ledger.records.find((r) => r.runId === env.AGENT_RUN_ID && r.changeId === env.AGENT_CHANGE_ID);
  if (!rec) throw new Error(`no run record for AGENT_RUN_ID=${env.AGENT_RUN_ID}: the gate must claim the run before the agent starts`);
  if (rec.status !== 'RUNNING') throw new Error(`run ${rec.runId} is already ${rec.status}`);

  let produced = [];
  const write = (next) => github.rest.issues.updateComment({ owner, repo, comment_id: rec.commentId, body: formatRunRecord(next) });
  const seal = (status, extra = {}) => write({ ...rec, status, produced, ...extra });
  const fail = async (failure, message) => {
    await seal('FAILED', { failure });
    await setState({ github, context }, number, null);
    await comment(`Agent run \`${rec.runId}\` failed (\`${failure}\`); nothing else was published. Retry with \`/agent retry ${rec.runId}\`. See ${runUrl}`);
    core.setFailed(message || failure);
  };

  const config = parseGateConfig(env);
  if (config.error) return fail('misconfigured', config.error);

  // 1. Validate the agent's result before anything reaches the branch.
  let result;
  try { result = JSON.parse(fs.readFileSync(path.join(tmp, 'agent-result.json'), 'utf8')); } catch { result = null; }
  if (!result || !['READY', 'WAITING_FOR_HUMAN'].includes(result.status)) return fail('invalid-result', 'missing or invalid agent-result.json');
  let question = null;
  if (result.status === 'WAITING_FOR_HUMAN') {
    try { question = readQuestionFile({ fs, path, tmp, result, ledger }); } catch (e) { await fail('invalid-question', e.message); throw e; }
  }

  // 2. Push what this run produced, recorded before it reaches the branch.
  const pushed = await pushProduced({
    git: git || gitCli({ token: env.AGENT_PUSH_TOKEN, serverUrl: context.serverUrl, owner, repo }),
    rec, ref: env.AGENT_HEAD_REF,
    recordProduced: (range) => write({ ...rec, produced: range }),
  });
  produced = pushed.produced;
  if (pushed.failure) return fail(pushed.failure);

  // 3. Apply the outcome.
  if (!question) {
    await seal('READY');
    await setState({ github, context }, number, 'READY');
    return;
  }
  await comment(question.body);
  await seal('WAITING_FOR_HUMAN', { question: question.q.id });
  await setState({ github, context }, number, 'WAITING');
}

module.exports = {
  parseQuestion, parseCommand, parseRetryCommand, validateHandoff, parseTrustConfig, isTrustedActor, decide, markAnswered, setState, LABELS,
  DECISION, parseTrailers, formatTrailers, parseRunRecord, formatRunRecord, claimKey, collectLedger, auditChange, parseGateConfig,
  gateChange, gateAnswer, gateRetry, startRun, onComment, publish, pushProduced, gitCli,
};
