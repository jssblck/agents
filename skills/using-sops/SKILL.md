---
name: using-sops
description: "Use for secrets or key setup in a repo with .sops.yaml, encrypted environment files, or a pnpm secrets script."
---

# Using sops

Repositories that use this layout commit their secrets to git as sops-encrypted
dotenv files, one per deployment environment: `secrets/dev.env`, `secrets/prod.env`. The
files decrypt with age identities. There is no `.env`, no secrets service, and no session
to log in to. Every checkout, worktree, and cloud sandbox has the encrypted files at
clone; the only input anywhere is an age private key.

`pnpm secrets` (`tools/secrets.ts`) is the only interface. Do not call `sops` directly in a
repo that has the wrapper.

## Identities

| Identity   | Scope       | Where the private key lives                                       | Decrypts    |
| ---------- | ----------- | ---------------------------------------------------------------- | ----------- |
| `agent`    | user-wide   | `~/.config/sops/age/keys.txt` on every machine agents run on; `SOPS_AGE_KEY` in cloud sandboxes | `dev.env` |
| `personal` | user-wide   | the user's password manager                                      | files listing its public key |
| `prod`     | per project | that project's production platform and documented password-manager item | `prod.env` |

`.sops.yaml` lists recipients by public key. Encrypting needs no private key; decrypting
or editing needs one recipient's private key. `agent` and `personal` are local-development
keys shared by every project; `prod` is minted per project so one leaked deploy variable
exposes one project. These are conventions, not guaranteed recipients. Existing repos
may use only shared `dev` and `prod` keys. Read the repository's secrets guide and
`.sops.yaml` before choosing a key; the encrypted file's recipient metadata determines
which identities can decrypt it.

## Agent workflow

Dev secrets are yours to manage without asking:

```sh
pnpm secrets show dev                    # everything, decrypted
pnpm secrets get dev STRIPE_KEY
pnpm secrets set dev STRIPE_KEY sk_test_1
pnpm secrets unset dev STRIPE_KEY
pnpm secrets exec dev -- node apps/worker/src/main.ts
```

`exec` puts the decrypted values in the child's environment (over the shell's), removes
`SOPS_AGE_KEY*` from it, forwards signals, and exits with the child's status.

When an authorized task needs production secrets, perform elevation yourself. Do not
ask the user to run the command or reconfirm an already authorized task.

1. Check access with `pnpm secrets exec prod -- true`, which prints no secret values.
   An existing `.age/elevated` file alone does not prove that its key can decrypt prod.
2. If access fails, read the repo's secrets guide and recipient configuration. Use the
   documented account, vault, item, and field for a matching key. Do not assume a
   `Personal` vault, an `age-personal` recipient, or the CLI's default account.
3. Run the documented read yourself, piping the key directly into the wrapper:
   `op read 'op://VAULT/ITEM/FIELD' --account ACCOUNT | pnpm secrets elevate`.
   Replace the placeholders with the discovered identifiers; never print the key.
4. Confirm decryption with `pnpm secrets exec prod -- true`, then continue the task.

When the documented 1Password location is missing, use `op account list --format json`
and `op vault list --account ACCOUNT --format json` to identify the correct account and
vault. Search item metadata in that vault for the documented key name with
`op item list --account ACCOUNT --vault VAULT --format json`; inspect only matching
items. Pass `--account` on subsequent reads. `Private`, `Personal`, and `Shared` are
distinct names, not interchangeable aliases. If a key is found but cannot decrypt,
compare its public key with the file's recipients instead of repeatedly trying vault
names. Keep private keys out of tool output.

Ask the user only when progress requires their interaction, such as unlocking
1Password or granting unavailable access. State the actual blocker. Elevation is per
checkout and lasts until `.age/elevated` is deleted; do not copy it into another worktree.

When you add a variable, add it to the env schema and to every `secrets/<env>.env` you can
decrypt. If you cannot decrypt prod, say so in the PR: the typed env check fails the prod
boot until the value is set, which is the intended signal.

Never write an `AGE-SECRET-KEY-...` into a tracked file, a log, or a commit. Never put `personal` or `prod` in a cloud
environment.

## Human setup

For the one-time steps (generating keys, installing `sops` and `age`, wiring the `agent`
key into agent tools and cloud sandboxes, configuring the prod platform, and rotating
keys), read `references/setup.md`. When the user asks
to be reminded of the steps, walk them through that file in order.

For the sops and age behavior the design relies on (identity union, `updatekeys`,
`exec-env` limitations, dotenv quirks), read `references/sops-notes.md`.
