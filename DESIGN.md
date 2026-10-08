---
name: "Le Grande Centre"
description: "A deep-green mall identity with a calm, precise leasing workspace"
colors:
  brand-ink: "#002116"
  brand-gold: "#d4af37"
  brand-gold-light: "#e8c84a"
  brand-paper: "#f4f0e4"
  brand-muted: "#b8c2ba"
  mall-dark-surface: "#001a12"
  mall-dark-raised: "#0a2a1a"
  mall-light-canvas: "#faf8f0"
  mall-light-surface: "#f5f5dc"
  mall-light-raised: "#ffffff"
  mall-light-ink: "#1a1a1a"
  mall-light-muted: "#444444"
  mall-outline: "#778a7f"
  admin-primary: "#163e2f"
  admin-selection: "#9b7938"
  admin-canvas: "#f5f3eb"
  admin-surface: "#fffefa"
  admin-raised: "#f4f5ef"
  admin-sidebar: "#082e22"
  admin-sidebar-ink: "#f3f0e4"
  admin-sidebar-muted: "#bbcabf"
  admin-sidebar-accent: "#dcc18a"
  admin-sidebar-line: "#2b4d3d"
  admin-nav-border: "#87956a"
  admin-selected: "#e9eee5"
  admin-selected-border: "#98ad9e"
  admin-ink: "#203a2e"
  admin-muted: "#647266"
  admin-line: "#e3e5db"
  admin-nav-active: "#244938"
  admin-floor-active: "#e9eee4"
  admin-field-border: "#e3e5db"
  slot-available: "#e8f1e9"
  slot-leased: "#f3eceb"
  slot-other: "#f8f2e2"
  slot-selected: "#f6efd9"
typography:
  public-display:
    fontFamily: '"Playfair Display", Georgia, serif'
    fontSize: "clamp(2.5rem, 6vw, 5rem)"
    fontWeight: 400
  public-body:
    fontFamily: '"Be Vietnam Pro", "Aptos", system-ui, sans-serif'
    lineHeight: 1.8
  admin-headline:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "34px"
    fontWeight: 400
    letterSpacing: "-0.025em"
  admin-headline-mobile:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "30px"
    fontWeight: 400
  admin-area:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "32px"
    fontWeight: 400
  admin-panel-title:
    fontSize: "17px"
    fontWeight: 600
  admin-mobile-field:
    fontSize: "16px"
  admin-geometry-status:
    fontSize: "10px"
  admin-title:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 700
  admin-body:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
  admin-control:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 500
  admin-label:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 500
  admin-meta:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "11px"
rounded:
  admin-chip: "3px"
  admin-floor-choice: "4px"
  admin-control: "8px"
  admin-panel: "12px"
  brand-control: "0"
spacing:
  compact-gap: "6px"
  control-gap: "8px"
  panel-gap: "24px"
  inspector: "24px"
  rail-inline: "12px"
  sidebar-inline: "18px"
  content-inline: "36px"
components:
  admin-button-primary:
    backgroundColor: "{colors.admin-primary}"
    textColor: "{colors.admin-surface}"
    rounded: "{rounded.admin-control}"
    padding: "0 12px"
    typography: "{typography.admin-control}"
  admin-button-secondary:
    backgroundColor: "{colors.admin-raised}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.admin-control}"
    padding: "0 12px"
    typography: "{typography.admin-control}"
  admin-field:
    backgroundColor: "{colors.admin-raised}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.admin-control}"
    padding: "8px 12px"
  admin-nav-active:
    backgroundColor: "{colors.admin-nav-active}"
    textColor: "{colors.admin-sidebar-accent}"
    rounded: "{rounded.admin-control}"
    padding: "9px 11px"
  admin-panel:
    backgroundColor: "{colors.admin-surface}"
    rounded: "{rounded.admin-panel}"
  admin-chip:
    rounded: "{rounded.admin-chip}"
    padding: "4px 7px"
  admin-floor-active:
    backgroundColor: "{colors.admin-floor-active}"
    textColor: "{colors.admin-primary}"
    rounded: "{rounded.admin-floor-choice}"
    padding: "9px 10px"
  admin-plan-slot:
    backgroundColor: "{colors.slot-available}"
    padding: "7px 3px"
---
# Design System: Le Grande Centre

## Overview

**Creative North Star: "A leasing desk"**

Le Grande pairs a deep-green mall identity with restrained gold and editorial serif display type. In the admin workspace, that identity becomes a calm leasing desk: a dark green navigation rail, a warm light canvas, pale panels and focused green actions. The admin palette is a scoped product adaptation; it does not replace the public shopping-mall theme.

The workspace treats floor geometry and records as working information. The plan, slot register and inspector stay visually connected; labels carry status meaning alongside color. Company and contract surfaces use the same restrained operational frame. Typography, spacing and state colors support quick scanning without making fixture data look like a confirmed inventory.

**Key Characteristics:**

- Deep green, warm paper and muted gold, with separate public and admin scopes.
- Editorial serif for public display and admin page titles; sans serif for controls and records.
- Flat bordered panels, quiet selection fills and explicit text status.
- Fixed-width geometry with contained scrolling and stacked mobile layouts.

**The Scope Rule.** Keep brand colors and admin semantic overrides separate; admin route tokens stay under the admin root.

## Colors

The public theme uses a dark green base, warm gold actions and soft paper text. The operational variant inverts the workspace to a light canvas while keeping a dark sidebar. Frontmatter values are the color source of truth; synthesized sidecar ramps are preview metadata, not additional production tokens.

### Primary

- **Deep Mall Green** (`brand-ink`): public theme canvas and dark-theme foreground for gold actions.
- **Mall Gold** (`brand-gold`): public action and accent color; the brighter `brand-gold-light` is reserved for hover and focus on the dark scheme.
- **Leasing Green** (`admin-primary`): actions and emphasis in the admin workspace.
- **Sidebar Green** (`admin-sidebar`): navigation surface; its warm light text and brass accent are scoped to the sidebar.

### Secondary

- **Muted Brass** (`admin-selection`): admin selection outline and keyboard focus, distinct from public brand gold.
- **Pale Brass** (`admin-sidebar-accent`): active sidebar text and emphasis on the dark navigation surface.

### Neutral

- **Warm Paper and Soft Sage** (`brand-paper`, `brand-muted`): public text and supporting detail on dark green.
- **Leasing Canvas and Porcelain** (`admin-canvas`, `admin-surface`, `admin-raised`): workspace, panels and raised controls.
- **Admin Ink, Muted Text and Fine Line** (`admin-ink`, `admin-muted`, `admin-line`): operational text, supporting labels and dividers.
- **Inventory Fills** (`slot-available`, `slot-leased`, `slot-other`, `slot-selected`): quiet plan states. Selection is also indicated with an outline, and every state retains a text label.

The public theme also defines dark and light semantic surfaces. Admin route overrides remain explicit so theme changes do not leak between the public frame and operations workspace.

## Typography

**Public display:** Playfair Display with Georgia and serif fallback. **Public body:** Be Vietnam Pro, Aptos, system UI and sans fallback. These stacks are declared in CSS; this document does not assume the named web fonts are downloaded.

**Admin display:** Georgia and Times New Roman serif stack for page and dossier headings. **Admin body:** system UI sans. Tabular numerals support dates, areas and register values.

### Hierarchy

- **Public display** (regular, fluid 2.5–5rem): the centered holding-page headline.
- **Admin headline** (regular, 34px desktop and 30px mobile): route title and major dossier heading.
- **Area display** (regular, 32px): selected area in the plan inspector.
- **Panel title** (semibold, 17px): section and register headings.
- **Body** (13–14px, 1.55–1.8 line height): workspace copy and records.
- **Label and meta** (11–12px): filters, form labels and supporting information. Plan geometry may use 9–10px only where the diagram requires it.

The interface keeps small operational labels compact, but important status, inventory and action meaning must remain available as readable text.

## Layout

The shared admin shell has two modes: a vertical sidebar and horizontal top navigation. The sidebar is 248px in the Le Grande adapter and collapses to a 76px icon rail; collapsed links retain accessible names and use the browser's native `title` tooltip rather than a fixed overlay over workspace text. Top navigation places the brand in the header. Both modes use a sticky header with a 64px minimum height.

The Le Grande workspace has a 1564px content cap, 36px desktop inline padding and 24px padding below 1250px. The sidebar uses 18px inline padding and a 30px top inset. At 850px and below, desktop navigation is replaced by a modal menu with focus containment, Escape dismissal and focus return. The mobile workspace uses 16px inline padding, 44px minimum touch controls and 16px field text.

Plan and record views place a primary region beside an inspector, then stack them at the compact breakpoint. The B2B dossier gives its company list a wider stable column before stacking. Feature breakpoints at 1250px, 1100px, 1000px, 800px and 520px handle content density independently of the shared shell breakpoint. Six floor choices stay in a fixed grid; narrow filters wrap and media tiles reduce to two columns.

The floor diagram keeps a 680px minimum width and 310px minimum height inside a labelled, keyboard-focusable horizontal scroll region. Tables scroll inside their panels. Long statuses and media names wrap; supporting lead details truncate within their rows.

## Elevation & Depth

Admin panels are flat at rest. Thin borders, warm surface changes and selected fills establish hierarchy; no shadow is applied to the plan, register or inspector panels. Overlay shadows exist as shared theme tokens for floating surfaces, while the navigation dialog uses a backdrop to separate it from the workspace.

**The Flat Panel Rule.** Use a border or a tonal surface change for ordinary workspace sections; reserve shadow for overlays that must sit above the page.

## Shapes

Public brand controls retain square corners. Admin controls use a softly rounded 8px corner; panels are larger at 12px, floor choices use a tighter 4px corner and selection chips use 3px. Avatars remain circular. Slot rectangles stay square so the plan reads as geometry rather than as a card grid. Selected slots use an inset outline; grouped footprints use a stronger border while still showing their original members.

## Components

### Buttons and fields

Shared buttons use the admin action palette, compact horizontal padding and a 42px minimum height; mobile actions grow to 44px. Quiet and secondary variants remain on the light surface. Inputs, selects and textareas use a raised fill, fine border, visible label and an explicit gold focus ring. Disabled and loading states keep native button behavior and clear text feedback.

### Panels, chips and registers

Plan, inspector and record panels use warm white surfaces, a thin line and generous 24px padding in the refined admin layout. Toolbars and tables use dividers instead of nested card borders. Slot-membership chips list original slot codes and expose a named removal action. Registers keep a stable pagination footer and stable table columns as visible rows change.

### Navigation and floor choices

Vertical and horizontal navigation use the same item states. The active item has a tinted surface, semantic border and a 3px position marker; horizontal navigation moves the marker to the bottom edge. A collapsed icon rail keeps the button hover surface inside the rail and exposes its name with the native `title` attribute. Keyboard focus remains a separate 3px outline.

Floor choices communicate one of six fixed floors with a clear selected fill and border. The floor labels are fixture descriptions, not confirmed tenant allocations.

### Status and feedback

Badges combine a restrained tone with a text label. Inventory state must never rely on color alone. Transient confirmations and errors use the shared toast component; persistent constraints stay with the relevant record. Pagination shows the current range, total and page-size control, and remains outside the changing content region.

### Floor plan and grouped spaces

The signature view connects the slot plan to its register and inspector. Selection previews area and membership. A grouped footprint remains visually composed from its original slots; it does not replace their identity. The customer B-series reference keeps the lobby/void break between B.5 and B.6. Its repeated use across floors is a fixture, not a confirmed technical drawing.

**The Slot Identity Rule.** A grouped space is shown as a combination of base slots; keep each original slot code and area visible in the register.

### Company and contract workspace

The company list and dossier share one operational layout. Lease and request records link back to the affected slots, while local SVG mini-plans are navigation aids rather than formal drawings. Document samples use a restrained paper sheet treatment and stay visually distinct from a signed contract.

## Do's and Don'ts

### Do:

- **Do** keep the public brand palette separate from route-scoped admin colors.
- **Do** pair status color with readable text and preserve visible keyboard focus.
- **Do** keep plan geometry square, label grouped members and retain the central core boundary.
- **Do** use the customer reference raster with its provenance when showing the source plan.
- **Do** keep the diagram and tables inside their labelled scroll regions on narrow screens.

### Don't:

- **Don't** use color alone to communicate inventory or lead status.
- **Don't** style slot geometry as rounded cards or hide the original members of a grouped space.
- **Don't** apply admin typography or semantic overrides to the public identity.
- **Don't** present repeated fixture geometry or sample documents as confirmed inventory or signed records.

## Public image-to-3D experience — confirmed redesign

The supplied sunset image and https://realestate-neotix.vercel.app/ govern the public experience, not the admin workspace. Mode: Experience. Home leads with the exact supplied image, edge-to-edge, a quiet project title and the explicit “Khám phá” action. The image is a labelled concept reference, not evidence of the existing building architecture.

`/kham-pha/` is a full-viewport scene, not an embedded card: canvas fills the screen; a persistent “Thoát” link returns home. Floor information lives in a dismissible HTML panel; controls recede onto charcoal surfaces. Mobile uses the same canvas-first flow with a bounded information sheet and 44px touch controls.

Public palette replaces green with midnight slate `#19252b`, charcoal `#242b2c`, amber `#e7bd79`, limestone paper `#f1e9dc`, cream `#fff2dc`. Keep Playfair Display and Be Vietnam Pro. Scene mood is golden sunset, dark reflective road, warm lighting and lush landscape. Preserve the actual building geometry, never copy the reference building.

Free horizontal360° orbit and overhead elevation are required; presets are starting points, not orbit corridors. Limit distant zoom, not all-view building fit. Cars and people move on defined paths; motion can pause and respects reduced-motion/hidden tabs. Load 3D only after entering the experience. Admin colors, data truth and public-claim approval rules remain unchanged.

## Homepage navigation refinement — 08/10/2026

Prioritize the public homepage for client review. Use five destinations with separate pages: Trang chủ, Mặt bằng / Cho thuê, Tổng quan từng tầng, Tổng quan Le Grande, Liên hệ. The homepage retains the existing cover, project film and contact section; its main cover action opens leasing information, with 3D as a second action. Six floor links form an editorial list beneath the introduction. Programme descriptions share one public content module with the overview pages and viewer; they do not represent live inventory.

The shared header uses a horizontal desktop menu and a native mobile disclosure. Keep the dark slate, cream and amber public identity. Separate pages reuse the header and contain available public project information; no leasing workflow is added. Verification: TypeScript passed, four new routes returned HTTP 200, the mobile menu navigated to the leasing page, and 1440px/390px browser checks showed no horizontal page overflow. Screenshots inspected at `/tmp/le-grande-home-desktop.png`, `/tmp/le-grande-home-mobile.png` and `/tmp/le-grande-home-floors.png`. These checks cover local UI and navigation, not production deployment.

## Canva content import — 08/10/2026

Keep the exact shared navigation: Trang chủ, Mặt bằng/Cho thuê, Tổng quan từng tầng, Tổng quan Le Grande, Liên hệ. Apply the supplied Canva layout and content below that navigation on the leasing, project overview and contact pages. These pages use scoped green and cream styling, native filters and floor selection, local attributed imagery and shared contact details. Floor overview links select the corresponding leasing floor by hash. The sample A01–A05 plan is illustrative; floors 2–6 await technical data. Customer portal stays hidden.

Local visual inspection covered all three pages at 1440px and 390px, with no horizontal page overflow and all images loaded. Area filtering was checked manually. This is a local UI update; production CMS integration and publication remain outside this change.

## Contact form and legacy editorial sections — 08/10/2026

Contact follows the supplied Canva two-column composition: project contacts on the left, a cream framed form on the right. At narrow widths, information then fields flow in DOM order; form controls use 16px mobile type and minimum 48px height. The form uses existing shared UI fields with local semantic tokens, explicit unchecked consent and inline validation. Business fields, validation and first-error focus remain local; the shared `@mall/ui/forms` survey submission hook owns readiness, duplicate-submit protection, storage synchronization and the three-success/five-minute window followed by a five-minute cooldown. The contact adapter selects `mode: "demo"` and local storage with the existing `legrande:contact-preview-rate-limit:v1` key. Demo mode never sends or stores contact details.

The old legrandecentre.vn site now governs the investor letter and project document sections. Preserve its centered serif title, green/gold emphasis, pale decorative stock background, quote rhythm, diamond SVG divider and leadership signature. Keep its three document groups; only actual available files get download anchors. Brochure uses the verified local file; decision is copied from the public old site. Dedicated floor plans and building permit await files because the old floor-plan URL returns brochure bytes and the permit URL is missing. Route composition and shared navigation stay intact.

## Branded header and Solar-style submission feedback — 08/10/2026

Use the original legrandecentre.vn logo mark with its uppercase gold serif wordmark in the shared public header, including the homepage. Self-host the resized transparent logo (256px) and browser icon (64px). Keep the approved five page destinations rather than importing the old eight anchor links. The header remains available while scrolling; desktop links use the old gold hover/active underline, and the native mobile disclosure closes on navigation. Motion respects reduced-motion.

The contact form delegates submission outcomes to `useSurveySubmission<ContactValues>` and default feedback to the shared `SurveyForm` wrapper from `@mall/ui/forms`. Shared demo mode matches Solar’s 700ms submission delay and equal random success/failure outcomes; live mode instead requires a real asynchronous submit handler. `SurveyForm` owns the persistent demo disclosure and safe-area-aware system Toast, including honest demo copy, accessible announcements, close and timed dismissal. Contact no longer duplicates gateway simulation, rate-limit helpers, notice state, Toast markup or placement CSS. Failure preserves the form values; only a shared successful submission resets them. The local form retains its fields, labels, first-error focus and cooldown countdown copy.

Verified locally at 1440×960 and 390×844: original logo loaded, all five destinations remained usable, mobile keyboard navigation closed the menu, neither page nor toast overflowed, both outcomes appeared, dismissal worked, and the third demo success disabled submission with a 05:00 countdown.
