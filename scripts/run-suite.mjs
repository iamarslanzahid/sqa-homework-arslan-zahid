// The full suite: the Playwright tests, then the Part 2 LLM eval.
// `npm test` runs this. The browser tests are the gate; the eval runs when Python +
// evals/requirements.txt are installed, and DeepEval's conftest skips it (not fails)
// when no LLM judge is configured.

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
      'To run it:  pip install -r evals/requirements.txt  &&  set a judge key  &&  npm test\n' +
      '(judge options — see README "Part 2 eval": free Google Gemini tier, or local Ollama)\n',
  );
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
