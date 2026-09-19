<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->

---
name: QuoteDrive
description: Dark, technical proposal-workflow dashboard for a governed B2B consultancy SaaS
---

# Design System: QuoteDrive

## 1. Overview

**Creative North Star: "The Command Deck"**

QuoteDrive's UI should feel like the confident, technical control surface of a governed workflow — closer to Linear, Vercel's dashboard, or Raycast than to a generic SaaS marketing template. A restrained dark-navy surface carries the weight of the product; a single lime accent marks what's actionable or active, and its rarity is what makes it read as energetic rather than decorative. Energy comes from contrast and precision, not from color coverage or ornament — this is a tool for people making governed commercial decisions, not a consumer app.

This system explicitly rejects the cream/sand SaaS-template look, gradient text, hero-metric cards, identical icon-grid cards, and tiny uppercase tracked eyebrows — the generic AI-generated-dashboard tells. It also rejects anything that reads as a toy or prototype rather than a credible enterprise tool: no gratuitous glassmorphism, no bouncy/elastic motion.

**Key Characteristics:**
- Dark navy-tinted neutrals as the dominant surface; lime reserved for a single sparing accent role
- High contrast, crisp edges, confident typographic hierarchy — Linear/Vercel/Raycast register
- Motion is purposeful feedback (hover, focus, loading), never orchestrated choreography
- Role and tenant context (organization, user role) always legible, never buried

## 2. Colors

Restrained strategy: navy-tinted dark neutrals carry the surface; lime is the one accent, used sparingly (≤~10% of any given screen) for what's actionable — primary buttons, active nav state, focus rings, key highlights.

### Primary
- **Lime accent** [to be resolved during implementation]: the single actionable-state color — primary actions, active navigation item, focus indicators. Never used decoratively or for large fills.

### Neutral
- **Navy surface scale** (deep-to-mid navy, dark mode only) [to be resolved during implementation]: body background, card/panel surfaces, borders/dividers, at multiple tonal steps for depth without shadows.
- **Text on navy** [to be resolved during implementation]: high-contrast near-white for body text, a dimmer navy-tinted gray for secondary/muted text — verified against WCAG AA on the darkest surface step actually used.

### Named Rules
**The One Accent Rule.** Lime marks exactly one thing on any given screen: the primary action or the active state. If two elements compete for lime, one of them is wrong.

## 3. Typography

**Display/Body Font:** single sans-serif family, technical/geometric character, multiple weights [specific family to be chosen at implementation]

**Character:** confident and precise, not playful — a typeface that reads as a serious tool, not a marketing site.

### Hierarchy
- **Display** [weight/size to be resolved]: page-level titles only (e.g. "Dashboard").
- **Headline** [weight/size to be resolved]: section headers within a page.
- **Title** [weight/size to be resolved]: card/panel headers, nav item labels.
- **Body** [weight/size to be resolved]: primary content text, 65–75ch max line length where prose appears.
- **Label** [weight/size to be resolved]: form labels, status text, metadata — never color alone to convey state.

## 4. Elevation

Flat by default, consistent with Responsive (not Choreographed) motion energy and the "Command Deck" philosophy — depth comes from navy tonal layering (surface steps), not drop shadows. A shadow, if used at all, appears only as a direct response to interaction state (e.g. a modal over its backdrop), never as ambient decoration on static cards.

## 5. Components

No components exist yet — QuoteDrive's frontend is pre-implementation beyond a placeholder page. Re-run `/impeccable document` (scan mode) once the dashboard shell (QD-103) is built to capture the real button, nav, card, and input patterns.

## 6. Do's and Don'ts

### Do:
- **Do** keep the navy surface dominant and treat lime as scarce — the One Accent Rule.
- **Do** make organization/role context always visible, never require a click to discover it.
- **Do** use semantic status text alongside any color-coded state (never color alone).
- **Do** keep motion purposeful: hover/focus/loading feedback, no scroll-driven or orchestrated entrance sequences.

### Don't:
- **Don't** use the cream/sand SaaS-template look, gradient text, hero-metric cards, identical icon-grid cards, or tiny uppercase tracked eyebrows.
- **Don't** use side-stripe borders (`border-left`/`border-right` as a colored accent).
- **Don't** use glassmorphism decoratively or bouncy/elastic easing.
- **Don't** let a synthetic/illustrative number look like a binding commercial commitment — per PRODUCT.md, every estimate carries "Illustrative planning estimate only."
