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

### Today: build on the Pis

There is no registry in the loop yet, so the image is built on each node that runs it:

```bash
# from this folder, for each app node (bram4, bram5)
rsync -a --delete --exclude .git --exclude .taste-skill ./ owen@bram4.local:~/build/ares-site/
ssh owen@bram4.local 'cd ~/build/ares-site && docker build -t ares-site:1.0.1 .'
```

Then roll the service to the new tag from a manager (bram1):

```bash
ssh owen@bram1.local 'docker service update --no-resolve-image --image ares-site:1.0.1 ares_site'
```

Bump the tag on every release (1.0.1, 1.0.2 …) so Swarm sees a change, and put the same tag in
`ARES_IMAGE` before any `docker stack deploy`.

### Next: GitHub builds it

`.github/workflows/image.yml` builds the image for arm64 and amd64 on every push to `main` and
pushes `ghcr.io/<owner>/ares-site:main`. Once the first run has finished:

1. On GitHub, open the `ares-site` package → Package settings → change visibility to Public
   (the Pis pull without credentials).
2. In the Bramblebush repo, set `ARES_IMAGE=ghcr.io/<owner>/ares-site:main` and
   `ARES_AUTOUPDATE=true`, then redeploy the stack without `--resolve-image never`.

After that, a release is just `git push`: shepherd on the cluster sees the new digest and rolls
the service within a few minutes.

## Before launch

- Fabrication photos in "Made by hand" are other people's pictures of the same processes,
  credited in the footer. Replace them with the team's own shop photos when they exist.
- The Umami tracker loads from `umami.owenbramley.com` (the public tracker host); the dashboard
  stays private on the tailnet.

## Credits

Renders are Team DSLR's own CAD. Other pictures and the descent clip are credited in the page
footer and listed in `assets/found/credits.json`.
