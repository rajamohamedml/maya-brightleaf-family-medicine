# Voice greeting and booking closing line

## Changes
- Add the requested Brightleaf greeting as the first visible Maya message when a voice session starts.
- Play it once per voice session using Maya’s existing browser voice, then activate listening only after playback ends.
- Allow a mic tap during the greeting to cancel playback and begin listening immediately.
- Replace automatic voice startup on `/chat?voice=1` with a large “Start talking to Maya” button.
- Add the small teal tagline beneath the clinic identity in the chat panel.
- Add the requested italic closing line beneath every successful booking card and speak it for voice bookings only.

## Guardrails
- Keep emergency and task flows unchanged and never add the booking closing line to them.
- Keep all typed and spoken requests on the existing Maya chat and booking path.
- Do not run automated browser tests; verify through the project’s existing checks only.
