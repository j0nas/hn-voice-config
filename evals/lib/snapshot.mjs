// Frozen snapshot of slot definitions and prompt-relevant metadata.
// Hand-mirrored from src/config/{schema,expr,tools}.ts because Promptfoo
// runs in plain Node and src/ has TS + RN imports. Drift is caught by
// the smoke test in evals/smoke.test.mjs.

export const SLOT_DEFAULTS = {
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

export const SLOT_KEYS = Object.keys(SLOT_DEFAULTS);
export const TEXT_SLOT_KEYS = SLOT_KEYS.filter((k) => k !== 'visible');
export const STYLE_TARGETS = [...TEXT_SLOT_KEYS, 'row'];

export const SLOT_DESCRIPTIONS = {
  header: '→ string. App-level title bar. Default renders "HN voice · {feed} · {storyLimit}".',
  rank: '→ string. Number cell left of the title. Default renders "1.", "2.", "3."…',
  title: '→ string. Main row text. Default renders item.title.',
  domain: '→ string. Suffix after the title in muted color. Default renders " (host.com)".',
  score: '→ string. Meta-line field. Default renders "{item.score} points" — i.e. the points / upvotes count.',
  author: '→ string. Meta-line field. Default renders "by {item.by}" — i.e. the submitter username.',
  age: '→ string. Meta-line field. Default renders "{n}h ago" — i.e. the time since posting.',
  comments: '→ string. Meta-line field. Default renders "{item.descendants} comments" — i.e. the comment count.',
  visible: '→ boolean. Row predicate. If false, the entire row is filtered out of the list.',
};

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

export const KNOWN_FUNCTIONS = new Set([
  'concat','upper','lower','slice','replace','pad','str','len','contains','starts','ends',
  'add','sub','mul','div','mod','floor','ceil','round','min','max',
  'eq','ne','lt','le','gt','ge','and','or','not','if',
  'letter','roman','hex','repeat','ago','host','default',
]);

export const KNOWN_VARS = new Set(['index', 'rank', 'total', 'now', 'feed', 'storyLimit']);
export const KNOWN_ITEM_FIELDS = new Set(['id','title','score','by','time','url','descendants','text','type']);

export const DEFAULT_CONFIG = {
  feed: 'top',
  storyLimit: 30,
  palette: { background: '#f6f6ef', foreground: '#222222', accent: '#ff6600', muted: '#828282' },
  slots: {},
  style: {},
};
