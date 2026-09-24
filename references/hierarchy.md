# headline first, detail behind a fold

a reader opens a screen to get an answer. give the answer first. put the
explanation one click away. this file sets the order of a section and the
words in it. markup for every class: [components.md § disclosure](components.md#disclosure).

## lead with the answer

each section opens with its headline: the number, the ranked list, or the
verdict. one short line of context at most. the reader gets the answer
without reading a paragraph.

| first | after it, or behind a fold |
|---|---|
| the number | how it is calculated |
| the ranked list | how it is ranked |
| the verdict | the evidence |

## detail behind a fold

| content | use |
|---|---|
| an explanation longer than two lines | `.wonk-fold`, summary "How this works" or "How to read this" |
| a record: a deal, an account, a job | `.wonk-card--fold`, headline and key facts in the summary |
| a table row with more detail | `.wonk-row-toggle` and `.wonk-row-detail` |
| a long list | the first rows, then `.wonk-more`: "Showing 20 of 143" |
| a section with 3 or more folds | a `.wonk-fold-all` group in the section header |

a folded record keeps its headline and key facts in the summary. the reader
scans the folded list and opens only the record they need.

a list that re-renders gives each record a `data-fold-key`. wonk.js then
keeps each record open or closed across renders.

## numbers lead to records

every number that counts records is clickable. it opens the records behind
it: a total of 12 deals opens those 12 deals. see
[data-tools.md § drill-down](data-tools.md#drill-down).

## copy

- plain, concise, imperative. write "Remove a filter", not "You might want
  to try removing a filter".
- no editorializing. say what the data shows. do not call it great or
  worrying.
- no jokes in the visible UI copy of work tools. hidden eggs stay:
  [easter-eggs.md](easter-eggs.md).
- sentence case for headings, buttons, and summaries.
- define every term a new reader might not know with `.wonk-term`:
  [components.md § hints and terms](components.md#hints-and-terms).
- empty, stale, partial, and error states name the cause:
  [data-tools.md § state copy](data-tools.md#state-copy-must-identify-the-cause).

## before and after

| before | after |
|---|---|
| a four-sentence intro paragraph above the chart | one line, "Win rate by segment, last 90 days", and a `.wonk-fold` "How this works" |
| a static total: "12 deals" | a clickable total that opens the 12 deals |
| "Nothing here yet. That's ok with me." | "No deals match these filters." |
| "Here's a quick look at how things are trending!" | "Pipeline is down 8% from last week." |
