# Project Ares website (Team DSLR): static files behind nginx.
# Built for linux/arm64 (Raspberry Pi Swarm) and linux/amd64.
FROM nginx:1.30.5-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css main.js /usr/share/nginx/html/
COPY wiki /usr/share/nginx/html/wiki
COPY assets /usr/share/nginx/html/assets
RUN rm -f /usr/share/nginx/html/assets/found/credits.json \
 && find /usr/share/nginx/html -type d -exec chmod 755 {} + \
 && find /usr/share/nginx/html -type f -exec chmod 644 {} +
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
