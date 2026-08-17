# Normalized output schema

Same shape on every platform. Fields with no equivalent are `null`,
not `0` or `""`. Missing is not zero.

## Schema

```typescript
{
  "platform": "x" | "linkedin" | "linkedin-profile" | "instagram" | "tiktok"
    | "bluesky" | "reddit" | "mastodon" | "threads" | "hn",
  "url": string,
  "fetched_at": ISO8601,
  "raw_source":
    "direct-api" | "fxtwitter" | "agent-browser" | "open-graph" | "nitter"
    | "wayback" | "scrapecreators" | "apify" | "webfetch",

  "author": {
    "handle": string | null,
    "name": string | null,
    "verified": boolean | null,
    "follower_count": number | null,
    "profile_url": string | null,
    "avatar_url": string | null
  },

  "posted_at": ISO8601 | null,
  "edited_at": ISO8601 | null,

  "text": string,
  "html": string | null,
  "language": string | null,

  "media": Array<{
    "type": "image" | "video" | "gif" | "audio",
    "url": string,
    "alt": string | null,
    "width": number | null,
    "height": number | null,
    "duration_seconds": number | null
  }>,

  "engagement": {
    "likes": number | null,
    "reposts": number | null,
    "replies": number | null,
    "bookmarks": number | null,
    "views": number | null,
    "quotes": number | null
  },

  "links": Array<{
    "url": string,
    "expanded_url": string,
    "title": string | null
  }>,

  "mentions": string[],
  "hashtags": string[],

  "is_reply": boolean,
  "reply_to": {
    "url": string,
    "author_handle": string
  } | null,

  "is_thread": boolean,
  "thread": Array<{
    "url": string,
    "text": string,
    "posted_at": ISO8601
  }>,

  "replies": Array<{
    "url": string,
    "author": { "handle": string, "name": string },
    "text": string,
    "posted_at": ISO8601,
    "engagement": { "likes": number, "replies": number }
  }>,

  "raw": object | null
}
```

Reddit `likes` is upvotes. Mastodon `reposts` is reblogs. HN `likes`
is score.

## Coverage on a successful free fetch

| Field | bluesky | mastodon | hn | reddit | x (free) | linkedin (free) |
|---|---|---|---|---|---|---|
| author.handle | yes | yes | yes | yes | yes | yes |
| posted_at | yes | yes | yes | yes | often | sometimes |
| text | yes | yes | yes | yes | often | sometimes |
| media | yes | yes | no | yes | sometimes | no |
| engagement.likes | yes | yes | yes | yes | sometimes | no |
| replies | yes | yes | yes | yes | no | no |
| thread | yes | yes | n/a | n/a | no | no |

Paid X / LinkedIn / IG / TikTok / Threads fills the gaps in the
upstream matrix: verified, followers, views, media, replies.

`is_thread: true` with `thread: []` means the preview saw a thread
and could not fetch the other posts.

## Return to the user

1. One line: `<platform> · <handle> · <posted_at> · "<short text>"`
2. `--save` path when that flag is set
   (`~/Documents/social-fetches/<platform>-<id>.json`)
3. The JSON itself

If the fetch is partial, say so in the one-liner. Name the key that
would complete it.
