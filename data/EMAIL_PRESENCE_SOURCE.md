# Email Presence

Anya **Email Presence** checks whether an email appears registered on selected
platforms via public signup / account-status endpoints.

## Provenance

Inspired by the OSINT technique popularized by tools such as Holehe
(email → registered accounts). Anya does **not** install or run Holehe, and
does **not** copy GPL-licensed source. Probes in `lib/email-presence/` are
original TypeScript implementations against public HTTP APIs.

## Notes

- User-facing name is **Email Presence** — never expose upstream tool names.
- Some platforms rate-limit aggressively; treat misses as inconclusive.
- Do not add account-creation probes that submit full registrations.
