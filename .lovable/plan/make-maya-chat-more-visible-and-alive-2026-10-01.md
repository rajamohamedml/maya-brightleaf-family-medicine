# Make Maya chat more visible and alive

## Scope
Design-only update using the existing React components and CSS. No chat, booking, emergency, persistence, or voice behavior will change, and no packages will be added.

## Implementation
- Add one reusable animated chat-frame treatment around every Maya chat panel.
  - Idle: static teal edge.
  - Thinking/typing: six-second rotating teal/cyan edge.
  - Listening: three-second rotation with a stronger glow.
  - Speaking: gentle two-second glow pulse.
  - Ended: static slate edge.
  - Reduced motion: static teal edge and glow only.
- Expose the existing voice display state to the parent chat solely for styling and header text; leave all voice behavior unchanged.
- Update the chat header to show “Maya - online” with a green status dot and, during voice mode, “Listening...”, “Thinking...”, or “Speaking...”.
- Add a reusable public-page launcher in the shared public shell:
  - Exclude `/chat` and all `/clinic` pages.
  - Desktop: 56px-high teal gradient pill with chat icon and “Chat with Maya”.
  - Mobile: 56px round icon button with an accessible label.
  - Position above footer content and safe-area insets, with a subtle four-second ring pulse.
  - Open the existing Maya chat in a right-side sheet on desktop and a full-screen sheet on mobile.
  - Reuse the same animated chat frame inside the sheet.
  - Show an unread dot when a Maya reply arrives while the sheet is closed; clear it when opened.
- Keep focus rings, 44px minimum targets, readable contrast, and transform/opacity-only animation.

## Verification
- Check the project build diagnostics after edits.
- Inspect the relevant code paths and CSS states without running automated browser tests, per request.
