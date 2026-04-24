import { type Config, SLOT_DEFAULTS, SLOT_KEYS } from '../config/schema';
import { toolDefinitions, parseToolAction, type ToolAction } from '../config/tools';
import { FUNCTION_DOCS } from '../config/expr';

const SLOT_DESCRIPTIONS: Record<(typeof SLOT_KEYS)[number], string> = {
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

const BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_LMSTUDIO_URL) ||
  'http://127.0.0.1:1234/v1';
const MODEL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_LMSTUDIO_MODEL) ||
  'google/gemma-4-e4b';

type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content?: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

type ChatResponse = {
  choices: Array<{
    message: { role: 'assistant'; content?: string | null; tool_calls?: ToolCall[] };
    finish_reason: string;
  }>;
};

function systemPrompt(current: Config): string {
  return [
    'You configure a Hacker News reader by calling updateConfig. Respond with exactly ONE tool call. Never output prose.',
    '',
    '# How rendering works',
    'Each story row has these slots. Each slot is an Expr that is re-evaluated for every item.',
    '',
    ...SLOT_KEYS.map((k) => `  slots.${k.padEnd(7)} — ${SLOT_DESCRIPTIONS[k]}`),
    '',
    '# Choosing the right slot value',
    '  HIDE / REMOVE / OMIT a slot   →  the JSON literal null  e.g. {"slots":{"rank":null}}',
    '  RESET to default              →  send the default Expr below verbatim',
    '  CHANGE the rendering          →  send a new Expr',
    '',
    '  A patch may include multiple slot keys at once: {"slots":{"rank":null,"author":null}} hides both.',
    '',
    '# Shorthand for multi-slot hides (PREFER these over slots:{...:null} when many slots are involved)',
    '  Hide a list of slots:        {"hide": ["rank","domain"]}',
    '  Keep ONLY a list of slots:   {"keepOnly": ["title","score"]}    // hides every other text slot',
    '  Use keepOnly for "show only X" / "show X and Y only" / "compact view keeping X" requests —',
    '  you only name what to KEEP and the dispatcher hides the complement automatically.',
    '  hide/keepOnly only operate on text slots (not visible).',
    '',
    '# slots.visible vs hiding cells',
    '  slots.visible drops ENTIRE ROWS from the list. Use it ONLY for predicates over item-level criteria',
    '  (score, host, author, age, title text content).',
    '  To change what each row LOOKS LIKE — including making a row show only some of its slots — set the',
    '  unwanted text slots to null. visible has nothing to do with per-cell visibility.',
    '',
    '# Defaults (copy and modify these as starting points)',
    ...SLOT_KEYS.map((k) => `  slots.${k.padEnd(7)} default = ${JSON.stringify(SLOT_DEFAULTS[k])}`),
    '',
    '# Expr — the expression tree',
    'An Expr is EXACTLY one of these three shapes:',
    '  { "lit": <string|number|boolean> }              — a literal',
    '  { "var": "<name>" }                              — a variable',
    '  { "fn": "<name>", "args": [ <Expr>, ... ] }      — a function call',
    '',
    '# Variables',
    '  Always available: now (unix seconds), feed, storyLimit',
    '  Per-item slots only (header sees these as undefined): index (0-based), rank (1-based), total,',
    '    item.title, item.score, item.by, item.time, item.url, item.descendants, item.id',
    '  Missing fields read as undefined; concat treats them as "".',
    '',
    '# Functions (closed set — DO NOT invent names)',
    FUNCTION_DOCS,
    '',
    '# Other knobs (flat, not Expr)',
    "  feed: 'top' | 'new' | 'best' | 'ask' | 'show' | 'jobs'",
    '  storyLimit: integer 1..100',
    '  palette: { background, foreground, accent, muted } — hex color strings',
    '',
    '# Visual styling — patch.style is a TOP-LEVEL field, sibling to slots',
    '  Two distinct paths in the patch:',
    '    patch.slots.{name}    — text content (an Expr)',
    '    patch.style.{name}    — visual styling (a {prop:value} map)',
    '  These are SEPARATE top-level fields. style does NOT go inside slots.',
    '',
    '  Style targets: header, rank, title, domain, score, author, age, comments, row (full row container).',
    '  Common props (any RN style accepted): fontSize (number), color (hex/name), fontWeight ("bold"|"700"…),',
    '  fontStyle ("italic"), backgroundColor, borderRadius, padding, paddingHorizontal, paddingVertical,',
    '  marginTop, opacity, lineHeight. Values are strings or numbers.',
    '',
    '  Style is static — set once per command, NOT Expr-evaluated per item.',
    '',
    '  Decide which path by what changes:',
    '    text content / what the row says → slots.{name}',
    '    visual / aesthetic (color, size, weight, italic, padding, background, corners) → style.{target}.{prop}',
    '',
    '  Examples (note style is at the SAME level as slots, not nested under it):',
    '    {"style":{"title":{"fontSize":24}}}',
    '    {"style":{"score":{"color":"#ff0000","fontWeight":"bold"}}}',
    '    {"style":{"row":{"borderRadius":8,"padding":16}}}',
    '',
    '# Composition examples (study the Expr shapes, not the phrasings)',
    '',
    '// nested fn + lit + var: "rank as letter A. B. C."',
    'updateConfig({"patch":{"slots":{"rank":{"fn":"concat","args":[{"fn":"letter","args":[{"var":"index"}]},{"lit":"."}]}}}})',
    '',
    '// fn(var, lit) → boolean for filtering',
    'updateConfig({"patch":{"slots":{"visible":{"fn":"gt","args":[{"var":"item.score"},{"lit":100}]}}}})',
    '',
    '// if(cond, then, else) for conditional formatting',
    'updateConfig({"patch":{"slots":{"title":{"fn":"concat","args":[{"fn":"if","args":[{"fn":"ge","args":[{"var":"item.score"},{"lit":500}]},{"lit":"🔥 "},{"lit":""}]},{"var":"item.title"}]}}}})',
    '',
    '# Current config (for reference)',
    JSON.stringify(current),
  ].join('\n');
}

export type RequestResult =
  | { ok: true; actions: ToolAction[]; raw: Array<{ name: string; arguments: string }> }
  | { ok: false; error: string };

const MAX_RETRIES = 1;

export async function requestAction(
  current: Config,
  utterance: string,
  opts: { signal?: AbortSignal; baseUrl?: string; model?: string } = {},
): Promise<RequestResult> {
  const base = opts.baseUrl ?? BASE_URL;
  const model = opts.model ?? MODEL;
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(current) },
    { role: 'user', content: utterance },
  ];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const body = {
      model,
      messages,
      tools: toolDefinitions,
      tool_choice: 'required',
      temperature: 0,
    };
    let res: Response;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (e) {
      return { ok: false, error: `network: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (!res.ok) {
      return { ok: false, error: `http ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }
    const json = (await res.json()) as ChatResponse;
    const assistantMsg = json.choices?.[0]?.message;
    const calls = assistantMsg?.tool_calls ?? [];
    if (calls.length === 0) return { ok: false, error: 'no tool call in response' };

    const actions: ToolAction[] = [];
    const raw: Array<{ name: string; arguments: string }> = [];
    const failures: Array<{ call: ToolCall; error: string }> = [];
    for (const call of calls) {
      const parsed = parseToolAction(call.function.name, call.function.arguments);
      if (parsed.ok) {
        actions.push(parsed.action);
        raw.push({ name: call.function.name, arguments: call.function.arguments });
      } else {
        failures.push({ call, error: parsed.error });
      }
    }

    if (failures.length === 0) return { ok: true, actions, raw };
    if (attempt === MAX_RETRIES) {
      return { ok: false, error: failures.map((f) => f.error).join(' | ') };
    }

    messages.push({
      role: 'assistant',
      content: assistantMsg?.content ?? null,
      tool_calls: calls,
    });
    for (const f of failures) {
      messages.push({
        role: 'tool',
        tool_call_id: f.call.id,
        content: `Validation failed: ${f.error}\nFix the JSON and call updateConfig again.`,
      });
    }
  }
  return { ok: false, error: 'retry loop exhausted' };
}

export function getConfiguredEndpoint() {
  return { baseUrl: BASE_URL, model: MODEL };
}
