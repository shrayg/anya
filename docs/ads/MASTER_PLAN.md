# Anya single-frame campaign system

This is a flexible creative operating system, not a fixed sequence. The work should keep enough structure to remain recognizably Anya while leaving room to discover unexpected hooks, crops, proof patterns, and campaign-specific visual ideas.

## The campaign thesis

Anya should not advertise an atmosphere. It should advertise the moment uncertainty becomes a useful lead.

Every strong single-frame creative should make three things understandable almost immediately:

1. What the person knows: an email, phone number, username, Discord ID, name, wallet, domain, or other starting signal.
2. What Anya does: checks relevant public and licensed intelligence sources and connects the useful findings.
3. What the person gets: profiles, exposure context, public records, platform links, or a clearer next step.

The product is the hero. Human emotion creates the reason to look; product proof earns the click.

## The real Anya design language

### Brand idea

- Core promise: "Look people up. Connect the trail. Keep the file."
- Product narrative: one clue becomes a connected, source-aware picture.
- Emotional posture: calm control under uncertainty, not panic, vigilantism, or cyberpunk theater.
- Evidence posture: source-aware, reviewable, and framed for lawful research.

### Visual grammar

- Background: true black and near-black, with a restrained signal lattice or dotted field.
- Primary accent: ice blue `#C3D3E6`; brighter highlight `#D8E6F4` to `#E8F2FF`.
- Surfaces: charcoal glass, approximately `rgba(10,10,12,.62)` through `rgba(8,8,10,.78)`.
- Borders: one-pixel white hairlines at roughly 8–16% opacity.
- Type: Manrope for hooks, decisions, and readable UI; IBM Plex Mono for inputs, source labels, IDs, and proof metadata; Bruno Ace SC only for the compact wordmark/system moments.
- Shape: restrained 9–18px radii, rounded controls, compact cards, disciplined grids.
- Depth: thin inset highlights and broad dark shadows; no milky glass slabs or large white result cards.
- Motion language translated to static: directional rails, status dots, source counts, and visual continuation from input to results.
- Accent colors: small semantic platform/status colors only. Ice blue remains the brand color. Red is not a brand accent.

### What must not drift

- No serif editorial headline as the default Anya voice.
- No blue-gray fog covering most of the frame.
- No fake light-mode product UI.
- No unexplained neon red.
- No generic "hacker dashboard" or invented product navigation.
- No mugshots, children's faces, private addresses, real identifiers, or imagery that implies surveillance of a specific person.
- No screenshot pasted into a cinematic background. Rebuild the needed product proof as editable components.

## Single-frame composition

Treat this as a set of movable proportions rather than a rigid template:

- 10–20%: brand and a short human hook.
- 65–78%: the product proof surface.
- 8–15%: payoff, CTA, or trust language.

The product surface usually needs four beats:

1. Input label — what was searched.
2. Query — fictional demo value shown clearly.
3. Proof rail — a small count or status that establishes completion.
4. Result cards — the actual useful answer, with platform/source labels.

If a viewer cannot understand the input and the nature of the output without reading the caption, the frame is not ready.

## Flexible creative territories

These are starting territories. They can be combined when the product proof remains clear.

### 1. Identity reveal

- Human question: "Who's behind the username?"
- Best modules: Username, Discord ID, Roblox, Contact Profiles, Breaches.
- Product proof: one handle becomes public account surfaces and aliases.
- Broad use: catfish, harassment, marketplace, gaming, dating, parenting.

### 2. Exposure check

- Human question: "What can they find on you?"
- Best modules: Breaches, Contact Profiles, Index Sweep, Fraud Footprint, Stealer Logs.
- Product proof: searched email, exposure count, source cards, and risk context.
- Paid advantage: safety and self-protection framing is less policy-fragile.

### 3. Scam prevention

- Human question: "Before you send the money."
- Best modules: Phone, Username, Breaches, Fraud Footprint, Crypto Intel.
- Product proof: input, reputation signals, connected profiles, and clear risk flags.
- Paid advantage: immediate utility and a credible prevention action.

### 4. Trust before contact

- Human question: "Look them up first."
- Best modules: Name Search, Phone, Public Records, Contact Enrich.
- Product proof: identity, phone, public-record, and social-signal modules.
- Constraint: never claim Anya is a consumer reporting agency or promote FCRA-regulated employment, housing, credit, or insurance decisions.

### 5. Relationship uncertainty

- Human question: "Are they who they say?"
- Best modules: Username, Phone, Contact Profiles, Breaches, dating-app modules.
- Product proof: public profile surfaces and identifier consistency.
- Platform note: use softer verification language on Meta; reserve sharper betrayal language for appropriate organic channels.

### 6. Parent safety

- Human question: "Who's in their game lobby?"
- Best modules: Discord ID, Roblox, Minecraft, Username.
- Product proof: fictional username or Discord ID, gaming profiles, alias/history signals.
- Platform note: keep the paid version about checking public identity signals. Avoid crime accusations, child imagery, and fear-gore.

## Campaign production loop

For each campaign, make decisions in this order, but allow the creative to loop backward when a stronger visual idea appears:

1. Choose the emotional category and a specific moment, not a demographic stereotype.
2. Choose the real Anya module that visibly solves that moment.
3. Find the shortest human hook. Prefer 3–7 words.
4. Decide which one proof event deserves most of the frame.
5. Build the frame from editable design components and fictional demo data.
6. Write the caption after the image works. The caption carries nuance; the frame carries the question and proof.
7. Adapt the same creative idea to 4:5, 1:1, and 9:16 with composition changes, not blind crops.
8. Review claim truth, privacy, readability, landing-page continuity, and platform risk.
9. Export a small family of meaningfully different variants.

## Variant logic

Avoid making five ads that only change one adjective. Useful variants change a real creative lever:

- Hook: curiosity vs safety vs loss avoidance.
- Proof focus: platform matches vs exposure records vs risk summary.
- Product framing: full workspace vs close result card vs input/output split.
- Density: one decisive finding vs a multi-source evidence stack.
- CTA: "See what connects" vs "Check the username" vs "Search yourself."

A sensible first test cell is three hook territories by two proof framings. Keep the landing destination and offer stable so the creative variable can be read honestly.

## Initial campaign order

1. Exposure/self-search — safest paid lane and clearest Breaches demonstration.
2. Scam prevention — high urgency with a defensible safety benefit.
3. Identity reveal — broadest use case and strongest visual input→output story.
4. Trust before contact — steady demand, but keep FCRA boundaries explicit.
5. Relationship uncertainty — large volume, higher moderation sensitivity.
6. Parent safety — strongest emotion, best handled carefully and often organically.
7. Professional/OSINT — separate visual tone, offer, landing page, and budget.

## First mockup

Route: `/dev/campaign-preview`

Concept: "Who's behind the username?"

- Format: 1080×1350, designed as a native 4:5 feed frame.
- Product share: roughly 70% of the usable composition.
- Demo input: `northstar_01`.
- Demo output: four fictional public-account signals.
- Design: generated entirely from HTML/CSS/React icons using Anya's real fonts and tokens.
- Purpose: establish the visual baseline before multiplying campaign scenarios.

## QA before export

- Hook is readable at phone-feed size.
- The query and result type are legible without zooming.
- The product occupies the majority of the frame.
- All names, handles, IDs, phone numbers, emails, and records are clearly fictional.
- The frame does not imply certainty beyond the product evidence.
- Platform icons are supporting labels, not trademark-dominant decoration.
- No screenshots, stock-person imagery, or private data are embedded.
- The CTA matches the landing module.
- Contrast and crop safety are checked at the exact export ratio.
- Spelling, punctuation, and typography are checked after rendering.

## Measurement

Read the creative as a funnel rather than chasing one metric:

- Thumb-stop / first impression: hook and product silhouette.
- Outbound CTR: the proof is understandable and relevant.
- Landing-page view rate: message and load quality.
- Search start / registration: landing continuity.
- Paid conversion: product value and offer.
- Frequency and negative feedback: fatigue or over-aggressive framing.

Keep a short qualitative note with every test: what uncertainty the ad created, what proof it showed, and what the next screen promised. That record will matter more than a rigid taxonomy once the account starts producing real signal.
