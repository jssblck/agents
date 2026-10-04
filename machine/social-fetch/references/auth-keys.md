# Credentials for paid providers

Use paid providers only when the user has authorized that service for the
current task. An existing key is not authorization to spend quota. Preserve
approval across clarifications; do not ask again solely because a session
changed. Stay on free strategies if access or authorization is unavailable.

ScrapeCreators supports platform-specific fetches. Apify offers Actors for
social scraping. Check the provider's current route, Actor, and pricing when
a paid call is needed; do not set up accounts or keys preemptively.

## Storage and requests

Keep credentials in the tool's credential store or 1Password. The recipes use
protected curl config files under `~/.config/social-fetch/` as one local option.
Keep the directory mode 700 and files mode 600, outside Git. Populate them
through a secure local editor or credential-store interface; never request
a plaintext key in chat or print the file.

The config contains the authentication header. For ScrapeCreators,
`scrapecreators.curl` has this format:

```text
header = "x-api-key: <key>"
```

For Apify, `apify.curl` has this format:

```text
header = "Authorization: Bearer <token>"
```

Apify supports [Bearer header authentication](https://docs.apify.com/api/v2/getting-started#authentication).
Use `curl --config <protected-file>`, so command arguments contain only the
path. A credential store can instead supply curl configuration over stdin
with `curl --config -`. Never expand a key into `-H`, put it in a URL, or
store it in a shell startup file. Avoid verbose traces that reveal headers.
Credentials remain machine-local.

Check whether the configured file is readable without displaying its contents.
If there is no configured credential source, report the available free or
partial result and the missing provider access.

## Cost discipline

Fetch the requested scope. Replies and threads can increase quota.
Use a valid existing cache where appropriate; skip it when freshness is requested.
Bulk requests may suit a batched Actor after the user authorizes that scope.
