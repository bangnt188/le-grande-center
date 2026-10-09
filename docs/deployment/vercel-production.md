# Mall deployment: demo GitHub Pages vs Vercel production

**Status:** Preparation only. This repository currently serves the public customer demo from `dev` via GitHub Pages. Production is NOT deployed and `main` does not yet contain the application.

## Same contract as Solar

| Contract | Customer demo | Vercel production |
|---|---|---|
| Git branch | dev | main (approved release only) |
| Target | DEPLOY_TARGET=demo (default) | DEPLOY_TARGET=server |
| Hosting | GitHub Pages, static `out/` | Vercel Next.js server runtime |
| URL | https://bangnt188.github.io/le-grande-center/ | customer HTTPS root domain (not yet configured) |
| Data | fixture-only, no cloud API | only audited production backend/data |
| SEO | SEO_INDEXABLE=false | false until content launch approval |
| Admin | fixture `/admin-preview/`, client-only | intentionally returns 404 until real authenticated CMS exists |
| Pipeline | `.github/workflows/deploy-dev-pages.yml` | `.github/workflows/deploy-vercel-production.yml` (manual only) |

## Build contract

```bash
# Requires Node 22, npm ci and pinned private submodule checkout.
npm run build:demo        # static out/, Pages-compatible basePath /le-grande-center
NEXT_PUBLIC_SITE_URL=https://mall.example.invalid/ npm run build:server
                           # .next server build, no static export
npm run typecheck
npm run test:admin
npm run test:scene
```

The existing `npm run build` defaults to **demo** for local and legacy Pages callers. The `build:demo` and `build:server` scripts set a target and invoke npm's existing `prebuild`, `build`, and `postbuild` hooks.
`next.config.ts` enables `output: export` **only** for demo. `scripts/prepare-public-export.mjs` manipulates `out/` only for demo. Server mode requires an explicit root-origin `NEXT_PUBLIC_SITE_URL`, rejects demo admin flags and returns 404 for `/admin-preview/`.
To prevent accidental publication, server SEO is not indexable unless explicitly enabled. Demo must remain noindex and free of customer/private data.

## One-time Vercel setup

1. Select the Vercel Pro or suitable commercial plan. Create a **separate** Vercel project for Mall, with Framework Preset Next.js, Node 22 and repository root as Root Directory. Do **not** enable parallel Git-integrated automatic production deployment if you intend to deploy exclusively from GitHub Actions.
2. In the Vercel **Production** environment set `DEPLOY_TARGET=server`, `NEXT_PUBLIC_SITE_URL=https://CUSTOMER_DOMAIN/` (root URL; must match the intended domain), `SEO_INDEXABLE=false` until approval, and required runtime secrets only after a security review. No `NEXT_PUBLIC_ADMIN_DEMO=true` or `INCLUDE_ADMIN_DEMO=true` in production.
3. Get Vercel `orgId` and `projectId` via a local `vercel link`. Create a project/team-scoped token. Set **GitHub Environment** `production` secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and read-only `COMPONENT_UI_READ_TOKEN` or `SUBMODULE_READ_TOKEN` for both private libraries. Do not store actual values in code/Drive.
4. Configure GitHub Environment `production` to allow **only main** and require reviewer approval. Protect main with PR reviews/status checks. Keep `dev` with `github-pages` Environment secret for demo and server CI. Never use a broad personal PAT in a customer-owned repo.
5. Deploy workflow is deliberately **manual-only** on `main`. From Actions choose `Deploy production to Vercel` and select **main** once Vercel, application and security are ready. No production source has yet been promoted from dev to main.

## Before activating production

- [ ] App from dev is promoted into main through reviewed PR/release; main is currently only a README.
- [ ] `Check Mall server build` is green on dev with the synthetic HTTPS root domain; this checks compilation **not** API readiness.
- [ ] CMS, authentication, tenant/slot/lead storage, authorization, data retention, backups and logging have been completed and tested if they are in the sold scope.
- [ ] Public content, map/3D accuracy, media and licenses accepted; verify desktop/mobile behavior.
- [ ] Vercel production project + deployment protection, custom domain/DNS and Production secrets configured; no fake admin, API or database data.
- [ ] Manual production run in GitHub Actions completed with success and approved SHA. Smoke test customer domain and keep rollback path documented.
- [ ] Keep `SEO_INDEXABLE=false` until explicitly approved.

### Troubleshooting

- `Missing private submodule token`: secret belongs to a named GitHub Environment; job must have `environment` and branch access. The dev workflows use github-pages only for a read-only submodule secret.
- `Vercel production requires DEPLOY_TARGET=server`: set Production environment variable in Vercel before triggering deployment. Never change demo's default to server.
- `Server deployment requires NEXT_PUBLIC_SITE_URL`: set a secure customer root-origin URL (no `/le-grande-center/` prefix). Preview/build checks use `https://mall.example.invalid/`.
- `main` has no `package.json`: no approved production app code yet. Promote via PR; do not bypass by deploying dev.
- Vercel CLI prebuilt builds do not receive every Vercel **system** environment variable at build time. Verify Next.js features that need them before go-live, or choose a different deployment integration. https://vercel.com/docs/cli/deploy
- The GitHub Pages `gh-pages` branch can remain unchanged after successful Actions artifact deploy; verify the workflow SHA and the live URL.

Reference: https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel

Last reviewed: 2026-10-09.
