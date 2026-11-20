# My Work Planner – Development Handoff Pack

This package contains the consolidated product requirements and the Google AI Studio development kickoff prompt.

## Files

1. `My_Work_Planner_PRD_v1.2.md` – consolidated development PRD and product rules.
2. `Google_AI_Studio_Master_Development_Prompt.md` – detailed prompt to paste into Google AI Studio Build Mode.
3. `DESIGN.md` – canonical visual design system extracted from the supplied Stitch ZIP root `design.md`.
4. `Calm_Focused_Productivity_REFERENCE.md` – supplementary visual guidance extracted from the supplied export. The root `DESIGN.md` remains canonical.
5. `stitch_my_work_planner_pwa.zip` – the latest supplied Stitch screen export, included unchanged as a visual reference.

## Recommended setup sequence

1. Open Google AI Studio and enter Build Mode → Web App.
2. Connect a GitHub repository for version history before significant development.
3. Attach the PRD, `DESIGN.md` and Stitch reference ZIP.
4. Paste `Google_AI_Studio_Master_Development_Prompt.md`.
5. Ask AI Studio to execute Milestone 0 only.
6. Review the project shell and build results.
7. Configure Supabase credentials and proceed to Milestone 1.

## Important

- The Stitch ZIP contains UI exports and reference assets, not a complete production application.
- Do not treat generated Stitch `code.html` files as production code.
- The PWA, authentication, database, timer persistence and Calendar integration must be implemented and tested.
- Do not put Supabase secret/service-role keys or Google OAuth secrets in frontend code or GitHub.
- Free-tier limits and possible charges must be checked before deployment and before enabling email, push or Google API services.
