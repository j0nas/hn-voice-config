// Temperature sweep — same case set, four providers at different temps.
// Uses the retry provider with maxRetries=0 so each call is a single shot
// (clean comparison across temps). Production retry budget is tested separately.

const baseline = (await import('./promptfooconfig.mjs')).default;

const TEMPS = [0, 0.2, 0.5, 0.7];

export default {
  description: 'temperature sweep — gemma 4 e4b, single-shot',
  prompts: baseline.prompts,
  defaultTest: baseline.defaultTest,
  providers: TEMPS.map((t) => ({
    id: 'file://lib/retryProvider.mjs',
    label: `temp=${t}`,
    config: { maxRetries: 0, temperature: t },
  })),
  tests: baseline.tests,
};
