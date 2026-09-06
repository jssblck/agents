# agents

Jess's agent skills, one directory per skill, in the
[Agent Skills](https://agentskills.io/specification) format.

Project skills live under `skills/`. Machine skills live under `machine/`.

Use [project-bootstrap](skills/project-bootstrap/SKILL.md) when requesting
repository setup or the full project template. Ordinary coding uses the existing
toolchain and does not add review gates or release infrastructure.

```sh
./install -g   # replace ~/.agents/skills and ~/.claude/skills with this repo
./install      # sync project skills into the current repo; keep the project's own
```

`-g` deletes the user-level skill directories, then installs both packs globally.

Without `-g`, installs the project pack into the current directory (`.agents/skills/`, linked from `.claude/skills/`, recorded in `skills-lock.json`). Copies of skills this repo has deleted are removed when git does not track them. Project-owned skills and installs from other sources stay.

Use Codex's built-in computer use and browser tools for browser and desktop tasks.
