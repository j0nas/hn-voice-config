# AGENTS

Voice-configurable HN reader PoC. Ships on-device with Gemma 4 E2B/E4B (~4–6 GB); dev'd against LM Studio.

## Core principle: LLM = inference engine, not mapper

Model composes from small orthogonal primitives. **Never** add prompt examples, switch branches, or tool variants for specific user phrases. If a phrase fails, fix the primitive — don't paper over with examples.

Mapper-drift to reject in PRs:
- Per-phrase prompt examples
- Tool-surface additions that duplicate existing primitives
- Phrase-recognizing switches in dispatch

## When the model fights you

Prompting can't beat strong model priors at E4B size. In this order:

1. **Clarify the primitive** in the prompt's concept section (one paragraph, not examples).
2. **Surface validator errors** back to the model so it self-corrects (one terse retry, no schema lectures — they make small-model output worse).
3. **Realign the API to the model's intuition.** Two flavors we've used:
   - *Rebind a sentinel* if the model overwhelmingly uses it for one meaning. (`null` → hide, not reset.)
   - *Add a primitive that takes the model's natural output shape.* When the model is weak at compositional output (e.g., set-complement reasoning for "show only X and Y"), expose a tool field that takes the *list of names* and let the dispatcher do the arithmetic. (`keepOnly:[...]` and `hide:[...]` instead of forcing `slots:{a:null,b:null,…}`.)

## Gemma 4 E2B/E4B constraints

- 128K context — token budget is never the bottleneck; primitive clarity is.
- Native `system` role + tool calling — use them.
- Native JSON output is reliable without grammar-constrained generation.
- E2B ships ~4 GB on-device; prompt tokens still cost inference latency.
- Subtle prompt distinctions ("hide" vs "reset" both → null) are unreliable to talk the model out of — realign instead.

## Known trade-offs

- `slots.{key}: null` = **hide** (stored as `{"lit":""}`). Single-slot reset = send the default Expr verbatim (defaults are exposed in the prompt). Global reset wipes everything.
- `slots.visible` rejects null at validation — it's a row predicate, not a hideable text slot.
- `keepOnly:[...]` / `hide:[...]` operate on every text slot including `header`. Split into per-row vs app-level if that surprises.

## Eval harness (`evals/`)

Promptfoo against LM Studio. Each case = one user utterance + an intent assertion (`hidesExactly`, `keepsOnly`, `filter`, `customizes`, `style`, …) implemented in `evals/lib/intent.mjs`. Assertions normalize equivalent patch shapes (e.g. `{slots:{X:null}}` ≡ `{hide:[X]}`) so we measure intent, not surface syntax.

Run patterns:
- Baseline: `promptfoo eval --config evals/promptfooconfig.mjs --repeat 3 --max-concurrency 4` → `evals/baselines/baseline-temp02-noretry.json`.
- Multi-provider sweeps (temp, retry budget): `evals/promptfooconfig.{tempsweep,retry}.mjs`.
- `node evals/summarize.mjs <result.json> [...]` → per-case pass-rate table grouped by provider label.

Key gotcha: LM Studio's loaded context window must be ≥16K (default 4K chokes at concurrency>1 because our system prompt + tool def is ~2K and concurrent requests share the KV cache). `lms load <model> --context-length 16384` fixes it.

Lib files in `evals/lib/` mirror `src/config/{schema,expr,tools}.ts` — Promptfoo runs in plain Node and can't import the TS+RN source directly. Drift between lib snapshot and `src/` is caught by failing eval cases (the assertion still uses the lib copy, but the rendered behavior diverges).
