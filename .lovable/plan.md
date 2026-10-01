# Wide staff schedule layout

## Changes
- Replace the staff left sidebar and mobile bottom tabs with one horizontal navigation row beneath the clinic header.
- Keep Today, Schedule, Inbox, Activity, and Sign out in that row, with the current page clearly marked and the Inbox count preserved.
- Let every staff page use the full available width, with the Schedule calendar occupying the widest possible workspace.
- Combine the Schedule title, week controls, Block time, and Add visit into a compact toolbar above the calendar.
- Keep Block time and Add visit forms expandable above the calendar so they do not permanently reduce its width.

## Responsive behavior
- On narrow screens, allow the navigation row and calendar to scroll horizontally without clipping controls.
- Keep all controls at least 44px tall, preserve keyboard focus states, and test at phone and desktop widths.

## Technical details
- Preserve all existing scheduling, authentication, counts, forms, and visit-detail behavior.
- Update the staff layout architecture note to reflect the horizontal navigation.
- Validate the preview and current error logs after implementation.
