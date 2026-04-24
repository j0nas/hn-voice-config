// Style-feature eval. Used in two phases:
//   RED:   before patch.style is implemented — every case should fail because
//          the model can't produce style.{slot}.{prop} when it isn't in the prompt.
//   GREEN: after patch.style ships and the prompt mentions it — cases should pass.

import { styleCases } from './style-cases.mjs';

export default {
  description: 'patch.style feature eval — gemma 4 e4b (with production-equivalent retry=1)',
  providers: [
    {
      id: 'file://lib/retryProvider.mjs',
      label: 'gemma-4-e4b @ temp=0 retry=1',
      config: { maxRetries: 1, temperature: 0 },
    },
  ],
  prompts: ['file://lib/promptBuilder.mjs'],
  defaultTest: {
    assert: [{ type: 'javascript', value: 'file://lib/asserter.mjs' }],
  },
  tests: styleCases.map((c) => ({
    description: c.name,
    vars: { utterance: c.utterance, check: c.check },
  })),
};
