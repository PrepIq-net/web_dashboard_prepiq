# PrepIQ Brand System v1.0

This file is the implementation checkpoint for design and UI decisions.

## Brand Intent
- Product type: operational intelligence infrastructure for kitchens
- Pillars: Intelligent, Structured, Controlled, Premium
- Decision filter:
  - Increase clarity
  - Reduce noise
  - Signal authority
  - Feel engineered

## Logo Rules
- Primary mark: abstract geometric `P`
- Style: flat, structural, precise, no playful forms
- Allowed treatments:
  - Gold on charcoal
  - Soft white on charcoal
- Disallowed treatments:
  - Gradients
  - Metallic shine
  - Glow
  - Shadow
  - 3D effects
- Clear space: minimum equals width of the `P` stem

## Color Tokens
- Background and surfaces:
  - `#141416` base
  - `#1C1C1F` card
  - `#232327` elevated
  - `#2A2A2E` hover
- Brand gold:
  - `#A8821F` default
  - `#B8962E` hover
  - `#8F6F18` pressed
- Text:
  - `#F5F5F7` primary
  - `#C7C7CC` secondary
  - `#8E8E93` muted
  - `#5A5A60` disabled
- Status:
  - Critical `#C44949`
  - Warning `#C48B2A`
  - Success `#3F8F68`
  - Info `#3A6EA5`

## Typography Rules
- Display/UI headline font: Satoshi
- Body/data/form font: Inter
- Icon set: Iconoir (1.5px stroke, monochrome default)
- Type scale:
  - H1 `40/48 600`
  - H2 `32/40 600`
  - H3 `24/32 600`
  - H4 `18/28 500`
  - Body Large `16/24`
  - Body `14/22`
  - Small `12/18`
  - KPI `32-48`, `600`, tracking `-0.5`

## Icon System (iconoir-react)
- Package: `iconoir-react`
- Use React icon components directly:
  - `import { IconName } from "iconoir-react"`
- Global defaults are controlled through `IconoirProvider` in `app/providers.tsx`:
  - `color: currentColor`
  - `strokeWidth: 1.5`
  - `width: 1.1em`
  - `height: 1.1em`
- Color behavior:
  - Default icon color follows text color (`currentColor`)
  - Use gold only for active/meaningful states
  - Use status red only for critical alerts
- Keep icons outlined and minimal (no filled colorful treatments by default)

## Layout and Spacing
- Grid: 8pt
- Spacing scale: `4, 8, 12, 16, 24, 32, 40, 48, 64, 80`
- Max dashboard width: `1440px`
- Horizontal container padding: `32px`
- Layout posture: breathing, spacing-led composition by default.
- Delimitation priority:
  - 1) spacing rhythm
  - 2) subtle separators (`#2A2A2E`)
  - 3) soft surface shifts
  - 4) boxed containers only when functionally required (modals, dropdowns, critical grouped controls)
- Avoid stacked "card-in-card" layouts for dashboard pages.
- Prefer open sections with clean vertical flow over repeated bordered boxes.

## Radius and Depth
- Button radius: `8px`
- Card radius: `12px`
- Modal radius: `16px`
- Shadows:
  - L1 `0 1px 2px rgba(0,0,0,0.3)`
  - L2 `0 8px 24px rgba(0,0,0,0.4)`
  - L3 `0 4px 12px rgba(0,0,0,0.35)`

## Motion Rules
- Duration range: `150-220ms`
- Easing: `cubic-bezier(0.4, 0.0, 0.2, 1)`
- Allowed:
  - Fade in
  - Slide up `8-12px`
  - Smooth width expansion
  - Soft KPI pulse for critical states only
- Disallowed:
  - Bounce
  - Elastic motion
  - Playful easing

## Component Guidance
- Primary button: gold background, charcoal text
- Secondary button: transparent, `1px` border `#2E2E33`, white text
- Danger button: muted red background
- Dashboard blocks:
  - Default should be unboxed sections.
  - KPI/insight/comparison regions should breathe using margin, line-height, and separators.
  - Do not wrap every region in rounded bordered cards.
- Notifications:
  - Critical left border red `4px`
  - Warning left border gold
  - Info left border muted blue
  - Entry motion from right without bounce

## Data Viz Guidance
- Primary metric: gold
- Baseline: gray
- Negative variance: red
- Avoid rainbow palettes
- Keep axes and grid lines muted and minimal

## Voice and Messaging
- Tone: measured, strategic, composed, precise
- Avoid hype phrases
- Prefer factual statements like:
  - "Variance exceeds threshold."
  - "Stockout event detected."
  - "Production delta: +12% above forecast."

## Implementation Map (Current Codebase)
- CSS tokens and theme mapping: `app/globals.css`
- App fonts and root setup: `app/layout.tsx`
- Font loaders (Inter + Satoshi local): `lib/fonts.ts`
- Typed brand constants for app logic: `lib/brand-tokens.ts`

## Tailwind Font Usage
- Body/default text: `font-sans` (Inter)
- Titles/headlines: `font-display` (Satoshi)
- Example:
  - `<h1 className="font-display text-3xl md:text-5xl">...</h1>`

## QA Checklist
- [ ] UI uses only approved color tokens
- [ ] Gold appears only for meaningful active/highlight states
- [ ] Typography uses Satoshi for display and Inter for body
- [ ] Spacing matches 8pt scale
- [ ] Radii are within 8/12/16 system
- [ ] Motion duration and easing match system
- [ ] Icons are Iconoir style and not filled/colorful by default
- [ ] Copy tone is factual and operational, not promotional
- [ ] Dashboard surfaces are spacing-led (not box-stacked) unless functionally required
