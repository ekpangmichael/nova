# Styling and Design System

Nova's frontend uses **Tailwind CSS 4** with a custom design token system defined entirely in `globals.css`. The visual language is inspired by terminal aesthetics with sharp corners, monospace labels, and subtle glow effects.

## Design Tokens

All color tokens are declared in a `@theme` block and referenced as standard Tailwind classes (e.g., `bg-surface`, `text-tertiary`).

### Surface Tier (Backgrounds)

| Token | Dark Value | Light Value | Usage |
|---|---|---|---|
| `surface` | `#0e0e0f` | `#f5f3f0` | Page background |
| `surface-dim` | `#0e0e0f` | `#edebe8` | Dimmed background |
| `surface-bright` | `#2b2c2f` | `#ffffff` | Elevated surfaces |
| `surface-container-lowest` | `#000000` | `#ffffff` | Deepest container |
| `surface-container-low` | `#131315` | `#ffffff` | Sidebar, card backgrounds |
| `surface-container` | `#19191b` | `#faf9f8` | Default container |
| `surface-container-high` | `#1f1f22` | `#f0efed` | Elevated container |
| `surface-container-highest` | `#252628` | `#e8e6e4` | Topmost container |
| `surface-variant` | `#252628` | `#f0efed` | Variant surface |

### Text Colors

| Token | Dark Value | Light Value | Usage |
|---|---|---|---|
| `on-surface` | `#e7e5e8` | `#000000` | Primary text |
| `on-surface-variant` | `#acaaae` | `#000000` | Secondary/muted text |

### Semantic Colors

| Role | Token | Dark Value | Light Value |
|---|---|---|---|
| Primary (neutral) | `primary` | `#c5c7c8` | `#2d2b28` |
| Secondary (blue) | `secondary` | `#7b99ff` | `#1a56db` |
| Tertiary (green) | `tertiary` | `#d1ffd7` | `#0d9443` |
| Error (red) | `error` | `#ee7d77` | `#e02424` |

### Border Radius

The design uses a sharp/technical scale:

| Token | Value |
|---|---|
| `radius-xs` | `0.0625rem` (1px) |
| `radius-sm` | `0.125rem` (2px) |
| `radius-md` | `0.1875rem` (3px) |
| `radius-lg` | `0.25rem` (4px) |
| `radius-xl` | `0.5rem` (8px) |
| `radius-2xl` / `3xl` / `4xl` | `0.75rem` (12px) |

## Dark / Light Mode

Theme switching is managed by `ThemeProvider`, a client component that toggles classes on the `<html>` element:

- **Dark mode**: `html.dark` (default). Uses the base `@theme` tokens.
- **Light mode**: `html.light`. Overrides tokens with warm, cream-based values.

Light mode includes additional overrides:
- **Text opacity boost**: In dark mode, Tailwind opacity modifiers like `/40` and `/30` work well. In light mode, these same opacities are too faint against cream backgrounds, so `globals.css` includes `@layer utilities` overrides that raise the minimum opacity for common text token/opacity combinations.
- **Ghost border adjustment**: Light mode sets `--ghost-opacity: 35%` (vs. the default `12%`) and adds subtle `box-shadow` to ghost-bordered elements.
- **Nav active style**: In dark mode, active nav items use a left blue border. In light mode, active items use a filled blue background with white text.

## Custom Utilities

Defined with `@utility` in `globals.css`:

### `ghost`

Renders a near-invisible border using `color-mix()` with the `outline-variant` token. Used on cards, panels, and containers to create subtle definition without heavy borders.

Variants: `ghost-b` (bottom), `ghost-r` (right), `ghost-t` (top), `ghost-l` (left).

### `scrollbar-thin`

Applies a minimal 3px-wide custom scrollbar with transparent track and subtle thumb color. Used on scrollable areas (board columns, activity feeds, log panels).

### `dot-grid`

Renders a decorative dot grid background pattern using `radial-gradient` with 24px spacing. Used on empty state areas.

### Glow Utilities

- `glow-green` -- Green box-shadow for active/working elements.
- `glow-blue` -- Blue box-shadow for selected/secondary elements.
- `glow-red` -- Red box-shadow for error elements.

## Fonts

Loaded via `next/font/google` in the root layout:

| Font | CSS Variable | Tailwind Class | Usage |
|---|---|---|---|
| Inter | `--font-inter` | `font-headline`, `font-body` | All UI text |
| JetBrains Mono | `--font-jetbrains-mono` | `font-mono` | Labels, timestamps, counts, status tags, code |

## Icons

Nova uses **Material Symbols Outlined** loaded as a variable font from Google Fonts.

Configuration via `font-variation-settings`:
- Default: `FILL 0, wght 350, GRAD 0, opsz 22`
- Filled variant (`.material-filled`): `FILL 1, wght 400`

Icons are rendered via the `Icon` component (`components/ui/icon.tsx`) which accepts a `name` (Material Symbol name), `size`, and `className`.

## Animations

### Entrance Animations

Staggered fade-up animations for page sections:

| Class | Delay |
|---|---|
| `anim-1` | 50ms |
| `anim-2` | 120ms |
| `anim-3` | 200ms |
| `anim-4` | 280ms |
| `anim-5` | 360ms |
| `anim-6` | 440ms |

### Status Animations

- `pulse-green` / `pulse-blue` -- Pulsing box-shadow animations for status indicators.
- `shimmer` -- Horizontal shimmer effect for progress bars.
- `blink-cursor` (`.log-cursor`) -- Terminal-style blinking block cursor for log feeds.
- `scan-line` (`.card-scan`) -- Vertical scan line that sweeps over agent cards.

### FAB Transitions

Floating action buttons (`.fab-btn`) scale up to 106% on hover with a blue glow shadow, and scale down to 96% on click.
