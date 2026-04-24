// Intent-checking helpers used by promptfoo assertions.
// They normalize equivalent patch shapes so assertions check intent, not syntax:
//   {slots:{author:null}}  ≡  {hide:["author"]}  ≡  {keepOnly:[<everything except author>]}

import { TEXT_SLOT_KEYS, SLOT_KEYS, KNOWN_FUNCTIONS, KNOWN_VARS, KNOWN_ITEM_FIELDS } from './snapshot.mjs';

const TEXT_SLOTS_SET = new Set(TEXT_SLOT_KEYS);

function isHideExpr(v) {
  if (v === null) return true;
  if (v && typeof v === 'object' && Object.keys(v).length === 1 && v.lit === '') return true;
  return false;
}

// Returns Set<TextSlotKey> of text slots that this patch hides.
export function hiddenSet(patch) {
  if (!patch || typeof patch !== 'object') return new Set();
  const hidden = new Set();
  if (patch.slots && typeof patch.slots === 'object') {
    for (const [k, v] of Object.entries(patch.slots)) {
      if (TEXT_SLOTS_SET.has(k) && isHideExpr(v)) hidden.add(k);
    }
  }
  if (Array.isArray(patch.hide)) {
    for (const k of patch.hide) if (TEXT_SLOTS_SET.has(k)) hidden.add(k);
  }
  if (Array.isArray(patch.keepOnly)) {
    const keep = new Set(patch.keepOnly);
    for (const k of TEXT_SLOT_KEYS) if (!keep.has(k)) hidden.add(k);
  }
  return hidden;
}

// Returns Set<TextSlotKey> of text slots set to a non-hide Expr (meaning customized).
export function customizedSet(patch) {
  const customized = new Set();
  if (!patch?.slots || typeof patch.slots !== 'object') return customized;
  for (const [k, v] of Object.entries(patch.slots)) {
    if (TEXT_SLOTS_SET.has(k) && !isHideExpr(v) && v != null) customized.add(k);
  }
  return customized;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function setsToString(s) {
  return `{${[...s].sort().join(',')}}`;
}

// === High-level intent checks. Each returns {pass: bool, reason: string} ===

// patch hides EXACTLY these text slots and customizes none.
export function expectHidesExactly(patch, slots) {
  const expected = new Set(slots);
  const actual = hiddenSet(patch);
  if (setsEqual(expected, actual)) return { pass: true, reason: `hides ${setsToString(expected)}` };
  return {
    pass: false,
    reason: `expected hidden=${setsToString(expected)}, got hidden=${setsToString(actual)}`,
  };
}

// patch hides at least these text slots (may also hide others, may customize others).
export function expectHidesAtLeast(patch, slots) {
  const required = new Set(slots);
  const actual = hiddenSet(patch);
  const missing = [...required].filter((s) => !actual.has(s));
  if (missing.length === 0) return { pass: true, reason: `hides ⊇ ${setsToString(required)}` };
  return {
    pass: false,
    reason: `missing hides for: ${missing.join(',')} — actual hidden=${setsToString(actual)}`,
  };
}

// patch keeps ONLY these text slots visible (hides every other text slot).
// Equivalent to: hidden == TEXT_SLOTS - keep.
export function expectKeepsOnly(patch, slots) {
  const keep = new Set(slots);
  const expected = new Set(TEXT_SLOT_KEYS.filter((k) => !keep.has(k)));
  const actual = hiddenSet(patch);
  if (setsEqual(expected, actual)) return { pass: true, reason: `keeps only ${setsToString(keep)}` };
  return {
    pass: false,
    reason: `keepOnly=${setsToString(keep)} requires hidden=${setsToString(expected)}, got hidden=${setsToString(actual)}`,
  };
}

// patch sets visible to a non-default Expr (i.e. installs a row filter).
export function expectFilter(patch) {
  const v = patch?.slots?.visible;
  if (v && typeof v === 'object' && (v.fn || v.var) && !isHideExpr(v)) {
    return { pass: true, reason: `visible filter installed` };
  }
  return { pass: false, reason: `expected slots.visible to be a non-default Expr; got ${JSON.stringify(v)}` };
}

// patch sets feed=value, optionally allowing other fields.
export function expectFeed(patch, value) {
  if (patch?.feed === value) return { pass: true, reason: `feed=${value}` };
  return { pass: false, reason: `expected feed=${value}, got ${patch?.feed}` };
}

// patch sets palette (any subset of palette keys).
export function expectPalette(patch) {
  if (patch?.palette && typeof patch.palette === 'object' && Object.keys(patch.palette).length > 0) {
    return { pass: true, reason: `palette set: ${Object.keys(patch.palette).join(',')}` };
  }
  return { pass: false, reason: `expected palette change; got ${JSON.stringify(patch?.palette)}` };
}

// patch sets slots[slot] to a non-default Expr (customized rendering).
export function expectCustomizes(patch, slot) {
  const customized = customizedSet(patch);
  if (customized.has(slot)) return { pass: true, reason: `customizes ${slot}` };
  return {
    pass: false,
    reason: `expected slots.${slot} to be a custom Expr; customized=${setsToString(customized)}`,
  };
}

// patch sets style.{slot}.{prop} to value (or any value if value is undefined).
// Used for the upcoming patch.style feature.
export function expectStyle(patch, slot, prop, value) {
  const s = patch?.style?.[slot];
  if (!s || typeof s !== 'object') {
    return { pass: false, reason: `expected style.${slot}.${prop}; got style=${JSON.stringify(patch?.style)}` };
  }
  if (!(prop in s)) {
    return { pass: false, reason: `expected style.${slot}.${prop}; got style.${slot}=${JSON.stringify(s)}` };
  }
  if (value !== undefined && s[prop] !== value) {
    return { pass: false, reason: `expected style.${slot}.${prop}=${value}; got ${s[prop]}` };
  }
  return { pass: true, reason: `style.${slot}.${prop}=${s[prop]}` };
}

// patch sets ANY of the listed props on style.{slot} (lenient match).
// Useful when several CSS-equivalent props would satisfy the user intent
// (e.g. "more padding" could be padding, paddingVertical, marginBottom).
export function expectStyleOneOf(patch, slot, props) {
  const s = patch?.style?.[slot];
  if (!s || typeof s !== 'object') {
    return { pass: false, reason: `expected style.${slot}.{${props.join('|')}}; got style=${JSON.stringify(patch?.style)}` };
  }
  const matched = props.find((p) => p in s);
  if (matched) return { pass: true, reason: `style.${slot}.${matched}=${s[matched]}` };
  return { pass: false, reason: `expected style.${slot}.{${props.join('|')}}; got style.${slot}=${JSON.stringify(s)}` };
}

// === Expr structural validation (mirrors src/config/expr.ts validateExprDetailed) ===

export function validateExpr(node, path = '<root>') {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return [`${path} must be an Expr object`];
  }
  const keys = Object.keys(node);
  if (keys.length === 1 && keys[0] === 'lit') {
    const t = typeof node.lit;
    if (t !== 'string' && t !== 'number' && t !== 'boolean') return [`${path}.lit must be string|number|boolean`];
    return [];
  }
  if (keys.length === 1 && keys[0] === 'var') {
    if (typeof node.var !== 'string') return [`${path}.var must be a string`];
    const v = node.var;
    if (!KNOWN_VARS.has(v) && !(v.startsWith('item.') && KNOWN_ITEM_FIELDS.has(v.slice(5)))) {
      return [`${path}.var = "${v}" is not a known variable`];
    }
    return [];
  }
  if (keys.length === 2 && keys.includes('fn') && keys.includes('args')) {
    if (typeof node.fn !== 'string') return [`${path}.fn must be a string`];
    if (!Array.isArray(node.args)) return [`${path}.args must be an array`];
    if (node.fn === 'lit') {
      return [`${path}.fn = "lit" is not a function — use {"lit": <value>} for literals, not {"fn":"lit","args":[…]}.`];
    }
    if (node.fn === 'var') {
      return [`${path}.fn = "var" is not a function — use {"var": "name"} for variables, not {"fn":"var","args":[…]}.`];
    }
    if (!KNOWN_FUNCTIONS.has(node.fn)) return [`${path}.fn = "${node.fn}" is not a known function`];
    const errs = [];
    node.args.forEach((a, i) => errs.push(...validateExpr(a, `${path}.args[${i}]`)));
    return errs;
  }
  return [`${path} has invalid shape — expected exactly { lit } | { var } | { fn, args }, got keys: ${keys.join(',')}`];
}

const SLOT_KEYS_SET = new Set(SLOT_KEYS);

// Validate a whole patch (every slot Expr is well-formed, every hide/keepOnly entry is a real text slot).
export function validatePatch(patch) {
  if (!patch || typeof patch !== 'object') return ['patch must be an object'];
  const errs = [];
  if (patch.slots && typeof patch.slots === 'object') {
    for (const [slot, val] of Object.entries(patch.slots)) {
      if (!SLOT_KEYS_SET.has(slot)) {
        errs.push(`slots.${slot} is not a known slot`);
        continue;
      }
      if (val === null) continue;
      errs.push(...validateExpr(val, `slots.${slot}`));
    }
  }
  for (const list of ['hide', 'keepOnly']) {
    if (!Array.isArray(patch[list])) continue;
    for (const k of patch[list]) {
      if (!TEXT_SLOTS_SET.has(k)) errs.push(`${list}[]: "${k}" is not a text slot`);
    }
  }
  return errs;
}

// Convenience: parse the model's tool call args and return the patch (or throw).
export function parsePatch(toolCall) {
  if (!toolCall) throw new Error('no tool call');
  const args = JSON.parse(toolCall.function.arguments);
  return args.patch;
}
