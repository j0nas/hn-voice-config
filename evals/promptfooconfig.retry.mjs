// Retry-budget experiment. Same case set, three providers with maxRetries 0/1/2.
// Production currently uses 1; this measures whether 0 (first-shot) or 2 buys us anything.

// Re-import the case list from the baseline config so we don't duplicate.
const baseline = (await import('./promptfooconfig.mjs')).default;

export default {
  description: 'retry-budget sweep — gemma 4 e4b @ temp=0.2',
  prompts: baseline.prompts,
  defaultTest: baseline.defaultTest,
  providers: [
    {
      id: 'file://lib/retryProvider.mjs',
      label: 'retry=0',
      config: { maxRetries: 0, temperature: 0 },
    },
    {
      id: 'file://lib/retryProvider.mjs',
      label: 'retry=1',
      config: { maxRetries: 1, temperature: 0 },
    },
    {
      id: 'file://lib/retryProvider.mjs',
      label: 'retry=2',
      config: { maxRetries: 2, temperature: 0 },
    },
  ],
  tests: baseline.tests,
};
