// Style-feature test cases. Imported into promptfooconfig once we want
// the red phase, and removed/integrated when green.

export const styleCases = [
  { name: 'titles bigger', utterance: 'make the titles bigger', check: { type: 'style', slot: 'title', prop: 'fontSize' } },
  { name: 'titles bold', utterance: 'make titles bold', check: { type: 'style', slot: 'title', prop: 'fontWeight' } },
  { name: 'italic author', utterance: 'italicize the author', check: { type: 'style', slot: 'author', prop: 'fontStyle' } },
  { name: 'scores red', utterance: 'make the scores red', check: { type: 'style', slot: 'score', prop: 'color' } },
  { name: 'header bg dark blue', utterance: 'make the header background dark blue', check: { type: 'style', slot: 'header', prop: 'backgroundColor' } },
  { name: 'rounded rows', utterance: 'round the corners of each row', check: { type: 'style', slot: 'row', prop: 'borderRadius' } },
  { name: 'more row padding', utterance: 'add more padding to rows', check: { type: 'styleOneOf', slot: 'row', props: ['padding', 'paddingVertical', 'paddingHorizontal'] } },
  { name: 'huge titles', utterance: 'make the titles huge', check: { type: 'style', slot: 'title', prop: 'fontSize' } },
];
