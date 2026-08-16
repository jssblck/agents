# Privacy pass

Run `scripts/scan.py` on every generated HTML file. This note is the judgment
call when the scanner is unsure.

## Never ship

Values, not vocabulary:

- API keys, personal access tokens, refresh tokens, session cookies
- Passwords, OTP codes, magic-link secrets
- Private keys (`-----BEGIN`, `AGE-SECRET-KEY-`, age identities)
- Connection strings that embed a password or key
- JWTs (three base64 segments)
- here.now claim tokens, `HERENOW_API_KEY` contents, Drive tokens
- Decrypted sops contents, `.env` assignments, CI secret values
- Real emails of private people, phone numbers, customer payloads
- Production request or response bodies copied from logs

## Fine to ship

- The *name* of an env var or file: `HERENOW_API_KEY`, `secrets/prod.env`
- A type shape: `{ slug, title, expiresAt }`
- A fake example whose value is obviously staged: `slug: "bright-canvas"`
- Public repo paths, public URLs, license names
- Counts you computed from the tree

## Packet test

Read each packet as if it will be screenshotted on the public web.

- Replace: `apiKey: "hn_live_8f3a..."` 
- Keep: `apiKey: "<redacted>"` or omit the field and write
  `{ slug, title }`

If you saw a real value while surveying the repo, do not echo it into the
model "as an example." Invent a staged shape or drop the field.

## Publish command line

Do not pass `--api-key` in an interactive session. The here.now script reads
the credentials file or `$HERENOW_API_KEY` itself. Do not `echo` those
sources. Do not paste `claimToken` into chat.

After publish, report `siteUrl` (and `account_url` when the script prints
one). That is the whole reply for credentials.
