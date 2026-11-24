# Website

The website at [opendock.pages.dev](https://opendock.pages.dev) is a static [Astro](https://astro.build) site in `apps/web`, hosted on Cloudflare Pages. It has no server code, cookies, analytics or third-party scripts.

## Structure

```
apps/web/
├── public/              # Static files copied as-is: images, favicon, _headers, llms.txt, robots.txt
├── src/
│   ├── components/      # Shared Astro components (header, footer, cards, product mockups)
│   ├── data/            # Content as typed data: navigation, widgets, releases, roadmap
│   ├── layouts/         # Base page layout with SEO, Open Graph and structured data
│   ├── pages/           # One file per route
│   └── styles/          # Global CSS and design tokens
├── astro.config.mjs
└── lighthouserc.cjs     # Lighthouse CI budgets
```

Pages read their content from `src/data/`, so facts such as the current version, download links and the widget list live in one place. When you release, update `src/data/releases.ts` with every package in the release; `product.test.ts` checks the list against the formats `scripts/collect-packages.mjs` builds. When you add a widget to the app, add it to `src/data/widgets.ts`.

## Design system

The tokens at the top of `src/styles/global.css` are the only source of colours, type sizes, radii, shadows and motion. Product mockups in `src/styles/demo.css` use the `--glass-*`, `--mint` and `--tile-*` tokens so they match the desktop app's dark theme.

- **The header is a dock.** It floats as a glass capsule like OpenDock's own dock, and marks the current page with the dock's running dot. Keep it the only floating bar on the page.
- **Borders, not shadows.** Cards and lists use a border or a top rule. Only things that float over the page (the header, menus, product mockups) get `--shadow-float` or `--shadow-artifact`.
- **Status in words.** Platform and feature status is always a word (*Supported*, *Experimental*, *Shipped*), with colour only repeating it. `--caution` marks experimental things.
- **Type.** `--text-xs` to `--text-display`, with system fonts only: Segoe UI Variable on Windows, San Francisco on macOS.
- **Motion.** `--dur-fast` and `--dur` with `--ease`, on `transform`, `opacity` and colours only. Everything stops under `prefers-reduced-motion`.

The download buttons (`src/components/PlatformDownload.astro`) start as *Download for Windows*. A small script guesses the visitor's system with `src/data/platform.ts`, switches the button to macOS or Linux with an *Experimental* tag, and sets `data-platform` on the page so the matching platform column is marked *Your system*. Without JavaScript, everything still links to the download page.

## Local development

```powershell
pnpm dev:web          # http://localhost:4321 with hot reload
pnpm build:web        # production build into apps/web/dist
pnpm --filter @opendock/web preview   # serve the production build
pnpm lighthouse:web   # build, then run Lighthouse CI
```

## Quality bar

- Lighthouse accessibility, best practices and SEO scores must be at least 0.95 (enforced in CI by `lighthouserc.cjs`).
- No external fonts, scripts, trackers or embeds. Everything is served from the site's own origin.
- Pages work without JavaScript. Small scripts are allowed for progressive enhancement only.
- Use the colour and spacing tokens in `src/styles/`; don't hard-code values in pages.
- Screenshots must show only OpenDock and neutral demo content: no personal names, emails, file paths or window titles.

## Deployment

Cloudflare Pages builds the site from GitHub.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Preview branches | All other branches and pull requests |
| Root directory | `/` (the repository root) |
| Build command | `corepack enable && corepack prepare pnpm@10.34.4 --activate && pnpm install --frozen-lockfile && pnpm build:web` |
| Build output directory | `apps/web/dist` |
| Environment variable | `NODE_VERSION` = `22` |

The pnpm version in the build command must match the `packageManager` field in the root `package.json`, so the deployed build uses the same pnpm as CI and contributors. Update both together.

Every push to `main` deploys to production. `staging` and `develop`, and every other branch and pull request, get a preview URL. Security headers come from `public/_headers`.

### Custom domain

To serve the site from your own domain, add it in the Cloudflare dashboard under the Pages project's **Custom domains** tab, then change `site` in `apps/web/astro.config.mjs` so canonical URLs and the sitemap use it.

### Access

Only maintainers have access to the Cloudflare account. Contributors don't need it: preview deployments are linked from pull requests, and the local build is identical to the deployed one. Account identifiers and API tokens must never be committed. If a manual deploy is ever needed, use `wrangler pages deploy apps/web/dist` with your own credentials in environment variables.
