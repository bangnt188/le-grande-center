# Legacy public site import

Source: https://legrandecentre.vn/ — fetched 2026-10-08 at the user’s request.
The letter, project-document section, reasons-to-choose section and verified static assets were brought into native components. No scripts, DOM injection or original navigation were imported. This is reconstruction from publicly served HTML/CSS; it is not the original Git repository or editable React source.

- Letter background: https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1920&q=60 (referenced by original LetterSection CSS), self-hosted as `letter-background.jpg`. Decorative stock image, not a photo of Le Grande Centre or Sóc Trăng.
- `documents/quyet-dinh.pdf`: https://legrandecentre.vn/documents/legal/quyet-dinh.pdf, HTTP 200 / application/pdf / 594308 bytes, SHA-256 `9ed208b2404786eed286b5ebc8eeb0e37574b98a31586b65f7ea4b8cfb424658`. Copied without changing the PDF.
- Existing `public/le-grande-brochure.pdf`: valid 17-page PDF; SHA-256 `d1bcf9a3e0fae2f73f4e6e13c0c09b82690eb1d16a3778412cab5fc232d4e7ca`.
- Original brochure URL `/documents/brochure/brochure-du-an.pdf`: HTTP 404. Use the existing verified local brochure.
- Original floor-plan URL `/documents/floor-plans/so-do-mat-bang.pdf`: HTTP 200 but identical SHA-256 to the brochure above. Do not publish it as a separate technical floor plan; the dedicated floor-plan download remains awaiting a file.
- Original building-permit URL `/documents/legal/giay-phep-xay-dung.pdf`: HTTP 404. Download remains awaiting a file.

Copying published files does not independently establish the legal status of the project. Replace future files through the reviewed publication process.

## Reasons-to-choose section kept for later use

Source section: `https://legrandecentre.vn/#amenities`, fetched 2026-10-08. Full six-item marketing copy and CTA are retained in `LEGACY_PROJECT_REASONS`; native renderer is `ProjectReasons`. CTA destination is adapted from the old `#contact` anchor to the current `/lien-he/` route. HTML/CSS source evidence is at `docs/design-evidence/legacy/reasons-source.html` and `legacy-page-source.css`. No old reveal script or CSS is loaded by the application. The section is not currently mounted on a page.

## Header branding

- `logo-without-text.png`: original https://legrandecentre.vn/images/logo/logo-without-text.png, transparent 2363×2363 PNG, resized to 256×256 for the shared public header; 25230 bytes, SHA-256 `67294e15a323245234b9d7fe1876f0757910b0b277f9d28ccf2fd1afdd71c24a`.
- `icon.png`: original https://legrandecentre.vn/icon.png, resized to 64×64 for the browser tab; 3474 bytes, SHA-256 `7c00744046e77868ff781e24993204b3663f9e673065d7fc08a641de94feabb8`.
- The uppercase wordmark and gold active/hover underline reproduce the published header’s branding in native components. Navigation still uses this project’s five approved routes, not the legacy anchor menu. These are project branding assets, not third-party branding substitutes.

Assets were fetched from the project’s public site at the user’s request; that source alone is not an independent trademark-rights clearance.
