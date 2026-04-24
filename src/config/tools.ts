import { z } from 'zod';
import { configPatchSchema, SLOT_KEYS, type ConfigPatch } from './schema';
import { validateExprDetailed } from './expr';

type ToolFn = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

function toolFn(name: string, description: string, argsSchema: z.ZodType): ToolFn {
  const params = z.toJSONSchema(argsSchema, { target: 'openapi-3.0' });
  return {
    type: 'function',
    function: { name, description, parameters: params as Record<string, unknown> },
  };
}

const updateConfigArgs = z.object({ patch: configPatchSchema });

export const toolDefinitions: ToolFn[] = [
  toolFn(
    'updateConfig',
    'Update the HN reader configuration. Top-level fields: feed, storyLimit, palette, slots, hide, keepOnly, style. Use slots.{name} to set an Expr or null. Use hide:[...] to hide listed slots. Use keepOnly:[...] to hide every text slot NOT listed (preferred for "show only X" requests). Use style.{target}.{prop} for visual styling (fontSize, color, fontWeight, backgroundColor, borderRadius, padding, …). See the system prompt for slot/target names and Expr shape. INCLUDE ONLY THE FIELDS YOU WANT TO CHANGE.',
    updateConfigArgs,
  ),
];

export type ToolAction = { type: 'updateConfig'; patch: ConfigPatch };

export type ParseResult = { ok: true; action: ToolAction } | { ok: false; error: string };

const SLOT_KEY_SET = new Set<string>(SLOT_KEYS as readonly string[]);

// Pre-validate slot Exprs with the detailed validator so the model gets
// readable, actionable feedback instead of Zod's opaque "Invalid input"
// union error.
function preValidatePatchSlots(patch: unknown): string[] {
  if (!patch || typeof patch !== 'object') return [];
  const p = patch as { slots?: unknown; style?: unknown };
  const slots = p.slots;
  if (!slots || typeof slots !== 'object') return [];
  const styledTargets =
    p.style && typeof p.style === 'object' ? new Set(Object.keys(p.style)) : new Set<string>();
  const errs: string[] = [];
  for (const [slot, val] of Object.entries(slots as Record<string, unknown>)) {
    if (!SLOT_KEY_SET.has(slot)) {
      errs.push(`slots.${slot} is not a known slot — valid: ${[...SLOT_KEY_SET].join(', ')}`);
      continue;
    }
    if (val === null) {
      if (slot === 'visible') {
        errs.push(
          `slots.visible cannot be null — visible is a boolean predicate, not a hideable text slot. Provide an Expr that returns true/false (e.g. {"fn":"gt","args":[{"var":"item.score"},{"lit":100}]}), or omit visible from the patch to leave it at default.`,
        );
      }
      continue;
    }
    const slotErrs = validateExprDetailed(val, `slots.${slot}`);
    if (slotErrs.length > 0 && styledTargets.has(slot)) {
      // Common failure: model includes slots.X alongside style.X for the same target,
      // botching the slot Expr in an attempt to "preserve" the text. Tell it to drop slots.X.
      errs.push(
        `slots.${slot} is malformed AND style.${slot} is also being set — for a pure style change, OMIT slots.${slot} from the patch entirely (slot text content is preserved automatically when you don't include it). Underlying error: ${slotErrs.join('; ')}`,
      );
    } else {
      errs.push(...slotErrs);
    }
  }
  return errs;
}

export function parseToolAction(name: string, argsJson: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argsJson);
  } catch {
    return { ok: false, error: `tool "${name}" args not valid JSON: ${argsJson.slice(0, 200)}` };
  }
  if (name !== 'updateConfig') return { ok: false, error: `unknown tool: ${name}` };

  // Run our detailed Expr validator first. If it finds slot-level problems,
  // surface them — they're far more actionable than the Zod union error.
  const slotErrs = preValidatePatchSlots((parsed as { patch?: unknown })?.patch);
  if (slotErrs.length > 0) {
    return { ok: false, error: `tool "${name}" args invalid: ${slotErrs.join('; ')}` };
  }

  try {
    const a = updateConfigArgs.parse(parsed);
    return { ok: true, action: { type: 'updateConfig', patch: a.patch } };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return {
        ok: false,
        error: `tool "${name}" args invalid: ${e.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
      };
    }
    return { ok: false, error: String(e) };
  }
}
