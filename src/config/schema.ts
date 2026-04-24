import { z } from 'zod';
import { exprSchema } from './expr';

export const FEEDS = ['top', 'new', 'best', 'ask', 'show', 'jobs'] as const;
export type Feed = (typeof FEEDS)[number];

const paletteSchema = z.object({
  background: z.string(),
  foreground: z.string(),
  accent: z.string(),
  muted: z.string(),
});

const slotsSchema = z
  .object({
    header: exprSchema.nullable().optional(),
    rank: exprSchema.nullable().optional(),
    title: exprSchema.nullable().optional(),
    domain: exprSchema.nullable().optional(),
    score: exprSchema.nullable().optional(),
    author: exprSchema.nullable().optional(),
    age: exprSchema.nullable().optional(),
    comments: exprSchema.nullable().optional(),
    // visible is a boolean predicate — null doesn't make sense for it. Reject so
    // the model retries instead of silently filtering every row out of the list.
    visible: exprSchema.optional(),
  })
  .strict();

// Text slots — every slot except `visible` (which is a boolean predicate).
// `hide` and `keepOnly` only operate on these; they are no-ops for `visible`.
export const TEXT_SLOT_KEYS = [
  'header',
  'rank',
  'title',
  'domain',
  'score',
  'author',
  'age',
  'comments',
] as const;
export type TextSlotKey = (typeof TEXT_SLOT_KEYS)[number];

// Style targets are the text slots plus `row` (the row container).
export const STYLE_TARGETS = [...TEXT_SLOT_KEYS, 'row'] as const;
export type StyleTarget = (typeof STYLE_TARGETS)[number];

const styleValueSchema = z.union([z.string(), z.number()]);
const styleTargetSchema = z.record(z.string(), styleValueSchema);
const styleSchema = z
  .object({
    header: styleTargetSchema.optional(),
    rank: styleTargetSchema.optional(),
    title: styleTargetSchema.optional(),
    domain: styleTargetSchema.optional(),
    score: styleTargetSchema.optional(),
    author: styleTargetSchema.optional(),
    age: styleTargetSchema.optional(),
    comments: styleTargetSchema.optional(),
    row: styleTargetSchema.optional(),
  })
  .strict();

export const configSchema = z.object({
  feed: z.enum(FEEDS),
  storyLimit: z.number().int().min(1).max(100),
  palette: paletteSchema,
  slots: slotsSchema,
  style: styleSchema,
});

export type Config = z.infer<typeof configSchema>;

export const defaultConfig: Config = {
  feed: 'top',
  storyLimit: 30,
  palette: {
    background: '#f6f6ef',
    foreground: '#222222',
    accent: '#ff6600',
    muted: '#828282',
  },
  slots: {},
  style: {},
};

export const configPatchSchema = z
  .object({
    feed: z.enum(FEEDS).optional(),
    storyLimit: z.number().int().min(1).max(100).optional(),
    palette: paletteSchema.partial().optional(),
    slots: slotsSchema.optional(),
    hide: z.array(z.enum(TEXT_SLOT_KEYS)).optional(),
    keepOnly: z.array(z.enum(TEXT_SLOT_KEYS)).optional(),
    style: styleSchema.optional(),
  })
  .strict();

export type ConfigPatch = z.infer<typeof configPatchSchema>;

export const SLOT_KEYS = [
  'header',
  'rank',
  'title',
  'domain',
  'score',
  'author',
  'age',
  'comments',
  'visible',
] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];

// Slots that compose the meta line under the title. Renderer joins non-empty
// values with " · " in this order, so each slot can be hidden independently.
export const META_SLOT_KEYS = ['score', 'author', 'age', 'comments'] as const;

export const SLOT_DEFAULTS: Record<SlotKey, unknown> = {
  header: {
    fn: 'concat',
    args: [{ lit: 'HN voice · ' }, { var: 'feed' }, { lit: ' · ' }, { var: 'storyLimit' }],
  },
  rank: { fn: 'concat', args: [{ var: 'rank' }, { lit: '.' }] },
  title: { var: 'item.title' },
  domain: {
    fn: 'if',
    args: [
      { var: 'item.url' },
      { fn: 'concat', args: [{ lit: ' (' }, { fn: 'host', args: [{ var: 'item.url' }] }, { lit: ')' }] },
      { lit: '' },
    ],
  },
  score: {
    fn: 'if',
    args: [
      { var: 'item.score' },
      { fn: 'concat', args: [{ var: 'item.score' }, { lit: ' points' }] },
      { lit: '' },
    ],
  },
  author: {
    fn: 'if',
    args: [
      { var: 'item.by' },
      { fn: 'concat', args: [{ lit: 'by ' }, { var: 'item.by' }] },
      { lit: '' },
    ],
  },
  age: { fn: 'ago', args: [{ var: 'item.time' }] },
  comments: {
    fn: 'if',
    args: [
      { var: 'item.descendants' },
      { fn: 'concat', args: [{ var: 'item.descendants' }, { lit: ' comments' }] },
      { lit: '' },
    ],
  },
  visible: { lit: true },
};

const HIDE_EXPR = { lit: '' } as const;

export function mergeConfig(current: Config, patch: ConfigPatch): Config {
  const next: Config = { ...current };
  if (patch.feed !== undefined) next.feed = patch.feed;
  if (patch.storyLimit !== undefined) next.storyLimit = patch.storyLimit;
  if (patch.palette) next.palette = { ...current.palette, ...patch.palette };

  let slots: Config['slots'] = { ...current.slots };
  let touched = false;

  if (patch.slots) {
    touched = true;
    for (const key of SLOT_KEYS) {
      if (key in patch.slots) {
        const v = patch.slots[key];
        slots[key] = v === null ? HIDE_EXPR : v;
      }
    }
  }

  if (patch.hide) {
    touched = true;
    for (const key of patch.hide) slots[key] = HIDE_EXPR;
  }

  if (patch.keepOnly) {
    touched = true;
    const keep = new Set<string>(patch.keepOnly);
    for (const key of TEXT_SLOT_KEYS) {
      if (!keep.has(key)) slots[key] = HIDE_EXPR;
    }
  }

  if (touched) next.slots = slots;

  if (patch.style) {
    const style: Config['style'] = { ...current.style };
    for (const target of STYLE_TARGETS) {
      const props = patch.style[target];
      if (!props) continue;
      style[target] = { ...(style[target] ?? {}), ...props };
    }
    next.style = style;
  }

  return next;
}
