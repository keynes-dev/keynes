Astro owns the document shell and routing. Keep routes under `src/pages/` and
implement page sections as React TSX under `src/components/pages/<route>/`.

Use the app-local shadcn components under `src/components/ui/`. Prefer the
shared `Section` and Card primitives over new page-specific wrappers. Keep the
full-bleed section border and the stepped Tailwind container layout.

Marketing charts use TanStack Charts through the shared chart helpers. Import
only the required chart and D3 modules. Keep the Budget and Policy figures
independent of the chart library. Do not reintroduce Recharts or ASCII chart
rendering.

Keep the `@/*` TypeScript and Vite aliases aligned. Hydrate interactive islands
with `client:load`; `client:visible` does not run when its wrapper has zero
layout size. Preserve the TypeScript source reload plugin in `astro.config.mjs`.

Run the web typecheck, tests, production build, and desktop and mobile browser
checks for website changes. Use a repository-supported Node.js version.
