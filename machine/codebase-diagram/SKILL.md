---
name: codebase-diagram
description: >
  Build an interactive isometric diagram of a codebase: drill-down blocks,
  inspectable data-flow dots, Catppuccin mocha/latte themes. Use when asked
  to map, visualize, or explain a codebase, generate an architecture diagram,
  or make a fleetingbits-style visual. Publishes to here.now or writes a
  self-contained HTML file.
user-invocable: true
argument-hint: "[here.now | html | both]"
---

# Codebase diagram

Turn a repository into an interactive isometric map. The reader can pan, zoom,
select a block, go inside it, and click the moving dots to inspect the data
that flows between parts. The visual language matches the fleetingbits
"codebase as a city" style: letter-coded cuboids on a dotted grid, a grouped
index, a prose panel, and a live flow.

The renderer is the bundled template. Do not invent a new page. Fill the
model, inject it, scan it, then deliver it. `template/index.html` already
contains `examples/sample.json` (a fictional workshop) so you can open the
template to check the renderer before you replace the model.

## 1. Ask how to deliver it

If the user has not said where the diagram should go, ask before writing
output:

- a here.now page
- a self-contained HTML file
- both

Do not assume. If they already said one of those, skip the question.

## 2. Privacy (non-negotiable)

here.now is public-by-URL (privacy through obscurity). A plain HTML file may
travel through email, chat, or another untrusted channel. Treat every
generated artifact as public.

Never put any of these in the model, the HTML, the chat reply, or the publish
command line:

- secret values: API keys, tokens, passwords, cookies, session ids, private
  keys, connection strings, JWTs, age keys, OTP codes
- live credentials from `$HERENOW_API_KEY`, `~/.herenow/credentials`,
  `.herenow/state.json`, `.env`, sops-decrypted files, CI secrets
- real user data, PII, customer records, message bodies, production payloads

Allowed: module names, type names, field names, sanitized example shapes,
file paths that are already in the repo, the fact that a secret *exists*
("reads `HERENOW_API_KEY` from the credentials file").

Packets are structural examples (`{ slug, title }`), never captured values.

Before every deliverable, run `scripts/scan.py` on the generated HTML. If it
fails, redact and scan again. Do not publish or hand over a failing file.
Read `references/privacy.md` when a finding is ambiguous.

Do not print here.now API keys, claim tokens, or credential file contents
when publishing. Share only the public site URL.

## 3. Survey the repo

Read the map first, then the code that the map points at:

1. `README`, `ARCHITECTURE.md` / `ARCHITECTURE`, `AGENTS.md`, `CLAUDE.md`
2. Top-level directories and the real entrypoints (skip generated output,
   vendor, lockfiles, and secret files)
3. The handful of modules that own a boundary: input, core, storage, jobs,
   output

You are writing a city plan, not a file tree. Six to fourteen blocks on the
root view. Two to six drill-down views for the parts a new reader would
actually open. Do not make a block per file.

Height is meaning. Tall blocks are the measuring, evaluating, or
gatekeeping parts. Short blocks are stores, shims, or thin adapters.

## 4. Build the model

Read `references/model.md` and produce one JSON object that matches it.

Rules of thumb:

- One short code letter (or two) per block, unique inside a view
- Group related blocks; draw the group as a dashed yard
- Every important edge carries one to three packets with a label and a
  sanitized shape
- Prose goes in `summary` (what it does) and `howBuilt` (how it is built).
  Mark block names as `[[nodeId]]` so the panel can highlight them
- `inside` on a node points at another view id. Only add it when that
  view is worth opening
- Stats on the top bar are real counts you can defend (module count, jobs,
  public commands), not decoration

Write the JSON to a working file such as `/tmp/codebase-diagram-model.json`.
That file is an input to the injector, not a deliverable.

## 5. Inject, scan, deliver

```sh
python3 <skill>/scripts/inject.py \
  <skill>/template/index.html \
  /tmp/codebase-diagram-model.json \
  -o /tmp/codebase-diagram/index.html

python3 <skill>/scripts/scan.py /tmp/codebase-diagram/index.html
```

`<skill>` is this skill's directory (`machine/codebase-diagram` in this
repo, or the installed global copy).

Open the HTML locally and click through: click a block that has rooms,
use Back to return, click a moving dot, flip the theme. Fix the model if
a view is empty, a link is dead, or a packet looks like a real secret.

### here.now

If the here.now skill is installed, follow it. Use the user's credentials
when they exist (`$HERENOW_API_KEY` or `~/.herenow/credentials`). Do not
ask for an email and do not start a sign-in flow. Anonymous 24h publish is
fine when no key is present.

Publish the directory that contains `index.html` (not a parent folder):

```sh
<path-to-here-now>/scripts/publish.sh /tmp/codebase-diagram --client cursor
```

Tell the user the public `siteUrl` and whether the site is permanent
(authenticated) or 24h (anonymous). Then stop, unless they asked for
something else (a custom slug, a workspace, a rewrite).

Never print the API key, a claim token, or `.herenow/state.json`.

### HTML file

Write one self-contained file to the path they named. If they did not name
a path, use `codebase-diagram.html` in the project root and say so.

Do not commit the file unless they asked to keep it in the repo.

### Both

Do both of the above. Lead the reply with the here.now URL, then the local
path.

## Visual language (do not drop)

The template already implements this. Your job is to give it enough model
to look like a place, not a graph library demo.

- Isometric cuboids on a dotted grid, letter on the roof
- Dashed yards around groups
- Moving dots on the edges; a click opens the snippet
- Left index grouped the same way as the yards
- Right panel: What it does / How it's built
- Click a block (or its index row) that has more rooms to go inside.
  A Back control returns to the parent. Do not rely on the keyboard
- Top stats, flow controls (resume, trace one step, reset)
- A help control for pan, zoom, and inspect. Do not put a
  how-to-use-the-page section in the diagram prose
- Catppuccin Mocha when the browser prefers dark, Latte when it prefers
  light. The page follows `prefers-color-scheme` and also has a toggle

## When not to use this

- The user wants a Mermaid snippet, a PNG, or an architecture doc in
  Markdown: do that instead
- The user wants a live debugger attached to a running process: this map
  is a static explanation with staged example flow, not telemetry
