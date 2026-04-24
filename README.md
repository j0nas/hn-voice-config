# hn-voice-config

A Hacker News reader you reconfigure by **talking to it**.

Speak a command ("sort by new", "make the titles bigger", "hide the points") → a local Gemma model (via LM Studio) emits a tool call → the app mutates its config and re-renders. Layout, palette, feed, per-slot expressions — all voice-driven.

The HN client is a testbed. The real experiment is configuration-via-voice as an interface.

## Run it

1. LM Studio → load `google/gemma-4-e4b`, enable CORS, serve on `http://127.0.0.1:1234`.
2. `pnpm install && pnpm web`.

## How it works

Voice → Gemma → `updateConfig({patch})` → app re-renders. The whole config surface is small enough that a 6 GB model can drive it from primitives.

**Slots** are everything the renderer reads. Per-row: `rank`, `title`, `domain`, `score`, `author`, `age`, `comments`, `visible`. App shell: `header`. Each slot is an `Expr` evaluated on every render.

**Expr** is a three-shape tree:

- `{"lit": <string|number|boolean>}` — a literal
- `{"var": "<name>"}` — a variable
- `{"fn": "<name>", "args": [<Expr>, …]}` — a function call

Functions are a closed set (`concat`, `upper`, `slice`, `if`, `gt`, `ago`, `host`, …; full list in `src/config/expr.ts`). Variables: `feed`, `storyLimit`, `now` (always); `index`, `rank`, `total`, `item.{title,score,by,time,url,descendants,id}` (per-row only).

The default `slots.rank` Expr is `{"fn":"concat","args":[{"var":"rank"},{"lit":"."}]}`, which renders "1.", "2.", "3."… Substitute `letter` for `concat`+`var:rank` and you get "A.", "B.", "C."; substitute `roman` and you get "I.", "II."… The model composes by editing the tree.

**Patches** carry `feed?`, `storyLimit?`, `palette?`, `slots?`, `style?`, plus shorthand `hide:[…]` and `keepOnly:[…]` so the model can express subtractive views by naming slots instead of writing `slots:{a:null,b:null,…}`. `slots.X: null` hides X (stored as `{"lit":""}` and rendered as empty / cell-collapsed). `slots.visible` is a row predicate — null is rejected.

**Style** is a separate top-level field for visual properties: `style.{target}.{prop}` where target is any text slot or `row` (the row container) and prop is any RN style attribute (`fontSize`, `color`, `fontWeight`, `backgroundColor`, `borderRadius`, `padding`, …). Unlike slots, style is static — set once per command, not Expr-evaluated. "Make titles bigger" → `{"style":{"title":{"fontSize":24}}}`.

A few real exchanges to make it concrete:

```
"hide indexes"
→ {"slots":{"rank":null}}

"uppercase titles when score is over 200"
→ {"slots":{"title":{"fn":"if","args":[
     {"fn":"gt","args":[{"var":"item.score"},{"lit":200}]},
     {"fn":"upper","args":[{"var":"item.title"}]},
     {"var":"item.title"}
   ]}}}

"only show stories from github"
→ {"slots":{"visible":{"fn":"contains","args":[
     {"fn":"host","args":[{"var":"item.url"}]},
     {"lit":"github.com"}
   ]}}}

"show titles and scores only"
→ {"keepOnly":["title","score"]}

"switch to the new feed"
→ {"feed":"new"}

"make titles bigger and bold"
→ {"style":{"title":{"fontSize":20,"fontWeight":"bold"}}}

"round the corners of each row"
→ {"style":{"row":{"borderRadius":8}}}
```

Slot defaults live in `src/config/schema.ts` and are injected verbatim into the system prompt so the model can copy-modify them. A 1-retry validator-feedback loop surfaces actionable shape errors (e.g. `slots.title.fn = "X" is not a known function`) back to the model so it can self-correct.

See `AGENTS.md` for the design principles (LLM = inference engine, not phrase-mapper).
