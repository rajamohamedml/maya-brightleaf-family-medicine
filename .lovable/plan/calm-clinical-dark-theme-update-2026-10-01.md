# Calm clinical dark-theme update

## Scope
- Replace the clinic address everywhere with `100 Brightleaf Way, Irving, TX 75039 (fictional)` and avoid duplicating the fictional label where it is displayed.
- Shorten the public hours labels to Mon–Thu, Fri, and Sat–Sun, then render labels and non-wrapping times in a two-column grid.
- Apply the requested deep-navy, teal, coral, slate, status, border, and gradient values through global semantic theme tokens so all current and future pages inherit them.
- Add the soft static teal glow behind the landing introduction, subtle shared tile gradients, brighter hover borders, and six distinct visit-type corner tints.
- Give the Before and After areas separate red- and teal-tinted treatments.
- Update shared headers, footers, cards, status badges, visit chips, buttons, form controls, loading skeletons, and toasts to use the same token-driven dark styling.

## Accessibility and validation
- Preserve 17px base text, keep supporting text at 14px or larger, maintain 44px minimum targets and visible teal focus rings.
- Limit visual transitions to 150–200ms and preserve reduced-motion handling.
- Check the finished home page at the current phone size and desktop size, and confirm the preview builds without errors.

## Technical details
- Keep behavior and data flow unchanged; changes are limited to shared styling, presentation markup, and static clinic facts.
- Use CSS variables registered with Tailwind semantic tokens; no raw colors in page components.
- Preserve the existing React/TanStack structure and avoid new dependencies.
