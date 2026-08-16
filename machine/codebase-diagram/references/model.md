# Diagram model

The injector replaces the `<script type="application/json" id="diagram-model">`
block in `template/index.html` with this object. JSON only: no comments, no
trailing commas, no `undefined`.

A complete fictional model lives in `examples/sample.json`. Copy its shape,
not its story.

## Root object

| Field | Type | Required | Meaning |
|---|---|---|---|
| `title` | string | yes | Page title and masthead, e.g. `The Evolution Harness` |
| `repo` | string | no | Repository or system name shown next to the title |
| `subtitle` | string | no | Short qualifier (`rust-rewrite`, `v2`) |
| `stats` | array of `{label, value}` | yes | Top-bar facts. 3 to 6 items. Values are short strings |
| `startView` | string | yes | Id of the first view |
| `views` | object | yes | Map of view id to view |

## View

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Must match the key in `views` |
| `title` | string | yes | Shown in the index header and the breadcrumb |
| `parent` | string | no | View id to return to. Required on every view except the start view |
| `summary` | string | yes | What this view does. Use `[[nodeId]]` to highlight a block |
| `howBuilt` | string | yes | How it is built: modules, types, invariants |
| `howToRead` | string | no | Optional view note. Shown only inside the help popover, never as page chrome |
| `groups` | array | yes | Dashed yards. May be empty on a tight close-up |
| `nodes` | array | yes | 3 to 14 blocks. Never zero |
| `edges` | array | yes | Flows between nodes in this view |

## Group

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Stable id |
| `label` | string | yes | Index section title, uppercase in the UI |
| `x`, `y` | number | yes | Grid origin of the yard (integers) |
| `w`, `d` | number | yes | Width and depth in grid cells |

## Node

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Stable id, used by edges and `[[nodeId]]` |
| `code` | string | yes | One or two characters on the roof |
| `label` | string | yes | Index and tooltip name |
| `group` | string | no | Group id |
| `x`, `y` | number | yes | Grid origin |
| `w`, `d` | number | no | Footprint in cells. Default `1` |
| `height` | number | yes | Visual storeys, `1` to `5`. Measuring and gating parts are tall |
| `kind` | string | no | `process`, `store`, `boundary`, `output`, `engine`, `measure`. Colors the faces |
| `count` | number or string | no | Small figure in the index (instances, commands, files) |
| `summary` | string | yes | Selected-block "what it does" |
| `howBuilt` | string | yes | Selected-block "how it's built" |
| `inside` | string | no | View id to open with `+` / double-click |

Place blocks so they do not overlap. Leave a cell of air between neighbors.
Keep the whole view inside a roughly 16 by 12 cell island so the camera can
frame it.

## Edge

| Field | Type | Required | Meaning |
|---|---|---|---|
| `from`, `to` | string | yes | Node ids in this view |
| `via` | array of `{x, y}` | no | Extra grid waypoints for the ground path |
| `label` | string | no | Flow name, shown when a packet is inspected |
| `packets` | array | yes | 1 to 3 snippets |

## Packet

| Field | Type | Required | Meaning |
|---|---|---|---|
| `label` | string | yes | Short name on the inspect card |
| `detail` | string | yes | The snippet. A type shape, a field list, or a one-line example. Never a live secret |
| `accent` | string | no | Catppuccin name: `blue`, `mauve`, `peach`, `green`, `teal`, `yellow`, `pink`, `red` |

## Prose marks

`[[nodeId]]` in `summary` or `howBuilt` becomes a highlight chip. Clicking
it selects that block. The id must exist in the same view. `howToRead` is
plain text inside the help popover only.

Use blank lines to split paragraphs. The renderer does not run Markdown.

## Layout recipe

1. Name 3 to 5 groups on the root view
2. Drop 6 to 14 blocks into those yards
3. Draw the real runtime arrows, not "uses" lines between every pair
4. Put example packets on each arrow
5. Pick the 2 to 6 blocks a reader would open and give each an `inside` view
6. On an inside view, `parent` points back, and the blocks are the next
   level of modules (still not a file dump)

## Checklist before inject

- `startView` exists
- every `parent` and `inside` exists
- every `from` / `to` / `group` / `[[nodeId]]` resolves in that view
- codes are unique per view
- no packet `detail` contains a value that could be a credential
- stats are true
