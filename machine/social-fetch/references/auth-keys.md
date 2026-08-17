# Auth keys

Free strategies cover Bluesky, Mastodon, HN, Reddit, and a partial X
preview. X threads, LinkedIn posts, Instagram, TikTok, and Threads
need a paid key for complete data.

## Which key unlocks what

| Key | Unlocks | Cost (approx, 2026) |
|---|---|---|
| `$SCRAPECREATORS_API_KEY` | X tweets/threads/replies, LinkedIn posts, Instagram, TikTok, sometimes Threads | Pay-as-you-go, about $0.005 to $0.02 per post |
| `$APIFY_API_TOKEN` | Most platforms via Actors | Per-actor, often $1 to $5 / 1K results |

Do not put keys in chat, in the skill files, or in git. Read them from
the environment. On a Cloud Agent host, that means an environment
secret. On a laptop, a shell profile is enough.

## ScrapeCreators

1. Sign up at https://scrapecreators.com
2. Copy the API key from the dashboard
3. Export it in the environment the agent actually sees:

```bash
export SCRAPECREATORS_API_KEY="<key>"
```

4. Confirm it is present without printing the secret:
   `test -n "$SCRAPECREATORS_API_KEY" && echo set`

## Apify

1. Sign up at https://apify.com
2. Copy the token from Settings → Integrations → API
3. Export `$APIFY_API_TOKEN` the same way
4. Confirm with `test -n "$APIFY_API_TOKEN" && echo set`

## Free-only mode

If neither key is set:

- Bluesky / Mastodon / HN / Reddit: full fetch
- X: preview (text, author, basic engagement). No reliable thread or
  reply tree.
- LinkedIn profiles: recent activity may be visible. Specific posts
  usually are not.
- Instagram / TikTok / Threads: Open Graph title/description/image at
  best

That is enough for one-off reads. Set a key when a real workflow is
blocked, not preemptively.

## Cost discipline

- Check `~/Documents/social-fetches/_cache/` first when it exists
- 24h TTL on successful fetches
- Do not add `--with-replies` or `--thread` unless asked. Those
  multiply quota.
- For bulk work (dozens of posts from one account), prefer a batched
  Apify actor over per-URL ScrapeCreators calls

Prompt before the first paid call in a session. If the user declines,
stay on free strategies and return partial data.
