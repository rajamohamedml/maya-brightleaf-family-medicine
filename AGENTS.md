<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules
- Demo data is rebuilt by the SQL function `public.seed_demo()` (service role only) — one idempotent reset point for demos.
- Public clinic facts for the landing page live in `src/lib/clinic-info.ts` — anon users have no table access.
- Shared UI lives in `src/components/maya/`; the app uses a token-driven dark clinical theme in `src/styles.css` (cta = coral, primary = teal) so every page inherits one accessible visual system.
- `/clinic` is a layout route (`clinic.tsx`) with desktop left nav and mobile bottom tabs.
