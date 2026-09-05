// The full suite: the Playwright tests, then the Part 2 LLM eval.
// `npm test` runs this. The browser tests are the gate; the eval runs when Python +
// evals/requirements.txt + ANTHROPIC_API_KEY are present (always, in CI), and is
// reported as skipped — not failed — when they are not.

import { spawnSync } from 'node:child_process';

const isWin = process.platform === 'win32';

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: 'inherit', shell: isWin, ...opts });
}

console.log('\n──────────── 1/2  Playwright suite ────────────\n');
const pw = run('npx', ['playwright', 'test', ...process.argv.slice(2)]);
if (pw.status !== 0) process.exit(pw.status ?? 1);

console.log('\n──────────── 2/2  Part 2 LLM eval (DeepEval) ────────────\n');
const python = firstWorking(['python', 'python3'], ['-c', 'import pytest, deepeval']);

if (!python) {
  console.log(
    'SKIPPED — Python with evals/requirements.txt not found.\n' +
      'To run it:  pip install -r evals/requirements.txt  &&  set ANTHROPIC_API_KEY  &&  npm test\n',
  );
  process.exit(0);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('SKIPPED — ANTHROPIC_API_KEY not set (the eval needs a judge model). See README.\n');
  process.exit(0);
}

const evalRun = run(python, ['-m', 'pytest', 'evals', '-q']);
process.exit(evalRun.status === 5 ? 0 : evalRun.status ?? 1); // 5 = no tests collected

function firstWorking(bins, probeArgs) {
  for (const bin of bins) {
    const probe = spawnSync(bin, probeArgs, { stdio: 'ignore', shell: isWin });
    if (probe.status === 0) return bin;
  }
  return null;
}
