# Username accounts site list

`username-accounts.json` is a pinned snapshot of platform URL templates used for
username → public profile existence checks.

## Provenance

- Upstream project: [ismailtsdln/NebulaOSINT](https://github.com/ismailtsdln/NebulaOSINT)
- Upstream file: `data/sites.json`
- Upstream tree SHA (main): `e133a812957e8e0cf7e1b3073086e74caeb45010`
- Snapshot date: 2026-07-20

## Notes

- Anya does **not** run NebulaOSINT Python. Detection is reimplemented in
  `lib/username-accounts/` with concurrency limits, username sanitization, and
  Anya branding.
- Existence checks are heuristic (HTTP status). Soft-404 platforms may false
  positive or miss; treat hits as leads, not proof of identity.
- Upstream claimed MIT; no LICENSE file was present in the tree at snapshot time.
  Only the URL template list is vendored here.
