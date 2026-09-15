---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.css"
  - "**/*.scss"
  - "**/*.html"
  - "**/*.vue"
  - "**/*.svelte"
---
> Web-specific design-quality guidance.

# Web Design Quality Standards

## Anti-Template Policy

Do not ship generic template-looking UI. Frontend output should look intentional, opinionated, and specific to the product.

### Banned Patterns

- Default card grids with uniform spacing and no hierarchy
- Stock hero section with centered headline, gradient blob, and generic CTA
- Unmodified library defaults passed off as finished design
- Flat layouts with no layering, depth, or motion
- Uniform radius, spacing, and shadows across every component
- Safe gray-on-white styling with one decorative accent color
- Dashboard-by-numbers layouts with sidebar + cards + charts and no point of view
- Default font stacks used without a deliberate reason

### Required Qualities

Every meaningful frontend surface should demonstrate at least four of these:

1. Clear hierarchy through scale contrast
2. Intentional rhythm in spacing, not uniform padding everywhere
3. Depth or layering through overlap, shadows, surfaces, or motion
4. Typography with character and a real pairing strategy
5. Color used semantically, not just decoratively
6. Hover, focus, and active states that feel designed
7. Grid-breaking editorial or bento composition where appropriate
8. Texture, grain, or atmosphere when it fits the visual direction
9. Motion that clarifies flow instead of distracting from it
10. Data visualization treated as part of the design system, not an afterthought

## Before Writing Frontend Code

1. Pick a specific style direction. Avoid vague defaults like "clean minimal".
2. Define a palette intentionally.
3. Choose typography deliberately.
4. Gather at least a small set of real references — see the Reference Shelf below.
5. Use ECC design/frontend skills where relevant.

## Reference Shelf

Source of record is the brain page `design-craft-resources`; this is the working subset.

**Look before designing** — steal decisions, not layouts.

- [refero.design](https://refero.design) — references pulled from real shipped products. How others solved this exact page.
- [land-book.com](https://land-book.com) — filters down to a single component. Study one pricing block twenty ways.
- [mobbin.com](https://mobbin.com) — real app flows, screen by screen. Teaches hierarchy through sequence, not one frame.
- [siteinspire.com](https://siteinspire.com) — a fifteen-year archive. Shows how type and grid systems moved over time.
- [godly.website](https://godly.website) — hand-picked direction. Stop browsing once you have one.
- [awwwards.com](https://awwwards.com) — the ceiling, not the template. Skip it for a working product page.

**Craft writing** — interaction detail at the component level.

- [devouringdetails.com](https://devouringdetails.com) — Rauno, Vercel. 23 chapters with downloadable working React components.
- [emilkowal.ski](https://emilkowal.ski) — Emil Kowalski, Linear. Animation and UI taste; author of Sonner and Vaul.
- [interfacecraft.dev](https://interfacecraft.dev) — Josh Puckett. Paid; 40+ deep dives on interface craft.

**Motion and components** — pick one lane, not three.

- [motion.dev](https://motion.dev) — the library behind considered hover, drag, and layout transitions. Motion is a budget, not a free upgrade.
- [skiper-ui.com](https://skiper-ui.com) — animated shadcn/ui components. Two unrelated sources named it independently, which is the strongest signal on the shelf.
- [cult-ui.com](https://cult-ui.com) — animated shadcn/ui components, plus premium template add-ons.
- **Animaster Lib** — 250+ motion primitives: scroll, hover, effects. Reach for breadth of primitives, not whole sections. URL unresolved.
- **ThreeUI** — 3D and WebGL. The only entry that changes the performance budget, not just the look. Signature moments only, never a default. URL unresolved.
- [reactbits.dev](https://reactbits.dev) — use for one signature motion moment. Skip once 3+ elements already animate.

**Tools**

- [fontjoy.com](https://fontjoy.com) — font-pairing generator. Breaks the Inter-for-everything reflex.
- [colorhunt.co](https://colorhunt.co) — starting palettes when there is no brand. Check contrast yourself; curation is aesthetic, not accessible.
- [haikei.app](https://haikei.app) — SVG backgrounds and organic shapes. Skip if the page already has a signature visual.

## Motion Vocabulary

Names for the moves, and the discipline over them. Source of record is the brain page `web-animation-patterns`. `/impeccable animate` owns the motion thesis, the timing table, and the implementation; this is the vocabulary it does not carry.

Four triggers, each doing one job:

| Trigger | Job | Moves |
|---|---|---|
| Scroll | Storytelling | Parallax · Scrub · Pin + Transform |
| Reveal | Hierarchy | Fade + Lift · Stagger · Clip Reveal |
| Hover | Feedback | Magnetic CTA · Image Zoom · Text Shift |
| Click | Confirmation | Press + Spring · State Change |

Good animation is not decoration. It is Feedback. A move that reports nothing back to the user must justify itself as decoration rather than pass as craft.

**Three of these can never be the focal moment.** Fade + Lift, Parallax, and a plain scroll reveal are supporting moves only. Reaching for one as the authored moment is the exact failure `/impeccable animate` calls "not a thesis".

**Motion is a budget.** Eleven moves is a menu, not a checklist. Each animated element spends the attention the previous one bought.

Constraints that are easy to miss:

- Stagger order *is* a hierarchy claim. A stagger that fights the visual hierarchy is worse than no stagger.
- Image Zoom moves the image, not the layout. A hover that reflows the page is a bug in a costume.
- Magnetic CTA is spatial movement. It needs a `prefers-reduced-motion` path that drops the cursor-follow and keeps the affordance.
- State Change (`Send → Sending → Sent ✓`) is the only move here that can report failure. Do not downgrade it to a spinner.

## Worthwhile Style Directions

- Editorial / magazine
- Neo-brutalism
- Glassmorphism with real depth
- Dark luxury or light luxury with disciplined contrast
- Bento layouts
- Scrollytelling
- 3D integration
- Swiss / International
- Retro-futurism

Do not default to dark mode automatically. Choose the visual direction the product actually wants.

## Component Checklist

- [ ] Does it avoid looking like a default Tailwind or shadcn template?
- [ ] Does it have intentional hover/focus/active states?
- [ ] Does it use hierarchy rather than uniform emphasis?
- [ ] Would this look believable in a real product screenshot?
- [ ] If it supports both themes, do both light and dark feel intentional?
