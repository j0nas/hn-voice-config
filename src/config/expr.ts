import { z } from 'zod';
import type { HNItem } from '../api/hn';

export type Expr =
  | { lit: string | number | boolean }
  | { var: string }
  | { fn: string; args: Expr[] };

export const KNOWN_VARS = ['index', 'rank', 'total', 'now', 'feed', 'storyLimit'] as const;
export const KNOWN_ITEM_FIELDS = [
  'id',
  'title',
  'score',
  'by',
  'time',
  'url',
  'descendants',
  'text',
  'type',
] as const;

const varNameSchema = z.string().refine(
  (name) =>
    (KNOWN_VARS as readonly string[]).includes(name) ||
    (name.startsWith('item.') &&
      (KNOWN_ITEM_FIELDS as readonly string[]).includes(name.slice(5))),
  { message: 'unknown variable — must be index|rank|total|now or item.{title,score,by,time,url,descendants,text,id,type}' },
);

export const KNOWN_FUNCTIONS = [
  'concat', 'upper', 'lower', 'slice', 'replace', 'pad', 'str', 'len',
  'contains', 'starts', 'ends',
  'add', 'sub', 'mul', 'div', 'mod', 'floor', 'ceil', 'round', 'min', 'max',
  'eq', 'ne', 'lt', 'le', 'gt', 'ge',
  'and', 'or', 'not', 'if',
  'letter', 'roman', 'hex', 'repeat', 'ago', 'host', 'default',
] as const;

const fnNameSchema = z
  .string()
  .refine((n) => (KNOWN_FUNCTIONS as readonly string[]).includes(n), {
    message: 'unknown function — see Functions list',
  });

export const exprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.union([
    z.object({ lit: z.union([z.string(), z.number(), z.boolean()]) }).strict(),
    z.object({ var: varNameSchema }).strict(),
    z.object({ fn: fnNameSchema, args: z.array(exprSchema) }).strict(),
  ]),
);

export type EvalContext = {
  // App-level (always meaningful)
  now: number;
  feed: string;
  storyLimit: number;
  // Row-level (only meaningful inside per-item slots)
  index?: number;
  rank?: number;
  total?: number;
  item?: HNItem;
};

export class ExprError extends Error {}

const FUNCTIONS: Record<string, (args: unknown[]) => unknown> = {
  concat: (args) => args.map((a) => (a == null ? '' : String(a))).join(''),
  upper: ([s]) => String(s ?? '').toUpperCase(),
  lower: ([s]) => String(s ?? '').toLowerCase(),
  slice: ([s, start, end]) =>
    String(s ?? '').slice(Number(start), end == null ? undefined : Number(end)),
  replace: ([s, find, rep]) => String(s ?? '').split(String(find)).join(String(rep)),
  pad: ([s, width, ch]) => String(s ?? '').padStart(Number(width), String(ch ?? ' ')),
  str: ([x]) => (x == null ? '' : String(x)),
  len: ([s]) => String(s ?? '').length,
  contains: ([s, needle]) => String(s ?? '').toLowerCase().includes(String(needle ?? '').toLowerCase()),
  starts: ([s, prefix]) => String(s ?? '').toLowerCase().startsWith(String(prefix ?? '').toLowerCase()),
  ends: ([s, suffix]) => String(s ?? '').toLowerCase().endsWith(String(suffix ?? '').toLowerCase()),

  add: (args) => args.reduce<number>((a, b) => a + Number(b), 0),
  sub: ([a, b]) => Number(a) - Number(b),
  mul: (args) => args.reduce<number>((a, b) => a * Number(b), 1),
  div: ([a, b]) => (Number(b) === 0 ? 0 : Number(a) / Number(b)),
  mod: ([a, b]) => (Number(b) === 0 ? 0 : Number(a) % Number(b)),
  floor: ([x]) => Math.floor(Number(x)),
  ceil: ([x]) => Math.ceil(Number(x)),
  round: ([x]) => Math.round(Number(x)),
  min: (args) => Math.min(...args.map(Number)),
  max: (args) => Math.max(...args.map(Number)),

  eq: ([a, b]) => a === b || String(a) === String(b),
  ne: ([a, b]) => !(a === b || String(a) === String(b)),
  lt: ([a, b]) => Number(a) < Number(b),
  le: ([a, b]) => Number(a) <= Number(b),
  gt: ([a, b]) => Number(a) > Number(b),
  ge: ([a, b]) => Number(a) >= Number(b),

  and: (args) => args.every(Boolean),
  or: (args) => args.some(Boolean),
  not: ([x]) => !x,

  letter: ([n]) => {
    let i = Math.max(0, Math.floor(Number(n)));
    let out = '';
    do {
      out = String.fromCharCode(65 + (i % 26)) + out;
      i = Math.floor(i / 26) - 1;
    } while (i >= 0);
    return out;
  },
  roman: ([n]) => {
    const v = Math.max(0, Math.floor(Number(n)));
    if (v <= 0) return '';
    const map: Array<[number, string]> = [
      [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
      [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
      [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
    ];
    let out = '';
    let r = v;
    for (const [val, sym] of map) {
      while (r >= val) { out += sym; r -= val; }
    }
    return out;
  },
  hex: ([n]) => Math.floor(Number(n)).toString(16).toUpperCase(),
  repeat: ([s, n]) => {
    const count = Math.max(0, Math.min(200, Math.floor(Number(n))));
    return String(s ?? '').repeat(count);
  },
  ago: ([seconds]) => {
    const s = Number(seconds);
    if (!Number.isFinite(s) || s <= 0) return '';
    const diff = Math.max(0, Date.now() / 1000 - s);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  },
  host: ([url]) => {
    try { return new URL(String(url)).hostname.replace(/^www\./, ''); }
    catch { return ''; }
  },
  default: ([a, b]) => (a == null || a === '' ? b : a),
};

function getVar(path: string, ctx: EvalContext): unknown {
  if (path === 'index') return ctx.index;
  if (path === 'rank') return ctx.rank;
  if (path === 'total') return ctx.total;
  if (path === 'now') return ctx.now;
  if (path === 'feed') return ctx.feed;
  if (path === 'storyLimit') return ctx.storyLimit;
  if (path.startsWith('item.')) {
    const key = path.slice(5);
    if (!ctx.item) return undefined;
    return (ctx.item as unknown as Record<string, unknown>)[key];
  }
  throw new ExprError(`Unknown variable: ${path}`);
}

function evalNode(node: Expr, ctx: EvalContext, depth: number): unknown {
  if (depth > 64) throw new ExprError('Expression too deeply nested');
  if ('lit' in node) return node.lit;
  if ('var' in node) return getVar(node.var, ctx);
  if (node.fn === 'if') {
    if (node.args.length !== 3) throw new ExprError('if requires 3 args');
    const cond = evalNode(node.args[0], ctx, depth + 1);
    return cond ? evalNode(node.args[1], ctx, depth + 1) : evalNode(node.args[2], ctx, depth + 1);
  }
  const fn = FUNCTIONS[node.fn];
  if (!fn) throw new ExprError(`Unknown function: ${node.fn}`);
  const evaled = node.args.map((a) => evalNode(a, ctx, depth + 1));
  return fn(evaled);
}

export function evalExpr(expr: unknown, ctx: EvalContext): unknown {
  const parsed = exprSchema.safeParse(expr);
  if (!parsed.success) {
    throw new ExprError(`Invalid expression: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  }
  return evalNode(parsed.data, ctx, 0);
}

export function evalToString(
  expr: unknown,
  ctx: EvalContext,
  fallback: string,
): { value: string; error?: string } {
  try {
    const v = evalExpr(expr, ctx);
    return { value: v == null ? '' : String(v) };
  } catch (e) {
    return { value: fallback, error: e instanceof Error ? e.message : String(e) };
  }
}

export function evalToBool(
  expr: unknown,
  ctx: EvalContext,
  fallback: boolean,
): { value: boolean; error?: string } {
  try {
    const v = evalExpr(expr, ctx);
    return { value: Boolean(v) };
  } catch (e) {
    return { value: fallback, error: e instanceof Error ? e.message : String(e) };
  }
}

// Detailed Expr validator that returns human-readable error messages anchored
// at JSON paths. Used by the LLM-feedback retry loop in place of Zod's
// opaque "Invalid input" union errors so the model can self-correct.
export function validateExprDetailed(node: unknown, path = '<root>'): string[] {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return [`${path} must be an Expr object — got ${node === null ? 'null' : typeof node}`];
  }
  const keys = Object.keys(node as object);
  const obj = node as Record<string, unknown>;
  if (keys.length === 1 && keys[0] === 'lit') {
    const t = typeof obj.lit;
    if (t !== 'string' && t !== 'number' && t !== 'boolean') {
      return [`${path}.lit must be string|number|boolean — got ${t}`];
    }
    return [];
  }
  if (keys.length === 1 && keys[0] === 'var') {
    if (typeof obj.var !== 'string') return [`${path}.var must be a string`];
    const v = obj.var;
    const valid =
      (KNOWN_VARS as readonly string[]).includes(v) ||
      (v.startsWith('item.') &&
        (KNOWN_ITEM_FIELDS as readonly string[]).includes(v.slice(5)));
    if (!valid) {
      return [`${path}.var = "${v}" is not a known variable (valid: ${KNOWN_VARS.join(', ')}, item.{${KNOWN_ITEM_FIELDS.join(', ')}})`];
    }
    return [];
  }
  if (keys.length === 2 && keys.includes('fn') && keys.includes('args')) {
    const errs: string[] = [];
    if (typeof obj.fn !== 'string') {
      errs.push(`${path}.fn must be a string`);
    } else if (obj.fn === 'lit') {
      errs.push(
        `${path}.fn = "lit" is not a function — "lit" is a property marker. To make a literal use {"lit": <value>} (e.g. {"lit": "hi"}), not {"fn":"lit","args":[…]}.`,
      );
    } else if (obj.fn === 'var') {
      errs.push(
        `${path}.fn = "var" is not a function — "var" is a property marker. To read a variable use {"var": "name"}, not {"fn":"var","args":[…]}.`,
      );
    } else if (!(KNOWN_FUNCTIONS as readonly string[]).includes(obj.fn)) {
      errs.push(`${path}.fn = "${obj.fn}" is not a known function`);
    }
    if (!Array.isArray(obj.args)) {
      errs.push(`${path}.args must be an array`);
    } else {
      obj.args.forEach((a, i) => errs.push(...validateExprDetailed(a, `${path}.args[${i}]`)));
    }
    return errs;
  }
  return [
    `${path} has invalid shape — Expr must be exactly one of {lit:...} | {var:...} | {fn:...,args:[...]}, but got keys: ${keys.join(',')}`,
  ];
}

export const FUNCTION_DOCS = [
  'Strings: concat(...parts), upper(s), lower(s), slice(s,start,end?), replace(s,find,rep), pad(s,width,ch?), str(x), len(s)',
  '         contains(s,needle), starts(s,prefix), ends(s,suffix)  // all case-insensitive',
  'Numbers: add(...), sub(a,b), mul(...), div(a,b), mod(a,b), floor(x), ceil(x), round(x), min(...), max(...)',
  'Compare: eq(a,b), ne(a,b)  // fall back to string equality if types differ',
  '         lt(a,b), le(a,b), gt(a,b), ge(a,b)  // numeric',
  'Logic: and(...), or(...), not(x)  // truthy/falsy, not strict bool',
  'Control: if(cond,then,else)',
  'Format: letter(n) // 0->A, 25->Z, 26->AA',
  '        roman(n)  // 1->I, 4->IV',
  '        hex(n)    // 10->A',
  '        repeat(s,n), ago(unixSeconds), host(url)',
  'Misc: default(value,fallback) // fallback if value is null or ""',
].join('\n');
