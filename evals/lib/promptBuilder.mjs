import { systemPrompt } from './prompt.mjs';
import { DEFAULT_CONFIG } from './snapshot.mjs';

// Promptfoo invokes this with ({ vars, provider }) and expects a messages array.
export default function buildPrompt({ vars }) {
  return [
    { role: 'system', content: systemPrompt(DEFAULT_CONFIG) },
    { role: 'user', content: vars.utterance },
  ];
}
