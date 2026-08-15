# agents

Jess's agent skills, one directory per skill under `skills/`, in the
[Agent Skills](https://agentskills.io/specification) format.

Install into a project (writes `.agents/skills/`, links `.claude/skills/`, records
`skills-lock.json`):

```sh
npx skills add jssblck/agents -a claude-code -a codex -y
```

Machine-level skills live on the `global` branch, an independent trunk that
never merges into `main`. Install them once per machine:

```sh
npx skills add https://github.com/jssblck/agents/tree/global -a claude-code -a codex -g -y
```
