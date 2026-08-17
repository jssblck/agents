# Per-platform strategies

Try 2 to 5 strategies in order. Free first. Paid only if the env key is
set, and only after you have told the user it will spend quota.

---

## bluesky

Reliability: high. Public API, free.

URL: `https://bsky.app/profile/<handle>/post/<rkey>`

```bash
DID=$(curl -sS "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=<handle>" | jq -r .did)
URI="at://${DID}/app.bsky.feed.post/<rkey>"
curl -sS "https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${URI}"
```

Returns the post, parent, and first-level replies. Good for
`--with-replies`.

---

## mastodon

Reliability: high. Public API, free, no auth.

URL: `https://<instance>/@<user>/<status-id>`

```bash
curl -sS -H "Accept: application/json" "https://<instance>/api/v1/statuses/<status-id>"
curl -sS -H "Accept: application/json" "https://<instance>/api/v1/statuses/<status-id>/context"
```

Web URL `https://hachyderm.io/@user/123456` maps to
`https://hachyderm.io/api/v1/statuses/123456`.

---

## hn

Reliability: high. Free Algolia API.

URL: `https://news.ycombinator.com/item?id=<id>`

```bash
curl -sS "https://hn.algolia.com/api/v1/items/<id>"
```

Returns the item plus a nested comment tree. Flatten or cap depth when
`--with-replies` is off.

---

## reddit

Reliability: medium. The `.json` suffix is free and rate-limited
(~60 req/min per IP).

URL: `https://www.reddit.com/r/<sub>/comments/<id>/...`

```bash
curl -sS -A "Mozilla/5.0 social-fetch/0.1" "<url>.json"
```

Returns `[post, comments_tree]`. Reddit blocks the default curl
User-Agent.

If that 429s or the post is gone:

```bash
curl -sS "https://archive.org/wayback/available?url=<encoded-url>" | jq -r '.archived_snapshots.closest.url'
```

Then fetch that snapshot URL.

---

## x (twitter)

Reliability: low without paid keys. X blocks most scrapers.

URL: `https://x.com/<user>/status/<id>` or `https://twitter.com/<user>/status/<id>`

### 1. FxTwitter syndication (free)

```bash
curl -sS "https://api.fxtwitter.com/<user>/status/<id>"
```

Returns JSON with `tweet.text`, `tweet.author`, engagement counts, and
media when the mirror has the post. Prefer this over a headed browser.
If it 403s or times out, continue.

### 2. Rendered preview (limited)

Open the permalink. In Cursor, `WebFetch` first; if that is a login
wall, a computer-use / browser subagent. On Claude Code,
`agent-browser open` plus a snapshot.

Expect body text and a handle. Engagement, replies, and the rest of a
thread are often missing. Dismiss a "Sign up to see" modal if one is
in the way, then snapshot again.

### 3. Nitter (unreliable)

Instances die often. Try only if FxTwitter failed:

```bash
for inst in nitter.net nitter.privacydev.net nitter.poast.org; do
  code=$(curl -sS -o /tmp/nitter-body -w "%{http_code}" "https://${inst}/<user>/status/<id>")
  if [ "$code" = "200" ]; then cat /tmp/nitter-body; break; fi
done
```

### 4. Wayback Machine

```bash
curl -sS "https://archive.org/wayback/available?url=https://twitter.com/<user>/status/<id>" | jq -r '.archived_snapshots.closest.url'
```

Older tweets are cached more often than recent ones.

### 5. ScrapeCreators (paid)

Requires `$SCRAPECREATORS_API_KEY`. Skip if unset.

```bash
curl -sS "https://api.scrapecreators.com/v1/twitter/tweet?url=<encoded-url>" \
  -H "x-api-key: $SCRAPECREATORS_API_KEY"
```

Confirm the path in ScrapeCreators docs on first use.

### 6. Apify (paid)

Requires `$APIFY_API_TOKEN`. Use `apify/twitter-scraper` or a current
equivalent.

```bash
curl -sS -X POST "https://api.apify.com/v2/acts/<actor-id>/run-sync-get-dataset-items?token=$APIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tweetUrls": ["<url>"], "maxItems": 1}'
```

---

## linkedin

Reliability: medium.

### 1. Browser + dismiss modal

Open the URL. Dismiss the signup modal if it is the first interactive
control, wait, then read the page.

Works more often for `linkedin.com/in/<handle>` recent activity than
for `linkedin.com/posts/...`. Specific post URLs usually need login.

### 2. ScrapeCreators (paid)

```bash
curl -sS "https://api.scrapecreators.com/v1/linkedin/post?url=<encoded-url>" \
  -H "x-api-key: $SCRAPECREATORS_API_KEY"
```

### 3. Apify (paid)

`apify/linkedin-profile-scraper` or `apify/linkedin-post-scraper`.

---

## instagram

Reliability: low without paid keys.

### 1. Open Graph (limited)

```bash
curl -sS -A "Mozilla/5.0" "<url>" | grep -E 'og:(title|description|image)'
```

Metadata only. Often blocked.

### 2. ScrapeCreators (paid)

```bash
curl -sS "https://api.scrapecreators.com/v1/instagram/post?url=<encoded-url>" \
  -H "x-api-key: $SCRAPECREATORS_API_KEY"
```

### 3. Apify (paid)

`apify/instagram-scraper`.

---

## tiktok

Reliability: low without paid keys.

### 1. Open Graph (limited)

```bash
curl -sS -A "Mozilla/5.0" "<url>" | grep -E 'og:(title|description|video)'
```

### 2. ScrapeCreators (paid)

```bash
curl -sS "https://api.scrapecreators.com/v1/tiktok/video?url=<encoded-url>" \
  -H "x-api-key: $SCRAPECREATORS_API_KEY"
```

### 3. Apify (paid)

`apify/tiktok-scraper`.

---

## threads

Reliability: low without paid keys. Same anti-bot family as Instagram.

### 1. Open Graph (limited)

```bash
curl -sS -A "Mozilla/5.0" "<url>" | grep -E 'og:(title|description)'
```

### 2. ScrapeCreators (paid)

Only if their docs list a Threads route.

### 3. Apify (paid)

Search the Apify store for a current Threads actor.

---

## Chain summary

| Platform | Free | Paid fallback |
|---|---|---|
| bluesky | Direct API | none |
| mastodon | Direct API | none |
| hn | Algolia | none |
| reddit | `.json` then Wayback | none |
| x | FxTwitter → preview → Nitter → Wayback | ScrapeCreators → Apify |
| linkedin | Browser (modal dismiss) | ScrapeCreators → Apify |
| instagram | OG tags | ScrapeCreators → Apify |
| tiktok | OG tags | ScrapeCreators → Apify |
| threads | OG tags | ScrapeCreators → Apify |
