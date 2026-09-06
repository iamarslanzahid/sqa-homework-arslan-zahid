/**
 * Reusable checks for a non-deterministic agent answer.
 *
 * These run against the "What is Permission?" topic. The design goal: pass on every
 * reasonable phrasing of a correct answer, fail on a broken, off-topic, truncated, or
 * error answer — without ever asserting the exact wording, which changes every run.
 *
 * See artifacts/assertions.md for what is deliberately NOT checked here and why; the
 * DeepEval rubric in evals/ adds the one thing these string checks can't catch — an
 * answer that is fluent and on-topic but factually wrong.
 */

export type AnswerCheck = {
  name: string;
  pass: boolean;
  detail: string;
};

// Domain vocabulary a correct "what is Permission" answer draws from. We require
// coverage of a few of these, not any specific one — phrasing varies run to run.
const TOPIC_TERMS = [
  'permission',
  'data',
  'earn',
  'ask',
  'token',
  'wallet',
  'agent',
  'own',
  'control',
  'privacy',
  'reward',
  'broker',
];

const ERROR_SIGNALS =
  /\b(something went wrong|an error occurred|try again later|i (?:can'?t|cannot) help|as an ai language model|undefined|null|\[object object\])\b/i;

const MIN_LENGTH = 40; // a real explanation, not "Hi!" or a dropped stream
const MAX_LENGTH = 2000; // a chat reply, not an essay dump

export function checkPermissionAnswer(raw: string): AnswerCheck[] {
  const text = (raw ?? '').trim();
  const lower = text.toLowerCase();
  const termHits = TOPIC_TERMS.filter((t) => lower.includes(t));

  return [
    {
      name: 'non-empty and substantial',
      pass: text.length >= MIN_LENGTH,
      detail: `length ${text.length} (min ${MIN_LENGTH})`,
    },
    {
      name: 'not an essay / not a truncated dump',
      pass: text.length <= MAX_LENGTH,
      detail: `length ${text.length} (max ${MAX_LENGTH})`,
    },
    {
      name: 'on topic (>= 3 domain terms)',
      pass: termHits.length >= 3,
      detail: `matched: [${termHits.join(', ')}]`,
    },
    {
      name: 'mentions Permission by name',
      pass: /permission/i.test(text),
      detail: lower.includes('permission') ? 'ok' : 'missing',
    },
    {
      name: 'no error / refusal / leaked placeholder',
      pass: !ERROR_SIGNALS.test(text),
      detail: ERROR_SIGNALS.test(text) ? `matched ${ERROR_SIGNALS.exec(text)?.[0]}` : 'clean',
    },
    {
      name: 'rendered as prose, not raw markup or JSON',
      pass: !/[<>{}]|```|"message"\s*:/.test(text),
      detail: 'no angle brackets, braces, fences, or JSON keys',
    },
    {
      name: 'reads like a sentence',
      pass: /[.!?]/.test(text) && /\s/.test(text),
      detail: 'has terminal punctuation and whitespace',
    },
  ];
}

export function failedChecks(checks: AnswerCheck[]): AnswerCheck[] {
  return checks.filter((c) => !c.pass);
}
