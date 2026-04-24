// Single javascript-assertion entrypoint dispatched on `vars.check.type`.
// Each test case sets `vars.check = { type, ...args }`; this file routes
// to the corresponding intent helper. Keeps assertion logic in JS, leaves
// YAML cases declarative.

import {
  expectHidesExactly,
  expectHidesAtLeast,
  expectKeepsOnly,
  expectFilter,
  expectFeed,
  expectPalette,
  expectCustomizes,
  expectStyle,
  expectStyleOneOf,
  validatePatch,
  parsePatch,
} from './intent.mjs';

const DISPATCH = {
  hidesExactly: (patch, c) => expectHidesExactly(patch, c.slots),
  hidesAtLeast: (patch, c) => expectHidesAtLeast(patch, c.slots),
  keepsOnly: (patch, c) => expectKeepsOnly(patch, c.slots),
  filter: (patch) => expectFilter(patch),
  feed: (patch, c) => expectFeed(patch, c.value),
  palette: (patch) => expectPalette(patch),
  customizes: (patch, c) => expectCustomizes(patch, c.slot),
  style: (patch, c) => expectStyle(patch, c.slot, c.prop, c.value),
  styleOneOf: (patch, c) => expectStyleOneOf(patch, c.slot, c.props),
};

export default function assertion(output, context) {
  // Promptfoo gives `output` as the model's textual reply for chat completions,
  // OR the parsed tool-call array when `tools` is configured. Be defensive.
  let toolCalls = null;
  if (Array.isArray(output) && output[0]?.function) {
    toolCalls = output;
  } else if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed) && parsed[0]?.function) toolCalls = parsed;
    } catch {
      /* fallthrough */
    }
  } else if (output?.tool_calls) {
    toolCalls = output.tool_calls;
  }

  if (!toolCalls || toolCalls.length === 0) {
    return { pass: false, score: 0, reason: `no tool call in output: ${JSON.stringify(output).slice(0, 200)}` };
  }

  let patch;
  try {
    patch = parsePatch(toolCalls[0]);
  } catch (e) {
    return { pass: false, score: 0, reason: `unparseable tool args: ${e.message}` };
  }

  // Always check structural validity — a malformed Expr or unknown slot is a hard fail
  // even if the intent assertion would otherwise pass.
  const structErrs = validatePatch(patch);
  if (structErrs.length > 0) {
    return { pass: false, score: 0, reason: `invalid patch: ${structErrs.join('; ')}` };
  }

  const check = context?.vars?.check;
  if (!check || !check.type) {
    return { pass: false, score: 0, reason: 'test missing vars.check.type' };
  }
  const fn = DISPATCH[check.type];
  if (!fn) {
    return { pass: false, score: 0, reason: `unknown check type: ${check.type}` };
  }

  const result = fn(patch, check);
  return { pass: result.pass, score: result.pass ? 1 : 0, reason: result.reason };
}
