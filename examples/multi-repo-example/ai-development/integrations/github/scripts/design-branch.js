'use strict';
// Reference implementation of the design source branch model (protocol/DESIGN-DRIVEN.md, "Design source branch")
// for GitHub. Dependency-free; meant for actions/github-script.
//
// Two jobs, both API-only (no checkout, no code from the change is run):
//  - ensureDesignPr: on a push to the design source branch, opens the design pull request to production when
//    none is open and the design source branch is strictly ahead. It never runs the agent and never pushes.
//  - backSync: on a push to production (a merged pull request), moves the design source branch forward so it
//    contains production: fast-forward, otherwise a merge commit. Never a force-push; a conflict stops and is
//    reported on the merged pull request.
// The agent itself is started only by agent-gate.js, on the design pull request's own events.

const REF_RE = /^(?!\/)(?!.*\/\/)(?!.*\.\.)(?!.*\/$)(?!.*\.lock$)[A-Za-z0-9._/-]{1,200}$/;
const SHA_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const REPORT_MARKER = '<!-- design-back-sync -->';

const PROMOTION = Object.freeze({ OPEN: 'OPEN_PULL_REQUEST', NONE: 'NONE' });
const BACK_SYNC = Object.freeze({ FAST_FORWARD: 'FAST_FORWARD', MERGE: 'MERGE', NONE: 'NONE' });

/** DESIGN_SOURCE_BRANCH (default `studio`) and PRODUCTION_BRANCH (default `main`), validated. */
function parseDesignConfig(env) {
  const source = String(env.DESIGN_SOURCE_BRANCH || '').trim() || 'studio';
  const production = String(env.PRODUCTION_BRANCH || '').trim() || 'main';
  let error = '';
  if (!REF_RE.test(source) || !REF_RE.test(production)) error = 'invalid-branch';
  else if (source === production) error = 'same-branch';
  return { source, production, error };
}

/**
 * Pure decision for a push to the design source branch. openPulls: open pull requests from the design source
 * branch to production; status: GitHub's comparison of production (base) with the design source branch (head).
 *   ahead      -> open the design pull request (production is contained, and there is something new)
 *   identical  -> nothing to promote (for example right after a fast-forward back-sync)
 *   behind     -> nothing to promote (production moved; the back-sync will catch up)
 *   diverged   -> wait: production is not contained yet. The back-sync's own push runs this again, so the pull
 *                 request opens with the back-sync merge already in it and the gate starts one run, not two.
 */
function decidePromotion({ config, openPulls, status }) {
  const out = (action, reason) => ({ action, reason });
  if (config.error) return out(PROMOTION.NONE, config.error);
  if (!Array.isArray(openPulls)) return out(PROMOTION.NONE, 'invalid-event');
  if (openPulls.length > 0) return out(PROMOTION.NONE, 'pull-request-open');
  if (status === 'ahead') return out(PROMOTION.OPEN, 'source-ahead');
  if (status === 'identical' || status === 'behind') return out(PROMOTION.NONE, 'nothing-to-promote');
  if (status === 'diverged') return out(PROMOTION.NONE, 'back-sync-pending');
  return out(PROMOTION.NONE, 'unknown-comparison');
}

/**
 * Pure decision for a push to production. status: comparison of production (base) with the design source
 * branch (head). The design source branch must end up containing production, without losing its own commits.
 */
function decideBackSync({ config, status }) {
  const out = (action, reason) => ({ action, reason });
  if (config.error) return out(BACK_SYNC.NONE, config.error);
  if (status === 'identical' || status === 'ahead') return out(BACK_SYNC.NONE, 'in-sync');
  if (status === 'behind') return out(BACK_SYNC.FAST_FORWARD, 'no-new-design-commits');
  if (status === 'diverged') return out(BACK_SYNC.MERGE, 'design-commits-after-merge');
  return out(BACK_SYNC.NONE, 'unknown-comparison');
}

function conflictReport({ source, production, sha }) {
  return [
    REPORT_MARKER,
    `## Back-sync stopped: \`${production}\` conflicts with \`${source}\``, '',
    `After this merge, \`${production}\` (\`${sha.slice(0, 7)}\`) could not be merged into the design source branch \`${source}\` without conflicts. Nothing was pushed, and \`${source}\` was not force-pushed.`, '',
    `Until \`${source}\` contains \`${production}\`, no new design pull request is opened.`, '',
    '**To resolve:** a human merges `' + production + '` into `' + source + '`, resolves the conflicts and pushes. That push opens the next design pull request as usual.', '',
  ].join('\n');
}

// --------------------------------------------------------------------------
// GitHub orchestration (used from actions/github-script)
// --------------------------------------------------------------------------

async function compareStatus(github, owner, repo, base, head) {
  const { data } = await github.rest.repos.compareCommitsWithBasehead({ owner, repo, basehead: `${base}...${head}`, per_page: 1 });
  return data.status;
}

/** push to the design source branch: opens the design pull request when it should exist and does not. */
async function ensureDesignPr({ github, context, core, env = process.env }) {
  const { owner, repo } = context.repo;
  const done = (action, reason) => { core.info(`${action}: ${reason}`); core.setOutput('action', action); core.setOutput('reason', reason); return { action, reason }; };
  const config = parseDesignConfig(env);
  if (config.error) return done(PROMOTION.NONE, config.error);
  if (context.ref !== `refs/heads/${config.source}`) return done(PROMOTION.NONE, 'not-design-source-branch');

  const openPulls = await github.paginate(github.rest.pulls.list, { owner, repo, state: 'open', head: `${owner}:${config.source}`, base: config.production, per_page: 100 });
  const status = await compareStatus(github, owner, repo, config.production, config.source);
  const d = decidePromotion({ config, openPulls, status });
  if (d.action !== PROMOTION.OPEN) return done(d.action, d.reason);

  try {
    await github.rest.pulls.create({
      owner, repo, head: config.source, base: config.production,
      title: `Design: integrate \`${config.source}\` into \`${config.production}\``,
      body: 'Opened automatically after a push to the design source branch. The agent implements it and stops here for review (protocol/DESIGN-DRIVEN.md).',
    });
  } catch (e) {
    // A concurrent run opened it first: the pull request exists, which is the goal.
    if (e.status === 422) return done(PROMOTION.NONE, 'pull-request-open');
    throw e;
  }
  return done(d.action, d.reason);
}

async function reportConflict({ github, owner, repo, config, sha }) {
  const { data: pulls } = await github.rest.repos.listPullRequestsAssociatedWithCommit({ owner, repo, commit_sha: sha });
  const merged = (pulls || []).find((p) => p.merged_at && p.base && p.base.ref === config.production);
  if (!merged) return false;
  await github.rest.issues.createComment({ owner, repo, issue_number: merged.number, body: conflictReport({ ...config, sha }) });
  return true;
}

/** push to production: brings the design source branch up to production, never by force. */
async function backSync({ github, context, core, env = process.env }) {
  const { owner, repo } = context.repo;
  const done = (action, reason) => { core.info(`${action}: ${reason}`); core.setOutput('action', action); core.setOutput('reason', reason); return { action, reason }; };
  const config = parseDesignConfig(env);
  if (config.error) return done(BACK_SYNC.NONE, config.error);
  if (context.ref !== `refs/heads/${config.production}`) return done(BACK_SYNC.NONE, 'not-production-branch');
  const sha = String(context.sha || '');
  if (!SHA_RE.test(sha)) return done(BACK_SYNC.NONE, 'invalid-event');

  const d = decideBackSync({ config, status: await compareStatus(github, owner, repo, sha, config.source) });
  if (d.action === BACK_SYNC.NONE) return done(d.action, d.reason);

  if (d.action === BACK_SYNC.FAST_FORWARD) {
    try {
      await github.rest.git.updateRef({ owner, repo, ref: `heads/${config.source}`, sha, force: false });
      return done(d.action, d.reason);
    } catch (e) {
      // 422: not a fast-forward any more (the builder pushed meanwhile). Merge instead; never force.
      if (e.status !== 422) throw e;
    }
  }

  try {
    const res = await github.rest.repos.merge({
      owner, repo, base: config.source, head: sha,
      commit_message: `Back-sync: merge ${config.production} (${sha.slice(0, 7)}) into ${config.source}`,
    });
    if (res.status === 204) return done(BACK_SYNC.NONE, 'in-sync');
    return done(BACK_SYNC.MERGE, 'design-commits-after-merge');
  } catch (e) {
    if (e.status !== 409) throw e;
    const reported = await reportConflict({ github, owner, repo, config, sha });
    core.setFailed(`back-sync conflict: ${config.production} could not be merged into ${config.source}${reported ? '' : ' (no merged pull request found to report on)'}`);
    return done(BACK_SYNC.NONE, 'conflict');
  }
}

module.exports = {
  PROMOTION, BACK_SYNC, REPORT_MARKER, parseDesignConfig, decidePromotion, decideBackSync, conflictReport, ensureDesignPr, backSync,
};
