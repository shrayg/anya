# Anya cheating campaign funnels

These are standalone paid-social funnels. They do not send visitors to the Anya homepage and do not show the marketing navbar or the generic multi-module search.

The canonical production host already configured in the application is `https://anyaint.com`.

## What every funnel does

1. Opens with the exact emotional moment from the matching ad.
2. Asks seven short questions: trigger, frequency, duration, current feeling, reason for checking, preferred next step, and known contact context.
3. Shows a reassurance screen after the feeling question. The copy validates the visitor without treating fear as proof.
4. Collects the phone number only after the context questions and a lawful-use acknowledgment.
5. Submits the number in a private POST body. The number is not included in the landing URL, UTM parameters, or Meta data.
6. Runs Anya's real public-source phone lookup and renders the real result state inside the standalone funnel.
7. Uses Anya's secure result vault and existing unlock flow for teaser results.
8. Lets an authenticated customer download the unlocked report as a PDF or receive the same PDF by email.

A completed zero-match lookup uses the same paid unlock as a lookup with matches. Before unlock, the funnel says only that the report is ready. After unlock, it reveals the provider outcome honestly, including `No public matches found` when that is what the search returned. The user is paying for the completed search and report, not a guaranteed match.

The report never claims to read private messages or prove cheating. It states that public names, profiles, handles, and source records are context to verify—not a verdict.

## Women-focused ad destinations

| Ad     | Hook                               | Asset                                               | Destination URL                                                        |
| ------ | ---------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| HER-01 | Who is he texting after midnight?  | `women/women-who-is-he-texting-midnight-4x5.png`    | https://anyaint.com/go/cheating/women/who-is-he-texting-after-midnight |
| HER-02 | Who is she in his phone?           | `women/women-who-is-she-in-his-phone-4x5.png`       | https://anyaint.com/go/cheating/women/who-is-she-in-his-phone          |
| HER-03 | Why does her name keep showing up? | `women/women-why-her-name-keeps-showing-4x5.png`    | https://anyaint.com/go/cheating/women/why-her-name-keeps-showing-up    |
| HER-04 | Is he talking to someone else?     | `women/women-is-he-talking-to-someone-else-4x5.png` | https://anyaint.com/go/cheating/women/is-he-talking-to-someone-else    |
| HER-05 | Who keeps calling him back?        | `women/women-who-keeps-calling-him-back-4x5.png`    | https://anyaint.com/go/cheating/women/who-keeps-calling-him-back       |

HER-01 also has the square asset `women/women-who-is-he-texting-midnight-square.png`; it uses the same HER-01 destination.

## Men-focused ad destinations

| Ad     | Hook                               | Asset                                            | Destination URL                                                       |
| ------ | ---------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| HIM-01 | Who is she texting after midnight? | `men/men-who-is-she-texting-midnight-4x5.png`    | https://anyaint.com/go/cheating/men/who-is-she-texting-after-midnight |
| HIM-02 | Who is he in her phone?            | `men/men-who-is-he-in-her-phone-4x5.png`         | https://anyaint.com/go/cheating/men/who-is-he-in-her-phone            |
| HIM-03 | Why does his name keep showing up? | `men/men-why-his-name-keeps-showing-4x5.png`     | https://anyaint.com/go/cheating/men/why-his-name-keeps-showing-up     |
| HIM-04 | Is she talking to someone else?    | `men/men-is-she-talking-to-someone-else-4x5.png` | https://anyaint.com/go/cheating/men/is-she-talking-to-someone-else    |
| HIM-05 | Who keeps calling her back?        | `men/men-who-keeps-calling-her-back-4x5.png`     | https://anyaint.com/go/cheating/men/who-keeps-calling-her-back        |

HIM-01 also has the square asset `men/men-who-is-she-texting-midnight-square.png`; it uses the same HIM-01 destination.

## Meta URL parameters

Set the clean destination from the tables above in the Website URL field. Put tracking in Meta's URL parameters field:

```text
utm_source=meta&utm_medium=paid_social&utm_campaign=cheating_prospecting&utm_content={{ad.name}}&utm_term={{adset.name}}
```

Do not place a searched phone number, name, email, username, questionnaire answer, or other subject information in a URL parameter, custom conversion, event field, or Meta audience value.

## Local preview links

Replace the host with `http://localhost:3000` while running `npm run dev`, for example:

```text
http://localhost:3000/go/cheating/women/who-is-he-texting-after-midnight
http://localhost:3000/go/cheating/men/who-is-she-texting-after-midnight
```

## PDF and email delivery

PDF generation works through the authenticated report export route. Email delivery uses Resend and needs these production environment variables:

```text
RESEND_API_KEY=re_...
REPORT_FROM_EMAIL=Anya Reports <reports@anyaint.com>
```

The sender domain must be verified with the email provider. If email is not configured or delivery fails, the funnel tells the customer to download the PDF instead.

## Implementation map

- Campaign and question definitions: `config/cheating-funnels.ts`
- Standalone route: `app/go/cheating/[audience]/[slug]/page.tsx`
- Funnel interface: `components/funnels/cheating-funnel.tsx`
- Private POST search: `app/api/funnels/cheating/search/route.ts`
- PDF report endpoint: `app/api/funnels/cheating/report/pdf/route.ts`
- Email report endpoint: `app/api/funnels/cheating/report/email/route.ts`
