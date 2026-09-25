'use strict';
// Reference implementation of the deterministic parts of protocol/HUMAN-IN-THE-LOOP.md
// for GitHub pull requests. Dependency-free; meant for actions/github-script.
//
// Security properties (see protocol/SECURITY.md):
//  - comment text is data: parsed with strict grammars, never executed or interpolated;
//  - a question exists only if published by BOT_LOGIN, and its header starts the comment;
//  - only trusted actors (platform-reported association or allowlist, never a bot) answer;
//  - the first valid answer flips OPEN -> ANSWERED; later ones are ignored;
//  - fork PRs are never resumed.

const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const OPTION_RE = /^[A-Za-z0-9_-]{1,32}$/;
const DECISION_KEY_RE = /^[a-z0-9_.-]{1,64}$/;
const HEADER_RE = /^\s*<!--[ \t]*agent-question[ \t]*\r?\n([\s\S]*?)-->/;
const FIELD_RE = /^([a-z-]+):[ \t]*([A-Za-z0-9_.,:+-]*)[ \t]*$/;
const COMMAND_RE = /^\/agent[ \t]+answer[ \t]+([A-Za-z0-9_.-]{1,64})[ \t]+([A-Za-z0-9_-]{1,32})(?:[ \t]+(\S.{0,499}))?[ \t]*$/;

const TYPES = new Set(['HUMAN_DECISION', 'HUMAN_SECRET']);
const STATUSES = new Set(['OPEN', 'ANSWERED', 'CANCELLED']);
const LABELS = { RUNNING: 'agent:running', WAITING: 'agent:waiting-human', READY: 'agent:ready' };
const HINTS = {
  'already-answered': 'That question was already answered (or cancelled); the answer was not applied.',
  'invalid-option': 'That option is not one of the question\'s options; the answer was not applied.',
  'unknown-question': 'No open question with that id was found in this pull request.',
  'ambiguous-question': 'More than one question uses that id; the answer was not applied.',
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
  return { id, type, status, options, decisionKey, change };
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

/**
 * Pure decision. comment: the new comment ({ body, user:{login,type}, author_association });
 * comments: every comment of the PR. Returns { action:'ignore'|'answer', reason, hint?, ... }.
 */
function decide({ comment, comments, botLogin, trust }) {
  const ignore = (reason, hint) => ({ action: 'ignore', reason, hint: hint || null });
  const user = comment.user || {};
  if (!botLogin) return ignore('bot-login-not-configured');
  if (user.type === 'Bot' || sameLogin(user.login, botLogin)) return ignore('bot');
  if (!isTrustedActor({ login: user.login, type: user.type, association: comment.author_association }, trust)) return ignore('untrusted');
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
  if (q.status !== 'OPEN') return ignore('already-answered', 'already-answered');
  if (!q.options.includes(cmd.option)) return ignore('invalid-option', 'invalid-option');

  const remainingOpen = questions.filter((x) => x.q.status === 'OPEN' && x.comment.id !== qc.id).length;
  return {
    action: 'answer',
    questionCommentId: qc.id,
    question: q,
    option: cmd.option,
    note: cmd.note,
    answeredBy: user.login,
    answerCommentId: comment.id,
    remainingOpen,
    resume: remainingOpen === 0,
  };
}

/** Flips a question comment to ANSWERED and records who answered what. Header stays valid. */
function markAnswered(body, { by, option, commentId }) {
  return String(body).replace(HEADER_RE, (whole, inner) => {
    const lines = inner.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.replace(/^status:.*$/, 'status: ANSWERED'));
    lines.push(`answered-by: ${by}`, `answer: ${option}`, `answer-comment: ${commentId}`);
    return `${whole.slice(0, whole.indexOf('agent-question'))}agent-question\n${lines.join('\n')}\n-->`;
  }) + `\n\n> Answered by ${by}: \`${option}\`.\n`;
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

/** issue_comment gate: decides whether an answer resumes the agent. Sets step outputs. */
async function resume({ github, context, core, env = process.env, fs = require('fs') }) {
  const { owner, repo } = context.repo;
  const issue = context.payload.issue;
  const comment = context.payload.comment;
  const out = (o) => Object.entries(o).forEach(([k, v]) => core.setOutput(k, String(v)));
  const skip = (reason) => { core.info(`ignored: ${reason}`); out({ resume: false }); };

  if (!issue || !issue.pull_request) return skip('not-a-pull-request');
  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: issue.number });
  if (pr.state !== 'open') return skip('closed');
  if (!pr.head.repo || pr.head.repo.full_name !== `${owner}/${repo}`) return skip('fork');

  const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: issue.number, per_page: 100 });
  const d = decide({ comment, comments, botLogin: env.AGENT_BOT_LOGIN, trust: parseTrustConfig(env) });

  if (d.action === 'ignore') {
    if (d.hint) await github.rest.issues.createComment({ owner, repo, issue_number: issue.number, body: HINTS[d.hint] });
    return skip(d.reason);
  }

  // Claim: re-read the question and flip it only if it is still OPEN. Runs of one PR are
  // serialized by the workflow's concurrency group, so two answers cannot both claim it.
  const { data: fresh } = await github.rest.issues.getComment({ owner, repo, comment_id: d.questionCommentId });
  const q = parseQuestion(fresh.body);
  if (!q || q.status !== 'OPEN') return skip('already-answered');
  await github.rest.issues.updateComment({
    owner, repo, comment_id: d.questionCommentId,
    body: markAnswered(fresh.body, { by: d.answeredBy, option: d.option, commentId: d.answerCommentId }),
  });

  const noteFile = `${env.RUNNER_TEMP || '.'}/agent-answer-note.txt`;
  fs.writeFileSync(noteFile, d.note);
  if (d.resume) await setState({ github, context }, issue.number, 'RUNNING');
  out({
    resume: d.resume, question_id: d.question.id, question_type: d.question.type, option: d.option,
    decision_key: d.question.decisionKey, change: d.question.change, note_file: noteFile,
    pr_number: issue.number, head_ref: pr.head.ref, remaining_open: d.remainingOpen,
  });
}

/**
 * Trusted post-step. Reads $RUNNER_TEMP/agent-result.json written by the agent step:
 *   { "status": "READY" | "WAITING_FOR_HUMAN", "question_file": "<path under RUNNER_TEMP>" }
 * Anything else (including a missing file) is a failed run. The agent never needs write access
 * to comments or labels: this step validates and applies them.
 */
async function publish({ github, context, core, env = process.env, fs = require('fs'), path = require('path') }) {
  const { owner, repo } = context.repo;
  const number = Number(env.AGENT_PR_NUMBER);
  if (!Number.isInteger(number) || number < 1) throw new Error('AGENT_PR_NUMBER must be a pull request number');
  const tmp = path.resolve(env.RUNNER_TEMP || '.');
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const comment = (body) => github.rest.issues.createComment({ owner, repo, issue_number: number, body });

  let result;
  try { result = JSON.parse(fs.readFileSync(path.join(tmp, 'agent-result.json'), 'utf8')); } catch { result = null; }

  if (!result || !['READY', 'WAITING_FOR_HUMAN'].includes(result.status)) {
    await setState({ github, context }, number, null);
    await comment(`The agent run ended without a valid result. See ${runUrl}`);
    core.setFailed('missing or invalid agent-result.json');
    return;
  }
  if (result.status === 'READY') {
    await setState({ github, context }, number, 'READY');
    return;
  }

  const file = path.resolve(tmp, String(result.question_file || ''));
  if (!file.startsWith(tmp + path.sep)) throw new Error('question_file must be inside RUNNER_TEMP');
  const body = fs.readFileSync(file, 'utf8');
  const q = parseQuestion(body);
  if (!q || q.status !== 'OPEN') throw new Error('question file has no valid OPEN agent-question header');
  const handoffError = validateHandoff(body, q.type);
  if (handoffError) throw new Error(handoffError);
  if (body.length > 60000) throw new Error('question is too long');
  const existing = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: number, per_page: 100 });
  const taken = existing.some((c) => c.user && sameLogin(c.user.login, env.AGENT_BOT_LOGIN) && (parseQuestion(c.body) || {}).id === q.id);
  if (taken) throw new Error(`question id ${q.id} is already used in this pull request`);
  await comment(body);
  await setState({ github, context }, number, 'WAITING');
}

module.exports = { parseQuestion, parseCommand, validateHandoff, parseTrustConfig, isTrustedActor, decide, markAnswered, setState, resume, publish, LABELS };
