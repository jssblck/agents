# agents

Jess's agent skills, one directory per skill, in the
[Agent Skills](https://agentskills.io/specification) format.

Project skills live under `skills/`. Install into a project (writes
`.agents/skills/`, links `.claude/skills/`, records `skills-lock.json`):

```sh
npx skills add jssblck/agents -a claude-code -a codex -y
```

Machine skills live under `machine/`. Install them once per machine:

```sh
npx skills add jssblck/agents/machine -a claude-code -a codex -g -y
```
