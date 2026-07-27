# PrepIQ Design System — Web Dashboard

Authoritative UI reference for `web_dashboard`. Replaces `BRAND_SYSTEM.md`.

Sections 1–6 are the **shared core**, identical across `landing`, `web_dashboard`, and
`mobile-app`. Section 7 onward is **platform binding** — how the core is actually
expressed in this repo. When the two ever disagree, the platform binding wins, because
it describes running code.

---

## 1. Brand Intent

PrepIQ is operational intelligence infrastructure for kitchens. Pillars: **Intelligent,
Structured, Controlled, Premium**.

Every UI decision passes four filters, in order:

1. Does it increase clarity?
2. Does it reduce noise?
3. Does it signal authority?
4. Does it feel engineered?

A change that fails filter 1 or 2 is rejected regardless of how good it looks.

## 2. Color

The palette is fixed. Do not introduce new hues.

| Role | Token | Hex |
|---|---|---|
| Base background | `surface-1` | `#141416` |
| Card | `surface-2` | `#1C1C1F` |
| Elevated | `surface-3` | `#232327` |
| Hover / separator | `surface-4` | `#2A2A2E` |
| Border | `border-default` | `#2E2E33` |
| Brand gold | `brand-gold` | `#A8821F` |
| Gold hover | `brand-gold-hover` | `#B8962E` |
| Gold pressed | `brand-gold-pressed` | `#8F6F18` |
| Text primary | `text-primary` | `#F5F5F7` |
| Text secondary | `text-secondary` | `#C7C7CC` |
| Text muted | `text-muted` | `#8E8E93` |
| Text disabled | `text-disabled` | `#5A5A60` |
| Critical | `status-critical` | `#C44949` |
| Warning | `status-warning` | `#C48B2A` |
| Success | `status-success` | `#3F8F68` |
| Info | `status-info` | `#3A6EA5` |

**Gold is a scarce resource.** It marks the single most important actionable or
active thing in a view — the primary button, the active nav item, the measured
series in a chart. A screen with gold in four places has no emphasis at all.

**Status colors carry meaning, never decoration.** Red means a threshold is
breached. Do not use red for "delete" buttons that are routine.

## 3. Typography

- **Display** (headings, KPI numerals): geometric grotesk, weight 600
- **Body** (prose, data, forms, labels): Inter

| Level | Size / line-height / weight |
|---|---|
| H1 | 40 / 48 / 600 |
| H2 | 32 / 40 / 600 |
| H3 | 24 / 32 / 600 |
| H4 | 18 / 28 / 500 |
| Body Large | 16 / 24 / 400 |
| Body | 14 / 22 / 400 |
| Small | 12 / 18 / 400 |
| KPI | 32–48 / 600 / tracking `-0.5` |

Body copy never goes below 12px. KPI numerals always use the display face with
negative tracking — that tightening is what makes a number read as a figure rather
than as text.

## 4. Space, Radius, Depth

- Grid: **8pt**. Spacing scale: `4, 8, 12, 16, 24, 32, 40, 48, 64, 80`.
- Radius: button `8px`, card `12px`, modal `16px`. No other radii.
- Shadows: L1 `0 1px 2px rgba(0,0,0,.3)` · L2 `0 8px 24px rgba(0,0,0,.4)` ·
  L3 `0 4px 12px rgba(0,0,0,.35)`

Depth is for genuine layering (modal, dropdown, drawer) — not for making a flat
section look interesting.

## 5. Motion

- Duration `150–220ms`, easing `cubic-bezier(0.4, 0, 0.2, 1)`
- Allowed: fade in, slide up 8–12px, width expansion, soft pulse for critical only
- Forbidden: bounce, elastic, spring overshoot, playful easing

Motion confirms a state change. It never entertains. Honor
`prefers-reduced-motion` on every non-trivial animation.

## 6. Voice

Measured, strategic, precise. State facts:

> "Variance exceeds threshold." · "Stockout event detected." · "Production delta: +12% above forecast."

Never: "Oops!", "Awesome!", "Let's get cooking!". The user is a kitchen manager
under time pressure, not an audience.

---

## 7. Platform Binding — Next.js 16 + Tailwind v4

### Where tokens live

`app/globals.css` — **there is no `tailwind.config.ts`**. This repo uses Tailwind v4,
where the theme is declared in CSS via `@theme inline`. Raw hex values sit in `:root`;
the `@theme inline` block maps them to utility names.

To add a token: add the hex to `:root`, then map it inside `@theme inline`. Both, or
the utility class will not exist.

### Using tokens

Utilities are **semantic, not palette-shaped**:

```tsx
<div className="bg-surface-2 text-text-secondary border-border-default rounded-[--radius-card]">
```

- Surfaces: `bg-surface-1` … `bg-surface-4`
- Text: `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-disabled`
- Brand: `bg-brand-gold`, `text-brand-gold`, `hover:bg-brand-gold-hover`
- Status: `text-status-critical`, `bg-status-warning`, …

Never write a raw hex in a component. If a value you need has no token, that is a
signal to add a token, not to inline the hex.

### Fonts

`lib/fonts.ts` loads **Satoshi** as a variable font from
`public/fonts/satoshi/` and exposes it as `--font-satoshi-next` → `font-display`.

> **Known drift:** the `inter` export in `lib/fonts.ts` is a stub object with only a
> `variable` key — no font file is loaded. `--font-inter-next` in `globals.css`
> resolves to `system-ui`, so **body text on this dashboard currently renders as the
> OS UI font, not Inter.** Section 3 describes the intent. Fixing this means adding a
> real `next/font` loader for Inter; until then, do not "fix" spacing that looks off
> because of the substituted face.

Usage: `font-display` for headings and KPI numerals, `font-sans` (the default on
`body`) for everything else.

### Layout posture — spacing-led, not boxed

This is the rule most often broken in this repo. Dashboard pages are **open sections
with vertical rhythm**, not stacks of bordered cards.

Delimit in this order, escalating only when the previous step fails:

1. Spacing rhythm
2. A subtle separator (`border-border-default`)
3. A soft surface shift (`bg-surface-2`)
4. A boxed container — **only** when functionally required: modals, dropdowns,
   drag targets, critical grouped controls

Never nest a card inside a card. `components/ui/section-header.tsx` exists precisely
so a region can be titled without card chrome — use it.

### Theme mode

**Dark only.** There is no light palette and no theme provider. Do not add
`dark:` variants — they are dead weight here. (Contrast this with `mobile-app`,
which is genuinely dual-mode.)

### Motion

No `framer-motion` in this repo. Animations are CSS keyframes in `globals.css`,
exposed as utilities: `.animate-fade-in`, `.animate-step-forward`,
`.animate-step-backward`, `.assistant-drawer-panel`. Reuse these before writing a
new keyframe, and drive durations from `--motion-duration-standard`.

### Icons

`iconoir-react`, outlined, `strokeWidth 1.5`, sized in `em` so they track text.
Icon color inherits `currentColor` by default. Gold only for active state; red only
for genuine alerts.

### Charts

`recharts`, with all colors from
`components/dashboard/home/analytics/chart-theme.ts` — never inline. Actual series is
gold, forecast is a **dashed** gray baseline, plan is dotted. Series identity never
rides on hue alone; the dash pattern carries it for color-vision-deficient viewers.
Grid and axes stay recessive. No rainbow palettes.

For any *new* chart type, load the `dataviz` skill before writing chart code.

---

## 8. Contrast — Verified

Measured against `#1C1C1F` (card), which is the strictest common surface.
WCAG AA for normal text is 4.5:1; 3:1 for large text (≥18.66px bold / ≥24px) and
non-text UI.

| Foreground | On card | Verdict |
|---|---|---|
| `text-primary` | 15.6:1 | Pass |
| `text-secondary` | 10.1:1 | Pass |
| `text-muted` | 5.2:1 | Pass |
| `warning` | 5.7:1 | Pass |
| `brand-gold` | 4.8:1 | Pass |
| `success` | 4.3:1 | **Large text / UI only** |
| `critical` | 3.6:1 | **Large text / UI only** |
| `info` | 3.2:1 | **Large text / UI only** |
| `text-disabled` | 2.5:1 | Fails — disabled only (WCAG-exempt) |

**Binding rules that follow:**

- `critical`, `info`, and `success` must **not** be used as the color of 12–14px body
  text. Use them for icons, borders, badges (where the label is `text-primary` on a
  tinted background), large numerals, and left-border accents.
- The standard alert pattern is a **4px left border** in the status color with the
  message text in `text-primary` — this is why that pattern exists.
- `text-disabled` never carries information a user must read.
- Charcoal on gold (primary button) is 5.15:1 — passes.
- Borders sit at ~1.2:1 against their surface. They are intentionally decorative;
  they must never be the *only* signal for a boundary that carries meaning.

---

## 9. Skills

Installed at `.claude/skills/` in the monorepo root, shared by all three apps.

| Skill | Use it when |
|---|---|
| `design-tokens` | Adding/changing a color, font, spacing, or radius; or you caught yourself about to write a hex. Explains the token pipeline for whichever of the three stacks you're in. |
| `ui-polish` | A screen works but looks plain. Applies hierarchy, rhythm, and the missing empty/loading/error states. |
| `ui-review` | Before shipping any UI change. Audits the diff against this file and reports violations. |
| `ui-a11y` | Contrast, focus rings, hit targets, semantics, reduced motion. Run when adding interactive controls or a new color pairing. |

Built-in skills that also apply: **`dataviz`** before writing any new chart, and
**`run`** to boot the app and confirm a change visually.

Typical order for a UI task: `design-tokens` (if tokens involved) → build →
`ui-polish` → `ui-review` → `ui-a11y`.

---

## 10. QA Checklist

- [ ] No raw hex, rgb, or arbitrary color in components — tokens only
- [ ] Gold appears once, on the single most important element
- [ ] Status color is never the color of small body text (see §8)
- [ ] `font-display` on headings and KPIs; default sans elsewhere
- [ ] Spacing lands on the 8pt scale
- [ ] Radii are 8 / 12 / 16 only
- [ ] Section is spacing-led — no card nested in a card
- [ ] Motion is 150–220ms with the standard easing; reduced-motion honored
- [ ] Icons are Iconoir, outlined, 1.5 stroke, `currentColor`
- [ ] Chart colors come from `chart-theme.ts`; non-hue encoding present
- [ ] Interactive elements have a visible focus ring
- [ ] Copy is factual and operational
- [ ] No `dark:` variants added (this app is dark-only)
