import { TOOL_DEF } from './lib/tool.mjs';

const PROVIDER_CONFIG = {
  apiBaseUrl: 'http://127.0.0.1:1234/v1',
  apiKey: 'lm-studio',
  tools: [TOOL_DEF],
  tool_choice: 'required',
  temperature: 0,
};

const cases = [
  // === Single-slot hides (the "easy" baseline) ===
  { name: 'hide indexes', utterance: 'hide indexes', check: { type: 'hidesExactly', slots: ['rank'] } },
  { name: 'hide author', utterance: 'hide the author', check: { type: 'hidesExactly', slots: ['author'] } },
  { name: 'remove comments', utterance: 'remove the comment count', check: { type: 'hidesExactly', slots: ['comments'] } },
  { name: 'hide domain', utterance: 'hide the URL after titles', check: { type: 'hidesExactly', slots: ['domain'] } },
  { name: 'hide header', utterance: 'hide the header', check: { type: 'hidesExactly', slots: ['header'] } },

  // === Multi-slot hides (was historically broken pre-keepOnly) ===
  { name: 'hide rank+domain', utterance: 'hide rank and domain', check: { type: 'hidesExactly', slots: ['rank', 'domain'] } },
  { name: 'hide whole meta', utterance: 'hide the meta line', check: { type: 'hidesAtLeast', slots: ['score', 'author', 'age', 'comments'] } },

  // === Selective inclusion (the multi-element class — keepOnly's reason for existing) ===
  { name: 'show only titles', utterance: 'show only titles', check: { type: 'keepsOnly', slots: ['title'] } },
  { name: 'titles + scores only', utterance: 'show titles and scores only', check: { type: 'keepsOnly', slots: ['title', 'score'] } },
  { name: 'titles + points (synonym)', utterance: 'show me titles and points only', check: { type: 'keepsOnly', slots: ['title', 'score'] } },
  { name: 'except title+score (inverse phrasing)', utterance: 'hide everything except the title and score', check: { type: 'keepsOnly', slots: ['title', 'score'] } },
  { name: 'compact keep author', utterance: 'compact view but keep author', check: { type: 'keepsOnly', slots: ['title', 'author'] } },

  // === True row filters (visible Expr) ===
  { name: 'filter score > 100', utterance: 'only show stories with more than 100 points', check: { type: 'filter' } },
  { name: 'filter github', utterance: 'only show stories from github', check: { type: 'filter' } },
  { name: 'filter Show HN', utterance: 'only stories that start with "Show HN"', check: { type: 'filter' } },

  // === Per-row customization (Expr composition) ===
  { name: 'uppercase high-score titles', utterance: 'uppercase titles when score is over 200', check: { type: 'customizes', slot: 'title' } },
  { name: 'rank as letters', utterance: 'show rank as letters A B C', check: { type: 'customizes', slot: 'rank' } },
  { name: 'rank as roman', utterance: 'use roman numerals for the rank', check: { type: 'customizes', slot: 'rank' } },

  // === Flat knobs (no Expr) ===
  { name: 'switch to new feed', utterance: 'switch to the new feed', check: { type: 'feed', value: 'new' } },
  { name: 'switch to best', utterance: 'show me the best stories', check: { type: 'feed', value: 'best' } },
  { name: 'dark theme', utterance: 'use a dark theme', check: { type: 'palette' } },
];

export default {
  description: 'hn-voice-config baseline eval — gemma 4 e4b via LM Studio',
  providers: [
    {
      id: 'openai:chat:google/gemma-4-e4b',
      label: 'first-shot temp=0',
      config: PROVIDER_CONFIG,
    },
    {
      id: 'file://lib/retryProvider.mjs',
      label: 'production temp=0 retry=1',
      config: { maxRetries: 1, temperature: 0 },
    },
  ],
  prompts: ['file://lib/promptBuilder.mjs'],
  defaultTest: {
    assert: [{ type: 'javascript', value: 'file://lib/asserter.mjs' }],
  },
  tests: cases.map((c) => ({
    description: c.name,
    vars: { utterance: c.utterance, check: c.check },
  })),
};
