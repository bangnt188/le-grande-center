---
name: "Le Grande Centre"
description: "Existing green and gold identity with a light operational workspace"
colors:
  brand-ink: "#002116"
  brand-gold: "#d4af37"
  brand-gold-light: "#e8c84a"
  brand-paper: "#f4f0e4"
  brand-muted: "#b8c2ba"
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
  admin-control: "8px"
  admin-panel: "12px"
  admin-project: "6px"
  brand-control: "0"
spacing:
  compact-gap: "6px"
  control-gap: "8px"
  panel-gap: "12px"
  inspector: "14px"
  sidebar-inline: "16px"
  content-inline: "36px"
components:
  admin-button-primary:
    backgroundColor: "{colors.admin-primary}"
    textColor: "{colors.admin-surface}"
    rounded: "{rounded.admin-control}"
    padding: "0 16px"
    typography: "{typography.admin-control}"
  admin-button-secondary:
    backgroundColor: "{colors.admin-raised}"
    rounded: "{rounded.admin-control}"
    padding: "0 16px"
    typography: "{typography.admin-control}"
  admin-field:
    backgroundColor: "{colors.admin-raised}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.admin-control}"
    padding: "8px 16px"
  admin-nav-active:
    backgroundColor: "{colors.admin-nav-active}"
    textColor: "{colors.admin-sidebar-accent}"
    rounded: "{rounded.admin-project}"
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
    rounded: "{rounded.admin-control}"
    padding: "9px 10px"
  admin-plan-slot:
    backgroundColor: "{colors.slot-available}"
    padding: "7px 3px"
---
# Design System: Le Grande Centre

## Overview

**Creative North Star: "A leasing desk"**

The existing public identity uses deep green, gold and editorial serif display type. The admin extends that identity into a light leasing desk: a deep green sidebar, cream working canvas, warm white panels and green actions. Gold marks selection and keyboard focus. These admin colors are route adaptations, not replacements for the shopping-mall brand tokens.

The working interface is compact and data oriented. Geometry, slot membership and readable text states carry the hierarchy; bordered panels connect the floor plan, register and inspector. Leads and media reuse the same navigation, filtering and inspector structure. The B2B extension opens on a searchable company register and a dossier with overview, request/hold, contract and document sections. Request decisions, linked original slots and appointment records use the same operational frame.

**Key Characteristics:**

- Deep green admin sidebar and cream canvas; public identity remains a separate scope.
- Serif admin page/dossier headings; system sans for data and controls.
- Text labels accompany status colors; slot records survive grouping.
- Contained plan scrolling and stacked panels on small screens.

This is a scan of the implemented system, not a new identity proposal. The shared operational frame is supplied by `@mall/ui`; app adapters retain branding, routing and business state. Sources: `packages/ui/src/components/layout/admin-shell.tsx`, `admin-shell.module.css`, `admin-workspace-layout.tsx`, `admin-workspace-layout.module.css`, `src/features/admin/le-grande-admin-shell.tsx`, `packages/ui/docs/admin-layout.md`, `src/app/globals.css`, `packages/ui/styles/themes/shopping-mall.css`, `packages/ui/styles/reset.css`, `src/app/admin-preview/admin-preview.css`, `mall-system.css`, `admin-workspace.tsx`, `b2b-workspace.tsx`, `b2b-workspace.css`, `src/features/admin/b2b-model.ts`, `b2b-commands.ts` and `space-model.ts`. The surface brief stays in `.impeccable/surfaces/src-app-admin-preview-page-tsx.md`.

## Colors

The palette combines a dark green public identity with a warm light operational adaptation. Frontmatter values are normative; scope is part of each token's meaning. Sidecar tonal ramps are synthesized preview metadata, not production color scales.

### Primary

- **Brand Ink / Brand Gold:** shared shopping-mall identity and dark public holding page. Gold is the shared dark-theme action color.
- **Admin Primary:** local green action, active navigation and area emphasis (`--green` in the admin frame). Sidebar navigation uses its own pale brass action color.

### Secondary

- **Admin Selection:** local gold outline and keyboard focus (`--gold`); separate from the brighter brand gold.

### Neutral

- **Brand Paper / Brand Muted:** dark public typography.
- **Admin Canvas:** route override of the light shopping-mall canvas. The adapter carries `data-ui-root`, `data-ui-theme="shopping-mall"` and `data-ui-scheme="light"`; its semantic canvas token supplies the shared shell background.
- **Admin Surface / Ink / Muted / Line:** warm white panels, operational text and panel dividers. Sidebar text, selected surface and boundary use separate dark-surface tokens. The body fallback background is a separate route declaration, not the cream frame canvas.
- **Admin Nav Active / Floor Active / Field Border:** quieter selection surfaces and input boundaries.
- **Slot Available / Leased / Other / Selected:** spatial state fills. Every fill has a text label; the gold selection outline indicates interaction rather than inventory status.

**The Scope Rule.** Keep public brand colors and route-specific admin colors distinct; the approved admin variant has a dark sidebar and light workspace.

## Typography

**Public display:** Playfair Display with Georgia and serif fallback. **Public body:** Be Vietnam Pro, Aptos, system UI and sans fallback. These are declared stacks; this document does not assert that external fonts are downloaded.

**Admin body and controls:** system UI sans. This extends the incumbent operations interface. Page titles and dossier headings use the serif stack; operational labels and values remain sans. Numerals are tabular throughout the admin frame.

### Hierarchy

- **Public display:** the fluid heading in the holding page; the frontmatter records its observed clamp.
- **Admin headline:** shared page title is overridden to the admin headline token, with the mobile headline step at 850px. Dossier headings use the same mobile-size serif step. Solar retains its own adapter typography.
- **Admin title:** inspector heading. Floor and register headings use 17px.
- **Admin body:** workspace base; dense records use 12px.
- **Admin control / label / meta:** buttons, field labels and supporting data. Plan status is 10px with 1.35 line height and wrapping. Small source geometry labels reach 9px; they are not a recommended general reading size.
- **Mobile fields:** 16px at the stacked breakpoint, with 44px minimum height.

## Layout

The shared `AdminShell` has two presentation presets. `sidebar` places the brand above vertical navigation; `topnav` places the brand in the header with a contained horizontal navigation row beneath it. The sidebar preset supports a 76px desktop icon rail with accessible item names and hover/keyboard tooltips. Rail state and mobile menu state are independent. Mode changes preserve the app's business state.

Le Grande supplies a 248px desktop sidebar; Solar supplies 232px and its own blue palette. Both use a sticky header with a 64px minimum height. Shared content has a 1564px outer cap, 36px top and inline padding in Le Grande; inline padding becomes 24px below 1250px. Layout tokens belong to the adapters; presets do not represent roles or permissions.

At 850px and below, both presets hide desktop navigation and present a modal navigation menu through Base UI Dialog. The header retains the menu trigger and brand mark. The menu has a backdrop, focus containment, scroll lock, Escape and an explicit close control. Dismissal returns focus to its trigger; selecting a destination closes the menu and focuses that destination's page heading, with the trigger as fallback. The portal stays inside the themed shell root. Le Grande mobile content uses 26px top and 16px inline padding; inputs use 16px text and a 44px minimum height. Shared navigation and toggle controls have a 44px minimum height on both desktop and mobile.

Feature layouts keep their own responsive rules. The main plan or records column sits beside a 300px inspector across a 12px gap; at 1100px the inspector becomes 270px. At 800px and below, these panels stack with the inspector after the primary panel, six floor choices become three columns, and local buttons and fields have a 44px minimum height. At 520px and below, filters wrap to full width and media uses two columns. These feature breakpoints do not control the shared shell menu.

The B2B dossier uses shared `WorkspaceLayout` with a 320px company list beside its detail panel and a 28px gap; at 1250px the list narrows to 290px. The contract register and detail panel stack at 1200px and below. At 1000px, dossier, request and public-preview panels also stack; company choices occupy two columns until the 520px breakpoint returns them to a vertical list. Contract search and company filters stack below 800px. Dossier tabs scroll within their container. Below 800px, the four-step request journey becomes two columns and portal sections stack. The shared workspace also stacks at 850px and below. Current B2B company/dossier captures are included in the shared-shell evidence below; they do not cover every feature route.

The diagram retains a minimum 680px width and 310px height inside a labelled, keyboard-focusable horizontal scroll region. Tables scroll within their panels. Long statuses and media names wrap; supporting lead text truncates within its row.

## Elevation & Depth

Admin panels are flat, with white fills, thin borders and quiet selected surfaces. The header uses the warm white surface; mobile navigation uses the sidebar palette; the modal backdrop separates navigation from the workspace. There are no admin panel shadows. The shared shopping-mall theme separately defines overlay shadows: dark theme `0 20px 60px #0006`, light theme `0 4px 30px rgb(0 33 22 / 0.16)`; these are library capabilities, not shadows applied to this workspace.

## Shapes

System controls use the admin-control radius; panels use the admin-panel radius, with selection chips a tighter radius. Sidebar project card corners are a separate observed step. The public shopping-mall theme retains square corners; admin semantic token overrides apply only inside the admin root. Avatars are circular. Slot rectangles preserve the central core boundary and selected slots receive an inset outline (3px); grouped footprints have a 2px border.

## Components

### Buttons

Existing system `Button` owns actions, including explicit submit types, loading and disabled states. Primary uses Admin Primary and warm white text; secondary uses Admin Raised and the line boundary. App actions have a 42px desktop minimum height and 44px mobile height; compact pagination controls use 36px desktop and 44px mobile. Hover, disabled and pending behavior come from the shared component. Keyboard focus uses the system gold outline (3px, 2px offset).

The shared shell grid uses a 180ms `ease-out` transition and navigation backgrounds a 140ms transition only under `prefers-reduced-motion: no-preference`. B2B row backgrounds retain their local 140ms transition. The older 160ms plan/button rule still targets the removed `.admin-frame` wrapper and is not evidence of an active effect. Reduced motion disables those transitions. No page entrance effect is implemented.

### Fields

Existing `Input`, `Select`, `Textarea` and `Checkbox` own controls. Fields use Admin Raised with the line boundary, visible labels and the shared focus outline. Semantic overrides set the admin radius and foreground; app styles supply sizing and domain layout. Status inputs accept free text with suggested values, not fixed enums. Required and length limits come from the form contract. Transient media and command failures use the system error toast; persistent recovery actions remain in the workspace. Search controls carry accessible labels even when their visible form is a placeholder.

### Navigation and floor choices

Eight admin views share the same navigation: customers, requests/holds, leases, appointments, floor/spaces, leads, media and tenant-view preview. Shared sidebar navigation uses the dark green active surface and pale brass text; topnav uses the light selected surface and green text. Both expose `aria-current="page"`; links remain anchors and view actions remain buttons. Its compact items use 6px corners and 10px × 12px padding. System controls use the admin corner token; spatial slot controls stay square to preserve geometry. Floor controls carry pressed state and six fixed floor labels; this interface has no add or remove floor action. Floor purposes are fixture labels, not confirmed tenant allocation.

### Panels, chips and registers

White bordered plan, record and inspector containers share the same small panel corner. Toolbars and registers use divider lines. Selection chips list original slot codes and give removal controls accessible names. The original-slot register remains available after grouping; a selected row uses a quiet warm fill.

### Toast and pagination

Transient action feedback uses existing system `Toast`, composed by the app notification provider. Up to three notices are shown at bottom right; error notices remain for 12 seconds, other tones for 7 seconds. Notices can be dismissed, pause on hover/focus, and use system status/alert semantics. Persistent inventory constraints and deadlines remain in the relevant record; the merge guidance uses system `Alert`.

Existing system `Pagination` and `Select` render range/total, page buttons and rows per page in every main register. Filter/sort precedes pagination, filter and size changes reset to page one, and pages clamp when the result shrinks. Small registers start at two rows so the sample's real additional records can be viewed; slot/media registers start at five. The current implementation slices the authorized demo snapshot; production pagination requires bounded API queries and server authorization, not a full client-side download.

Shared `PaginatedContent` reserves the largest natural page height at the current container width, keeping the following Pagination footer stable on shorter pages and empty results. Page-size/density or width changes reset that measurement; page/filter changes retain it. Long content may grow rather than be clipped. The slot table uses stable column widths and a 960px minimum inside its horizontal viewport, preventing current-page content from redistributing columns.

Slot and lease registers use shared `Table`. Its optional row styling/click and named scroll viewport props extend the existing API. Lease detail remains accessible through a system Button as well as row click. Mobile tables stay in a named, focusable horizontal scroll region with a visible scroll hint.

### Floor plan and grouped spaces

The signature is the plan connected to its inspector and base-slot register. Selection previews summed area and membership. Merging requires adjacent vacant, tenant-free slots on one floor and one side of the central core; it cannot cross the lobby or void. Groups retain their own identity and reference unchanged original slot IDs and areas. Splitting restores the original membership view.

**The Identity Rule.** Grouped space identity never replaces base slot identity.

The customer B-series reference has eleven slots, with endpoint areas of 205 m² and other areas of 164 m²; the lobby divides B.5 and B.6. Its floor is unknown. The repeated plan on all six floors is a labelled fixture, not a technical drawing or confirmed inventory. `public/admin-demo/floor-plan.png` is the customer-supplied raster with embedded provenance, not generated imagery.

### Leads and media

Leads use selectable rows plus a detail inspector; statuses and consultation notes are editable. Media uses selectable thumbnail tiles plus an inspector for project, floor or grouped-space associations. Image previews use contain sizing, and documents retain an authored file icon. Authored line icons use inline SVG, not glyph characters.

### Enterprise dossier and request journey

A searchable company register opens a dossier with overview, request/hold, contract and document sections. Inline actions connect requests and contracts back to their original floor slots. Miniature SVG plans use the same slot geometry as the workspace; their highlighted membership is a navigation aid, not an official drawing.

The contract register starts with four sample leases across three companies and three floors, including single-slot and grouped-slot examples. Search matches contract code, company name and original slot codes; a company selector further narrows the register. Changing filters preserves a visible selection or selects the first matching contract. No matches clears the inspector selection and offers a filter reset. Opening a contract directly from its dossier or converted hold clears register filters so the destination remains visible. Record selection closes the previously open document illustration. Contract details, sample documents and floor navigation retain the same linked original slots.

The four-step strip explains request, review, hold and lease. Submitting a request does not reserve inventory. Approval requires a reviewer-entered duration of 1–720 hours for that demo decision; no production TTL policy is implied. The fixture command checks the complete adjacent selection on one floor and one side of the lobby, including overlapping commitments, before creating a hold. Rejecting a request or cancelling a hold requires a reason. Lease conversion is explicitly labelled a simulated signing action. The demo clock is fixed at 06/10/2026; displayed remaining time does not establish a live expiry service.

### Appointments, audience previews and document samples

Appointment requests are independent of inventory holds. The interface displays Vietnam time and sample 30-minute appointments, with confirm and cancel actions; it does not claim an official operating calendar.

The tenant-view preview switches between a public presentation and An Retail’s own-company portal. The public presentation shows fixture availability and a request form without internal hold deadlines, commercial terms or private document links. The portal renders that sample company’s requests, holds, contracts and appointments. Both are presentation modes inside the admin demo: all workspace fixtures remain in the browser bundle. Audience filtering is not authentication or authorization; the production boundary is recorded in `docs/admin-data-contract.md`.

Document samples are authored HTML sheets with a Georgia heading, signatures marked absent and a visible illustration disclaimer. They are neither uploaded contract files nor signed commitments. No private R2 viewer is implemented.

The prototype keeps edits in its in-memory demo repository and resets on reload. Lead identities are fabricated. File previews use local object URLs; the current selection accepts PNG, JPEG, WebP and PDF up to 10 MB. These client checks do not establish a production security boundary. Authentication, authorization, durable storage and production upload are absent; the architecture document owns the production decision path. This document records the operational prototype; deployment status is owned by deployment evidence rather than inferred from these presentation modes.

### Documentation and review evidence

The premium admin refinement is captured in 14 `.impeccable/review/mall-system-*` desktop/mobile screenshots. The browser observation log records company/lease page changes and save-note feedback using system Toast, with no document-width overflow at 1440px and 390px. Shared package build, Mall typecheck and static build passed. Fresh reviewer/documenter agents were unavailable due to usage limits, so their roles were completed inline; the bounded final review is `mall-system-finish-review.md`. No automated tests, deployment or production security certification are claimed. Architecture and migration scope: `docs/mall-admin-system.md`.

The earlier shared-component extraction preserved the then-current green/gold token primitives. The user-requested premium admin refinement now overrides route semantic tokens through `mall-system.css`; public brand values remain unchanged. The active-navigation component now references the existing 6px corner step and records its shared 10px × 12px padding. The sidecar records both the shared 850px menu/workspace breakpoint and local feature breakpoints. `AdminShell`, `AdminPageHeader`, `AdminPanel` and `WorkspaceLayout` own layout and focus behavior; Le Grande and Solar adapters own logos, theme mappings, routes, providers and sample business data. Shared Tabs retain in-session drafts; pressed-state ButtonGroup filters remain distinct from route navigation.

Historical extraction captures are `.impeccable/review/shared-{mall,solar}-{desktop,mobile}-{sidebar,header-brand,topnav,menu}.png`: 16 images covering the three presets plus desktop rail and mobile open menu. They provide current company/dossier and Solar workspace evidence, replacing the earlier unavailable-capture statement. The fixed mobile overlay occupies the captured viewport, even when the full-page image includes more content below it. `.impeccable/review/shared-admin-finish-review.md` records the initial findings. The final `.impeccable/review/shared-admin-verdict.md` scores both fixes—Solar header overflow and stale Le Grande documentation—as resolved, with disposition `ship`. All 16 recaptures were opened; document scroll width equals the 1440px desktop or 390px mobile viewport for every preset in both apps. This verdict covers those two scored fixes and does not certify the entire UI.

The implementation thread reports successful final typechecks and static production builds for the shared package and both consumers. Browser observations confirm Escape returns focus to the menu trigger in both apps and Solar mobile Back returns focus to the selected lead row. No automated tests were added or run, and no deployment is claimed. Source establishes Dialog composition, separate mobile/desktop states and heading-focus behavior; static images cannot certify interaction accessibility, contrast or every feature route. Production authentication, authorization and persistence remain outside this UI extraction.

## Do's and Don'ts

### Do:

- **Do** use admin tokens for the light workspace and brand tokens for the public identity.
- **Do** retain text labels for every status and visible keyboard focus.
- **Do** distinguish grouped space identity from immutable base slot identity.
- **Do** keep exactly six floor choices and identify repeated geometry as demo data.
- **Do** preserve the customer reference raster and its embedded provenance.

### Don't:

- **Don't** apply the admin palette or typography overrides to the public landing or other product adapters.
- **Don't** promote the repeated B-series fixture into confirmed floor inventory.
- **Don't** convert free text statuses into a closed vocabulary through color mapping.
- **Don't** treat session edits or browser file previews as production persistence or secure upload.

## Điều chỉnh preset theo phản hồi

Người dùng yêu cầu bỏ mode “Logo trên header”. API và selector hiện chỉ còn `sidebar` và `topnav`; các ảnh `header-brand` ở review trước là bằng chứng lịch sử, không còn là mode hiện hành.

### Active navigation refinement

Shared admin navigation reserves a 1px transparent border; selected items use a tinted brand border and a 3px side marker. Horizontal navigation moves that marker to the bottom. Marker, selected text and surface use app semantic tokens; keyboard focus remains separate. Padding is 9px × 11px plus the reserved border, preserving the previous item footprint.
