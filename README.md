# skills

Jess's agent skills, one directory per skill under `skills/`, in the
[Agent Skills](https://agentskills.io/specification) format.

Install into a project (writes `.agents/skills/`, links `.claude/skills/`, records
`skills-lock.json`):

```sh
npx skills add jssblck/skills -a claude-code -a codex -y
```

Restore from a committed lock: `npx skills experimental_install`. Update every
installed skill to this repo's `main`: `npx skills update -y`.
