import { SLOT_KEYS, TEXT_SLOT_KEYS, STYLE_TARGETS } from './snapshot.mjs';

const exprJsonSchema = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['lit'],
      properties: { lit: { type: ['string', 'number', 'boolean'] } },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['var'],
      properties: { var: { type: 'string' } },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['fn', 'args'],
      properties: {
        fn: { type: 'string' },
        args: { type: 'array', items: { $ref: '#/$defs/expr' } },
      },
    },
  ],
};

export const TOOL_DEF = {
  type: 'function',
  function: {
    name: 'updateConfig',
    description:
      'Update the HN reader configuration. Top-level fields: feed, storyLimit, palette, slots, hide, keepOnly, style. Use slots.{name} to set an Expr or null. Use hide:[...] to hide listed slots. Use keepOnly:[...] to hide every text slot NOT listed (preferred for "show only X" requests). Use style.{target}.{prop} for visual styling (fontSize, color, fontWeight, backgroundColor, borderRadius, padding, …). See the system prompt for slot/target names and Expr shape. INCLUDE ONLY THE FIELDS YOU WANT TO CHANGE.',
    parameters: {
      type: 'object',
      $defs: { expr: exprJsonSchema },
      additionalProperties: false,
      required: ['patch'],
      properties: {
        patch: {
          type: 'object',
          additionalProperties: false,
          properties: {
            feed: { enum: ['top', 'new', 'best', 'ask', 'show', 'jobs'] },
            storyLimit: { type: 'integer', minimum: 1, maximum: 100 },
            palette: {
              type: 'object',
              additionalProperties: false,
              properties: {
                background: { type: 'string' },
                foreground: { type: 'string' },
                accent: { type: 'string' },
                muted: { type: 'string' },
              },
            },
            slots: {
              type: 'object',
              additionalProperties: false,
              properties: Object.fromEntries(
                SLOT_KEYS.map((k) => [k, { oneOf: [{ type: 'null' }, exprJsonSchema] }]),
              ),
            },
            hide: { type: 'array', items: { enum: TEXT_SLOT_KEYS } },
            keepOnly: { type: 'array', items: { enum: TEXT_SLOT_KEYS } },
            style: {
              type: 'object',
              additionalProperties: false,
              properties: Object.fromEntries(
                STYLE_TARGETS.map((t) => [
                  t,
                  {
                    type: 'object',
                    additionalProperties: { type: ['string', 'number'] },
                  },
                ]),
              ),
            },
          },
        },
      },
    },
  },
};
