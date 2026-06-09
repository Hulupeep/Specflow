#!/usr/bin/env node
/**
 * verify-ticket-journey.cjs — Gate B, leg 3 (the "→issue" join).
 *
 * `verify-graph.cjs` validates the CONTRACT graph (requirement→journey→test→contract)
 * but has no issue-awareness. This script closes the ticket↔journey join, model-free:
 *   - every journey defined in the contracts dir is referenced by ≥1 GitHub ticket (no orphan journeys)
 *   - every journey ID a ticket references actually exists (no dangling ticket refs)
 *
 * It does NOT re-implement the contract graph — it consumes journey IDs and issues only.
 *
 * Usage:
 *   node scripts/verify-ticket-journey.cjs [contracts-dir] [--repo OWNER/REPO]
 *   node scripts/verify-ticket-journey.cjs [contracts-dir] --issues path/to/issues.json   # offline/testing
 *
 * Exit 0 = pass, 1 = orphans or dangling refs found, 2 = usage/IO error.
 */

const { readdirSync, readFileSync, existsSync, statSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const JOURNEY_ID = /\bJ-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g;

/** Journey IDs *defined* in a contract file: `id: J-...` under journey_meta. */
function extractDefinedJourneyIds(content) {
  const out = new Set();
  const matches = content.match(/id:\s*(J-[A-Z0-9-]+)/g) || [];
  for (const m of matches) out.add(m.replace('id:', '').trim());
  return out;
}

/** Load the set of journey IDs defined across a contracts directory. */
function loadJourneyIds(contractsDir) {
  const ids = new Set();
  if (!existsSync(contractsDir)) return ids;
  for (const f of readdirSync(contractsDir)) {
    if (!/\.ya?ml$/.test(f)) continue;
    const p = join(contractsDir, f);
    if (!statSync(p).isFile()) continue;
    for (const id of extractDefinedJourneyIds(readFileSync(p, 'utf8'))) ids.add(id);
  }
  return ids;
}

/** Map each issue to the journey IDs it references in its body/title. */
function parseTicketRefs(issues) {
  const refs = new Map(); // issueNumber → Set(J-id)
  for (const issue of issues) {
    const text = `${issue.title || ''}\n${issue.body || ''}`;
    const found = new Set(text.match(JOURNEY_ID) || []);
    refs.set(issue.number, found);
  }
  return refs;
}

/**
 * The join. Pure — no IO.
 * @param {Set<string>} journeyIds  journey IDs defined in contracts
 * @param {Array} issues            [{number, title, body}]
 * @returns {{orphanJourneys:string[], danglingTickets:Array<{number:number,badIds:string[]}>, pass:boolean}}
 */
function auditTicketJourney(journeyIds, issues) {
  const refs = parseTicketRefs(issues);
  const referenced = new Set();
  const danglingTickets = [];

  for (const [number, ids] of refs) {
    const badIds = [];
    for (const id of ids) {
      if (journeyIds.has(id)) referenced.add(id);
      else badIds.push(id);
    }
    if (badIds.length) danglingTickets.push({ number, badIds: badIds.sort() });
  }

  const orphanJourneys = [...journeyIds].filter(id => !referenced.has(id)).sort();
  danglingTickets.sort((a, b) => a.number - b.number);
  return { orphanJourneys, danglingTickets, pass: orphanJourneys.length === 0 && danglingTickets.length === 0 };
}

/** Fetch issues from GitHub via gh (open issues by default). */
function fetchIssuesFromGh(repo) {
  const repoFlag = repo ? `-R ${repo}` : '';
  const raw = execSync(`gh issue list ${repoFlag} --state open --limit 1000 --json number,title,body`, {
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}

function main(argv) {
  const args = argv.slice(2);
  const issuesFlagIdx = args.indexOf('--issues');
  const repoFlagIdx = args.indexOf('--repo');
  const consumed = new Set(); // indices that are flag *values*, not the positional contracts-dir
  if (issuesFlagIdx !== -1) consumed.add(issuesFlagIdx + 1);
  if (repoFlagIdx !== -1) consumed.add(repoFlagIdx + 1);
  const contractsDir = args.find((a, i) => !a.startsWith('--') && !consumed.has(i)) || 'docs/contracts';

  let issues;
  try {
    if (issuesFlagIdx !== -1) {
      issues = JSON.parse(readFileSync(args[issuesFlagIdx + 1], 'utf8'));
    } else {
      issues = fetchIssuesFromGh(repoFlagIdx !== -1 ? args[repoFlagIdx + 1] : null);
    }
  } catch (e) {
    console.error(`✗ could not load issues: ${e.message}`);
    process.exit(2);
  }

  const journeyIds = loadJourneyIds(contractsDir);
  console.error(`\nGate B leg 3 — ticket↔journey join (${journeyIds.size} journeys, ${issues.length} issues)`);
  console.error('------------------------------------------------------------');

  const { orphanJourneys, danglingTickets, pass } = auditTicketJourney(journeyIds, issues);

  for (const id of orphanJourneys) console.error(`  \x1b[31m✗\x1b[0m orphan journey (no ticket): ${id}`);
  for (const { number, badIds } of danglingTickets)
    console.error(`  \x1b[31m✗\x1b[0m ticket #${number} references unknown journey(s): ${badIds.join(', ')}`);

  if (pass) {
    console.error(`  \x1b[32m✓\x1b[0m every journey has a ticket; every ticket ref resolves`);
    process.exit(0);
  }
  process.exit(1);
}

module.exports = { extractDefinedJourneyIds, loadJourneyIds, parseTicketRefs, auditTicketJourney };

if (require.main === module) main(process.argv);
