---
name: "Le Grande Centre"
description: "Existing green and gold identity with a light operational workspace"
colors:
  brand-ink: "#002116"
  brand-gold: "#d4af37"
  brand-gold-light: "#e8c84a"
  brand-paper: "#f4f0e4"
  brand-muted: "#b8c2ba"
  admin-primary: "#174b35"
  admin-selection: "#ad842c"
  admin-canvas: "#faf8f0"
  admin-surface: "#ffffff"
  admin-ink: "#1d2b23"
  admin-muted: "#637168"
  admin-line: "#dfe6e1"
  admin-nav-active: "#eaf1ec"
  admin-floor-active: "#edf4ef"
  admin-field-border: "#cfd9d1"
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
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.025em"
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
  admin-control: "4px"
  admin-panel: "5px"
  admin-project: "6px"
  brand-control: "0"
spacing:
  compact-gap: "6px"
  control-gap: "8px"
  panel-gap: "12px"
  inspector: "14px"
  sidebar-inline: "16px"
  content-inline: "32px"
components:
  admin-button-primary:
    backgroundColor: "{colors.admin-primary}"
    textColor: "{colors.admin-surface}"
    rounded: "{rounded.admin-control}"
    padding: "0 13px"
    typography: "{typography.admin-control}"
  admin-button-secondary:
    backgroundColor: "{colors.admin-surface}"
    rounded: "{rounded.admin-control}"
    padding: "0 13px"
    typography: "{typography.admin-control}"
  admin-field:
    backgroundColor: "{colors.admin-surface}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.admin-control}"
    padding: "7px 9px"
  admin-nav-active:
    backgroundColor: "{colors.admin-nav-active}"
    textColor: "{colors.admin-primary}"
    rounded: "{rounded.admin-panel}"
    padding: "0 10px"
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

The existing public identity uses deep green, gold and editorial serif display type. The admin extends that identity into a light leasing desk: a white sidebar, cream working canvas, white panels and green actions. Gold marks selection and keyboard focus. These admin colors are route adaptations, not replacements for the shopping-mall brand tokens.

The working interface is compact and data oriented. Geometry, slot membership and readable text states carry the hierarchy; bordered panels connect the floor plan, register and inspector. Leads and media reuse the same navigation, filtering and inspector structure.

**Key Characteristics:**

- White admin sidebar and cream canvas; dark public identity remains a separate scope.
- System sans for operations, serif display for the public holding page.
- Text labels accompany status colors; slot records survive grouping.
- Contained plan scrolling and stacked panels on small screens.

This is a scan of the implemented system, not a new identity proposal. Sources: `src/app/globals.css`, `packages/ui/styles/themes/shopping-mall.css`, `packages/ui/styles/reset.css`, `src/app/admin-preview/admin-preview.css`, `admin-workspace.tsx` and `space-model.ts`. The surface brief stays in `.impeccable/surfaces/src-app-admin-preview-page-tsx.md`.

## Colors

The palette combines a dark green public identity with a warm light operational adaptation. Frontmatter values are normative; scope is part of each token's meaning. Sidecar tonal ramps are synthesized preview metadata, not production color scales.

### Primary

- **Brand Ink / Brand Gold:** shared shopping-mall identity and dark public holding page. Gold is the shared dark-theme action color.
- **Admin Primary:** local green action, active navigation and area emphasis (`--green` in the admin frame).

### Secondary

- **Admin Selection:** local gold outline and keyboard focus (`--gold`); separate from the brighter brand gold.

### Neutral

- **Brand Paper / Brand Muted:** dark public typography.
- **Admin Canvas:** inherited light shopping-mall canvas. The frame carries `data-ui-root`, `data-ui-theme="shopping-mall"` and `data-ui-scheme="light"`; the shared reset supplies its background.
- **Admin Surface / Ink / Muted / Line:** white panels and sidebar, operational text and panel dividers. The body fallback background is a separate route declaration, not the cream frame canvas.
- **Admin Nav Active / Floor Active / Field Border:** quieter selection surfaces and input boundaries.
- **Slot Available / Leased / Other / Selected:** spatial state fills. Every fill has a text label; the gold selection outline indicates interaction rather than inventory status.

**The Scope Rule.** Keep public brand colors and route-specific admin colors distinct; the admin sidebar is white.

## Typography

**Public display:** Playfair Display with Georgia and serif fallback. **Public body:** Be Vietnam Pro, Aptos, system UI and sans fallback. These are declared stacks; this document does not assert that external fonts are downloaded.

**Admin body and controls:** system UI sans. This extends the incumbent operations interface. The brand monogram alone uses Georgia. Numerals are tabular throughout the admin frame.

### Hierarchy

- **Public display:** the fluid heading in the holding page; the frontmatter records its observed clamp.
- **Admin headline:** page title; reduces to 21px at the small breakpoint.
- **Admin title:** inspector heading. Floor headings use 17px; register headings use 14px.
- **Admin body:** workspace base; dense records use 12px.
- **Admin control / label / meta:** buttons, field labels and supporting data. Plan status is 10px with 1.35 line height and wrapping. Small source geometry labels reach 9px; they are not a recommended general reading size.
- **Mobile fields:** 16px at the stacked breakpoint, with 44px minimum height.

## Layout

The desktop workspace uses a sticky 224px sidebar and 56px topbar. Content is capped at 1500px, with 26px top and 32px inline padding. The main plan or records column sits beside a 300px inspector across a 12px gap. Six floor choices occupy six equal columns.

At 1100px and below, the sidebar becomes 200px, inspector 270px and inline padding 20px. At 800px and below, the sidebar becomes a top navigation region with three equal navigation columns, the topbar is 48px, floor choices become three columns and inspectors follow their main panels. The later overrides are authoritative over the earlier inspector-first rules. Mobile buttons and fields have a 44px minimum height. At 520px and below, content uses 18px by 12px padding, filters wrap to full width and media uses two columns.

The diagram retains a minimum 680px width and 310px height inside a labelled, keyboard-focusable horizontal scroll region. Tables scroll within their panels. Long statuses and media names wrap; supporting lead text truncates within its row.

## Elevation & Depth

Admin panels are flat, with white fills, thin borders and quiet selected surfaces. The topbar uses a translucent white fill. There are no admin panel shadows. The shared shopping-mall theme separately defines overlay shadows: dark theme `0 20px 60px #0006`, light theme `0 4px 30px rgb(0 33 22 / 0.16)`; these are library capabilities, not shadows applied to this workspace.

## Shapes

Controls have small corners, panels a slightly softer radius, and selection chips a tighter radius. Sidebar project card corners are a separate observed step. Shared branded controls retain square corners; the admin adaptation does not change their theme token. Avatars are circular. Slot rectangles preserve the central core boundary and selected slots receive an inset outline (3px); grouped footprints have a 2px border.

## Components

### Buttons

Compact, direct actions. Primary buttons use Admin Primary with white text; secondary buttons use white with a divider-colored border. Desktop minimum height is 38px. Hover applies `brightness(.96)` and disabled buttons use `.48` opacity. Keyboard focus uses an offset gold outline (3px, 2px offset).

Buttons and plan slots animate background and border color for 160ms with `ease-out` only under `prefers-reduced-motion: no-preference`. Reduced motion disables those transitions. No page entrance effect is implemented.

### Fields

White fields with a thin Field Border, compact padding and visible labels. Status inputs accept free text with suggested values, not fixed enums. Required and length limits come from the form contract. Media errors use a textual alert. Search controls carry accessible labels even when their visible form is a placeholder.

### Navigation and floor choices

Three admin views share the same navigation. Active navigation uses a light green surface and heavier text. Floor controls carry pressed state and six fixed floor labels; this interface has no add or remove floor action. Floor purposes are fixture labels, not confirmed tenant allocation.

### Panels, chips and registers

White bordered plan, record and inspector containers share the same small panel corner. Toolbars and registers use divider lines. Selection chips list original slot codes and give removal controls accessible names. The original-slot register remains available after grouping; a selected row uses a quiet warm fill.

### Floor plan and grouped spaces

The signature is the plan connected to its inspector and base-slot register. Selection previews summed area and membership. Merging requires adjacent vacant, tenant-free slots on one floor and one side of the central core; it cannot cross the lobby or void. Groups retain their own identity and reference unchanged original slot IDs and areas. Splitting restores the original membership view.

**The Identity Rule.** Grouped space identity never replaces base slot identity.

The customer B-series reference has eleven slots, with endpoint areas of 205 m² and other areas of 164 m²; the lobby divides B.5 and B.6. Its floor is unknown. The repeated plan on all six floors is a labelled fixture, not a technical drawing or confirmed inventory. `public/admin-demo/floor-plan.png` is the customer-supplied raster with embedded provenance, not generated imagery.

### Leads and media

Leads use selectable rows plus a detail inspector; statuses and consultation notes are editable. Media uses selectable thumbnail tiles plus an inspector for project, floor or grouped-space associations. Image previews use contain sizing, and documents retain an authored file icon. Authored line icons use inline SVG, not glyph characters.

The prototype keeps edits in component state and resets on reload. Lead identities are fabricated. File previews use local object URLs; the current selection accepts PNG, JPEG, WebP and PDF up to 10 MB. These client checks do not establish a production security boundary. Authentication, authorization, durable storage and production upload are absent; the architecture document owns the production decision path. The current public static export excludes this demo route and its reference raster. This document records the local operational prototype, not a published admin service.

## Do's and Don'ts

### Do:

- **Do** use admin tokens for the light workspace and brand tokens for the public identity.
- **Do** retain text labels for every status and visible keyboard focus.
- **Do** distinguish grouped space identity from immutable base slot identity.
- **Do** keep exactly six floor choices and identify repeated geometry as demo data.
- **Do** preserve the customer reference raster and its embedded provenance.

### Don't:

- **Don't** infer a dark admin sidebar from the dark brand theme.
- **Don't** promote the repeated B-series fixture into confirmed floor inventory.
- **Don't** convert free text statuses into a closed vocabulary through color mapping.
- **Don't** treat session edits or browser file previews as production persistence or secure upload.
