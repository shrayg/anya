# Anya single-frame campaign delivery

## Ready-to-use assets

- `campaigns/kids/`: five 4:5 ads plus the square category winner
- `campaigns/cheating/`: five 4:5 ads plus the square category winner
- `campaigns/exposure/`: five 4:5 ads plus the square category winner
- `campaigns/trust/`: five 4:5 ads plus the square category winner
- `contact-sheets/`: visual QA sheets for fast review
- `campaign-copy.csv`: import-friendly copy, audience, lane, landing, and asset paths
- `campaign-manifest.json`: complete machine-readable campaign definitions

Use the PNG files as the final delivery format. JPG files are retained as high-quality render intermediates.

## Preview and regenerate metadata

- Preview a campaign at `/dev/campaign-preview/<campaign-slug>`.
- Add `?format=square` for the square composition.
- Edit campaign content in `config/ad-campaigns.ts`.
- Run `npm run ads:manifest` to rebuild the CSV, JSON, and campaign matrix.

The rendered product interface is generated from React and CSS. No Anya product screenshot is baked into the ad.
