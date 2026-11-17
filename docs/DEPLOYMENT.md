# Deployment and maintenance

## Production setup

- Repository: `MaskedCM/daytona-sp3-experience`
- Branch: `main`
- Host: GitHub Pages
- Publishing source: GitHub Actions
- Workflow: `.github/workflows/pages.yml`
- Node build toolchain: 24
- Static output: `dist/`
- Project base path: `/daytona-sp3-experience/`

GitHub Pages serves the built files. Do not use `npm run dev` or `vite preview` as the public production server, and do not rely on an AI Studio preview tunnel as the permanent URL.

## Publish an update

1. Edit a local clone or branch. If editing in AI Studio, export and review those source changes in this repository; AI Studio does not automatically update this release repository.
2. Run `npm ci` when dependency inputs changed, then `npm run check`.
3. Review the diff, commit and push to `main` (or open a pull request first).
4. Follow **Actions → Verify and deploy Daytona SP3** until both build and deploy succeed.
5. Open the live site and check that the model loads, Anatomy works and sound stops correctly.

The workflow type-checks, runs tests, builds and verifies the artifact before deployment. Pull requests validate without publishing. It uses GitHub's repository-scoped token and Pages deployment identity; no manually stored API token, Gemini key or cloud-service secret is required.

## Rebuild a Pages artifact locally

On macOS/Linux:

```sh
VITE_BASE_PATH=/daytona-sp3-experience/ npm run build
VITE_BASE_PATH=/daytona-sp3-experience/ npm run verify:dist
npm run preview
```

In PowerShell:

```powershell
$env:VITE_BASE_PATH = '/daytona-sp3-experience/'
npm run build
npm run verify:dist
npm run preview
```

Open the preview URL with `/daytona-sp3-experience/` appended. For a domain-root host, unset `VITE_BASE_PATH` and rebuild; the default base is `/`.

## Rollback

Revert the faulty commit and push the revert to `main`. A fresh workflow run will rebuild the previous behaviour and publish it. Avoid rewriting shared Git history just to undo a release.

The `v1.0.0` source tag and release archive provide the initial launch snapshot. A release archive is also portable to another static host after selecting the correct base path and rebuilding.

## Keeping it available

The published app does not require the development laptop to stay on. Static hosting has no application process to keep alive and no Gemini credits to renew. Core assets, fonts and decoders are packaged with the site.

Availability still depends on:

- Keeping the GitHub account, repository and Pages service active.
- Remaining within hosting limits and the provider's terms.
- Keeping backups of source and assets.
- Updating the build toolchain and dependencies when their supported versions change.
- Using a browser/GPU with WebGL and sufficient memory for the model.
- Preserving third-party licences and resolving the explicitly unverified media permissions before treating the project as a rights-cleared commercial asset.

GitHub currently documents a 1 GB published-site maximum and a soft 100 GB/month Pages bandwidth limit. These are provider policies, not guarantees, and can change. The car and HDRI together are about 21 MB before JavaScript and fonts; many cold visits can consume bandwidth faster than a text-only site.

If traffic outgrows Pages, keep the repository and move the built site to a static host/CDN with suitable bandwidth. No backend migration is needed for the current feature set. A custom domain is optional and has its own registration/renewal obligations; the default `github.io` address does not require buying one.

## Maintenance practice

After a meaningful dependency update, run the full suite and inspect the browser rendering, door motion, exploded restoration, alternate wheels, Engine Lab, Photo Mode and sound cancellation. Check the source's asset credits whenever media is replaced. Keep lockfile changes intentional and review automated-action versions before updating them.

The workflow is triggered by pushes, pull requests and manual dispatch. It is not an uptime monitoring service. If continuous external availability alerts are later needed, configure a dedicated monitor under the owner's account rather than adding artificial keep-alive traffic.

## Common problems

| Symptom | What to check |
| --- | --- |
| Blank page or JS/CSS 404 | Verify Pages uses Actions, deployment succeeded and the build base matches the repository name. |
| UI loads, car/HDR image 404 | Verify `publicAssetUrl()` is used and the GLB/HDR files are included in the artifact. |
| First load is slow | The first visit downloads substantial 3D/lighting assets. Check connection quality and the browser network status. |
| Car cannot render | Check WebGL/hardware acceleration and graphics memory; try a current browser. |
| No sound | Click Enable sound, confirm the browser/device is not muted and press Start or Rev. Returning from a hidden tab does not auto-restart audio. |
| Local edit is absent online | Commit and push to this repository, then wait for the deployment workflow. AI Studio edits alone do not deploy here. |
| Build fails after toolchain changes | Use Node 24, install with `npm ci`, inspect the failed workflow step and keep the lockfile in sync. |

## Sources

- [Vite: deploy a static site](https://vite.dev/guide/static-deploy)
- [GitHub: Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [GitHub: publishing source configuration](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
