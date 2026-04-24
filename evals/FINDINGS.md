# Eval-driven findings (autonomous session 2026-04-24)

This session set up Promptfoo against Gemma 4 E4B via LM Studio, established a baseline, ran experiments to tune temperature and retry budget, then implemented `patch.style` test-first.

## Results at a glance

| Run | Pass | Notes |
|---|---|---|
| Baseline initial (temp=0.2, no retry, parallel=4) | 60/63 = 95% | 3 hard failures; deterministic per case |
| Temperature sweep (0 / 0.2 / 0.5 / 0.7) | 60/60/56/56 of 63 | 0 and 0.2 tied; 0.5+ regress on composition |
| Retry budget (0 / 1 / 2) | 60/63/63 of 63 | retry=1 jumps to 100%; retry=2 adds nothing |
| Style RED (pre-impl) | 0/24 | confirmed |
| Style GREEN v1 (no retry) | 14/24 = 58% | model nests style under slots |
| Style GREEN v2 (sharpened prompt) | 20/24 = 83% | clarified style is top-level field |
| Style GREEN v3 (with retry=1) | 21/24 = 88% | retry recovers some structural errors |
| **FINAL baseline (temp=0, both first-shot and retry=1)** | **63/63 = 100% (both!)** | after validator hint for fn:"lit"/fn:"var" |
| **FINAL style (retry=1)** | **24/24 = 100%** | "huge titles" now recovers via retry |

## Decisions applied

- **Production temperature: 0.2 → 0.** Same pass rate at lower temp, more deterministic UX (a phrase that fails fails consistently, easier for users to adapt).
- **Production retry budget: kept at 1.** retry=1 wins big over retry=0 (95% → 100% on baseline). retry=2 is wasted cost.
- **`patch.style` shipped.** Top-level field, sibling to `slots`. Targets are text slots + `row`. Static styling (no Expr eval per item).
- **New validator hint:** `{fn:"lit"}` and `{fn:"var"}` now produce a specific actionable error explaining they're property markers, not function names. The model has been making this confusion repeatedly.

## Recovered via validator feedback (key lesson)

- **`only show stories from github`** — without retry, model edits `slots.domain` instead of `slots.visible`. Retry recovers because the malformed Expr triggers feedback and the model picks a different slot.
- **`make titles huge`** — model emits placeholder content (`slots.title = {fn:"lit", args:[…]}`) alongside the correct `style.title.fontSize`. The `fn:"lit"` is the confusion between the `lit` property marker and a function name. Added a specific validator hint: `fn = "lit" is not a function — use {"lit": <value>} instead`. With that, retry recovers reliably.

The bigger pattern: **every remaining small-model brittleness was a structural error the validator caught** — not a semantic mis-interpretation we'd need prompting to fix. Once the validator messages are actionable ("fn:'lit' isn't a function, use the literal form"), the retry loop absorbs it.

## Eval harness setup notes

- Promptfoo via `pnpm exec promptfoo eval --config evals/promptfooconfig.{,retry,tempsweep,style}.mjs`.
- LM Studio default context window (4096 tokens) is too small for our prompt + tool def + parallel=4. **Fixed with `lms load <model> --context-length 16384`**, allows full parallelism.
- Cases live in `evals/promptfooconfig.mjs` (baseline) and `evals/style-cases.mjs` (style suite). Multi-provider configs (`tempsweep`, `retry`) re-import the same case list.
- Eval lib in `evals/lib/` mirrors the production source (`src/config/{schema,expr,tools}.ts` and `src/llm/lmstudio.ts`) because Promptfoo runs in plain Node and can't import the TS+RN source. Drift between lib and source surfaces as failing eval cases.
- `node evals/summarize.mjs <result.json> [<other.json>...]` produces a per-case pass-rate table grouped by provider label. Useful for diffing across runs/configs.

## Token cost per run

- Baseline (63 cases): ~133K tokens (~$0.05 if it were OpenAI-priced; free locally)
- Temp sweep (252 cases): ~530K tokens, 11 min
- Retry sweep (189 cases): ~500K tokens (estimated), 3 min — fast because retries only fire on failures
- Style RED (24 cases): ~50K tokens, 52s

The eval suite is cheap enough to run on every prompt or schema change. Suggested CI use: run baseline + style on push; sweeps weekly.
