# Project Ares website

The public site for Team DSLR's mock Mars lander (UH Mānoa ME 481, Fall 2026 – Spring 2027),
served at https://areslander.space from the Bramble Bush Plus Raspberry Pi Swarm.

It is a static page: `index.html`, `styles.css`, `main.js` and `assets/`. No build step, no
framework, no database.

## Preview it locally

```bash
python3 -m http.server 4321
```

Then open http://127.0.0.1:4321. Open it through a server rather than as a file, so the video
and fonts load the way they will live.

## What is in the image

`Dockerfile` copies the site into `nginx:1.30.5-alpine` with `deploy/nginx.conf`:

- `/healthz` answers `ok` for the container health check;
- HTML, CSS and JS always revalidate, so a new release shows at once;
- pictures and video in `assets/` cache for a week.

Traefik on the cluster adds compression; TLS ends at Cloudflare.

## How it reaches the cluster

Public path: Cloudflare tunnel → edge nginx (`ARESLANDER_DOMAIN` block) → Traefik → the
`ares_site` service (2 replicas on the `workload=app` nodes, bram4 and bram5). The stack file is
`stack/ares.yml` in the Bramblebush repo. Its Traefik router outranks the old "under
construction" router for areslander.space, which is kept at 0 replicas as a fallback.

### Releasing

`.github/workflows/image.yml` builds the image for arm64 and amd64 on every push to `main` and
pushes the public package `ghcr.io/owenbramley/ares-site:main`. The stack runs that tag with
`ARES_AUTOUPDATE=true`, so shepherd on the cluster sees the new digest and rolls both replicas
within a few minutes. A release is just `git push`.

The service rolls stop-first: two app nodes with one replica each leave no room for a
start-first task.

## Project files

`wiki/` is the full file list at `/wiki/`, and the "Project files" section on the home page browses
the same folders. Both read `/wiki/files/_wiki/manifest.json`. The files themselves are a copy of
the team's Google Drive kept on the cluster (`stack/ares-wiki.yml` and `docs/ares-wiki.md` in the
Bramblebush repo); Traefik sends `/wiki/files/` there, not to this image. To preview locally,
put a copy of the manifest at `wiki/files/_wiki/manifest.json` (ignored by Git and Docker).

## Keeping it current

The "Where we stand" section is the status page for sponsors: mass, money and schedule. Update
its numbers and the "Updated …" date after each design review, using the figures in the review
report (the November 2026 numbers come from the Preliminary Design Review).

## Before launch

- In "Made by hand", Cut, Fold, Print and Drop are the team's own photos (`assets/shop/`). Rivet
  is still a credited stock picture; swap it when the team has its own.
- The Umami tracker loads from `umami.owenbramley.com` (the public tracker host); the dashboard
  stays private on the tailnet.

## Credits

Renders are Team DSLR's own CAD. Other pictures and the descent clip are credited in the page
footer and listed in `assets/found/credits.json`.
