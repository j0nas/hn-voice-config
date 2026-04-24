// Custom Promptfoo provider that wraps the LM Studio chat completions endpoint
// with the same validator-feedback retry loop the production code uses.
// Configurable maxRetries via providerConfig so we can A/B different retry budgets
// in a single eval run.

import { TOOL_DEF } from './tool.mjs';
import { systemPrompt } from './prompt.mjs';
import { DEFAULT_CONFIG } from './snapshot.mjs';
import { validatePatch, parsePatch } from './intent.mjs';

const BASE = 'http://127.0.0.1:1234/v1';
const MODEL = 'google/gemma-4-e4b';

async function callOnce(messages, temperature) {
  const body = {
    model: MODEL,
    messages,
    tools: [TOOL_DEF],
    tool_choice: 'required',
    temperature,
  };
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`http ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// The custom-provider contract: export an `apiProvider` factory that returns
// { id, callApi(prompt, context) }. We bypass the prompt string and rebuild
// messages from vars.utterance so we can replay the assistant/tool turns on retry.
export default class RetryProvider {
  constructor(options = {}) {
    this.maxRetries = options.config?.maxRetries ?? 1;
    this.temperature = options.config?.temperature ?? 0.2;
    this.label = options.label || `retry=${this.maxRetries} temp=${this.temperature}`;
  }

  id() {
    return `retry-provider:${this.label}`;
  }

  async callApi(_prompt, context) {
    const utterance = context?.vars?.utterance;
    if (!utterance) {
      return { error: 'no vars.utterance' };
    }
    const messages = [
      { role: 'system', content: systemPrompt(DEFAULT_CONFIG) },
      { role: 'user', content: utterance },
    ];

    let lastErr = null;
    let attempts = 0;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      attempts++;
      let json;
      try {
        json = await callOnce(messages, this.temperature);
      } catch (e) {
        return { error: `network: ${e.message}`, metadata: { attempts } };
      }
      const msg = json.choices?.[0]?.message;
      const calls = msg?.tool_calls ?? [];
      if (!calls.length) {
        if (attempt === this.maxRetries) {
          return { error: 'no tool call', metadata: { attempts } };
        }
        continue;
      }
      const call = calls[0];
      let patch;
      try {
        patch = parsePatch(call);
      } catch (e) {
        lastErr = `bad json: ${e.message}`;
        if (attempt === this.maxRetries) {
          return {
            output: calls,
            metadata: { attempts, finalError: lastErr },
          };
        }
        messages.push({ role: 'assistant', content: msg?.content ?? null, tool_calls: calls });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: `Validation failed: ${lastErr}\nFix the JSON and call updateConfig again.`,
        });
        continue;
      }
      const errs = validatePatch(patch);
      if (errs.length === 0) {
        return { output: calls, metadata: { attempts } };
      }
      lastErr = errs.join('; ');
      if (attempt === this.maxRetries) {
        return { output: calls, metadata: { attempts, finalError: lastErr } };
      }
      messages.push({ role: 'assistant', content: msg?.content ?? null, tool_calls: calls });
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: `Validation failed: ${lastErr}\nFix the JSON and call updateConfig again.`,
      });
    }
    return { error: 'retry loop exhausted', metadata: { attempts } };
  }
}
