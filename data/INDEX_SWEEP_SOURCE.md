# Index Sweep

Anya **Index Sweep** builds exact-match search-engine operators:

```
"identifier" site:linkedin.com
```

## What works

Public, crawlable profile surfaces where contact text can be indexed — especially
**LinkedIn** when Contact Info is visible to logged-out users. **Instagram** often
appears via *unquoted* email search (Google entity association) even when exact
quotes return nothing. Also useful on GitHub, Xing, academic networks, and
similar open web properties.

Index Sweep generates both **exact** (`"email" site:…`) and **loose**
(`email site:…` / bare email) operators.

## What does not work

App-walled products (Snapchat, Hinge, Tinder, Bumble, most TikTok discovery).
Those require other Anya modules (Email Presence, platform-specific tools).


## Implementation notes

- No Google API key required — operators are returned as Google / Bing / DuckDuckGo links.
- Optional soft DuckDuckGo HTML probe for LinkedIn snippets (best-effort; often blocked).
- User-facing name is **Index Sweep** — never expose third-party tool branding.
