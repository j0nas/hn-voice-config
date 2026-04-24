# AGENTS

Voice-configurable HN reader PoC. Ships on-device with Gemma 4 E2B/E4B; dev'd against LM Studio.

## Core principle

LLM = inference engine, not phrase-mapper. Compose from small orthogonal primitives. **Never** add per-phrase prompt examples, switch branches, or tool variants. If a phrase fails, fix the primitive.

Mapper-drift to reject in PRs: per-phrase prompt examples; tool-surface additions duplicating existing primitives; phrase-recognizing switches in dispatch.

## When the model fights you

Prompting can't beat strong model priors at E4B. In order:

1. **Clarify the primitive** in the prompt's concept section (one paragraph, not examples).
2. **Surface validator errors** so the model self-corrects (one terse retry — no schema lectures, they hurt small-model output).
3. **Realign the API to the model's intuition**:
   - *Rebind a sentinel* (`null` → hide, not reset).
   - *Add a primitive that takes the model's natural output shape.* When the model is weak at compositional output (set-complement), expose a tool field that takes the *list of names* and let the dispatcher do the arithmetic (`keepOnly:[...]` / `hide:[...]` instead of `slots:{a:null,b:null,…}`).

## Gemma 4 E2B/E4B

- 128K context — primitive clarity, not token budget, is the bottleneck.
- Native `system` role + tool calling + JSON output. No grammar-constrained generation.
- E2B ~4 GB on-device. Prompt tokens still cost inference latency.
- Subtle prompt distinctions ("hide" vs "reset" both → null) are unreliable — realign instead.

## Eval harness (`evals/`)

Promptfoo + LM Studio. Cases = utterance + intent assertion that normalizes equivalent patch shapes, so we test intent not surface syntax.

- `evals/promptfooconfig.mjs` — baseline (21 cases × 2 providers)
- `evals/promptfooconfig.{retry,tempsweep,style}.mjs` — sweeps + style
- `node evals/summarize.mjs <json>...` — per-case × per-provider pass-rate table

Gotcha: LM Studio default 4K context chokes at concurrency>1. `lms load <model> --context-length 16384`.

### TDD workflow (every bug or feature — never skip)

1. **Add the failing case** to `promptfooconfig.mjs` or `style-cases.mjs`. Shape: `{name, utterance, check: {type, ...args}}`. If `check.type` doesn't exist, add a helper to `evals/lib/intent.mjs` returning `{pass, reason}` and dispatch in `evals/lib/asserter.mjs`.
2. **Run RED**: `pnpm exec promptfoo eval --config <cfg> --filter-pattern "<name>" --repeat 3 --no-cache`. Confirm 0/N pass *with the expected failure reason* (not a different bug).
3. **Implement the primitive**: prompt (`src/llm/lmstudio.ts` + `evals/lib/prompt.mjs`), schema (`src/config/{schema,tools}.ts`), renderer (`src/ui/`, `App.tsx`). Mirror eval-lib edits to stay in sync.
4. **Run GREEN** with same filter. If <100%, `jq -r '.results.results[] | select(.success == false) | {output: .response.output, reason: .gradingResult.reason}'` the result file to see actual model output. **Sharpen the validator message *before* adding prompt mass** — actionable error + retry beats prompt density.
5. **Run the full baseline** (`promptfooconfig.mjs`, no filter) to catch regressions. Must stay ≥ prior pass rate.
6. **Commit**. Every reported bug becomes a permanent regression test.

Every shipped bug in this repo's history ("titles red", "huge titles", "filter github") would have been caught by an eval case beforehand. The harness is the safety net — use it.

### Why `.mjs` not `.ts` in `evals/`

Promptfoo runs in plain Node, not Metro/Expo. `src/` uses RN imports and extension-less ESM paths the Node resolver can't follow without a bundler. We could add `tsx` or `--experimental-strip-types`, but the lib is ~400 lines of basic shapes (Expr keys, slot names) — string discipline + the eval suite itself catches drift. If the lib grows, generate `evals/lib/snapshot.mjs` from `src/config/*.ts` at build time and make src the single source of truth.

## Known trade-offs

- `slots.{key}: null` = **hide** (`{"lit":""}`). Single-slot reset = send the default Expr verbatim. Global reset wipes everything.
- `slots.visible` rejects null — it's a row predicate.
- `keepOnly:[...]` / `hide:[...]` cover every text slot including `header`. Split per-row vs app-level if surprising.
- Pure style commands must omit `slots`; validator catches `slots.X` + `style.X` co-occurrence and tells the model to drop slots.
