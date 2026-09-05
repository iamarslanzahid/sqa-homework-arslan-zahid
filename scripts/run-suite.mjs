// The full suite: the Playwright tests, then the Part 2 LLM eval.
// `npm test` runs this. The browser tests are the gate; the eval runs when Python +
// evals/requirements.txt are installed, and DeepEval's conftest skips it (not fails)
// when no LLM judge is configured.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const isWin = process.platform === 'win32';

// Load .env (gitignored) if present, so `npm test` picks up a local judge key with no export.
try {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trimStart().startsWith('#') && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {
  /* no .env — fine */
}

// Shell only for bare commands (npx, python) that need PATH resolution. A real file path
// (the venv python) must run without a shell, or Windows cmd mis-parses "./.venv/...".
const needsShell = (cmd) => isWin && !/[\\/]/.test(cmd);

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: 'inherit', shell: needsShell(cmd), ...opts });
}

console.log('\n──────────── 1/2  Playwright suite ────────────\n');
const pw = run('npx', ['playwright', 'test', ...process.argv.slice(2)]);
if (pw.status !== 0) process.exit(pw.status ?? 1);

console.log('\n──────────── 2/2  Part 2 LLM eval (DeepEval) ────────────\n');
const venvPython = isWin ? '.venv/Scripts/python.exe' : '.venv/bin/python';
const python = firstWorking([venvPython, 'python', 'python3'], ['-c', 'import pytest, deepeval']);

if (!python) {
  console.log(
    'SKIPPED — no Python env with evals/requirements.txt.\n' +
      'To run it:\n' +
      '  python -m venv .venv\n' +
      `  ${venvPython} -m pip install -r evals/requirements.txt\n` +
      '  cp .env.example .env   # add a judge key (free Google Gemini tier by default)\n' +
      '  npm test\n',
  );
  process.exit(0);
}

const evalRun = run(python, ['-m', 'pytest', 'evals', '-q']);
process.exit(evalRun.status === 5 ? 0 : evalRun.status ?? 1); // 5 = no tests collected

function firstWorking(bins, probeArgs) {
  for (const bin of bins) {
    // A path with a separator must exist; a bare command we let the shell resolve.
    if (/[\\/]/.test(bin) && !existsSync(bin)) continue;
    const probe = spawnSync(bin, probeArgs, { stdio: 'ignore', shell: needsShell(bin) });
    if (probe.status === 0) return bin;
  }
  return null;
}
