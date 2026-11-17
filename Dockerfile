# syntax=docker/dockerfile:1
# Battle Drill: one image that installs, builds, syncs the rules data and serves the app.
#   docker compose up        (see docker-compose.yml)
# The Wahapedia data is downloaded at container start into a volume, never baked into the image.
FROM node:22-slim

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NODE_ENV=development \
    PORT=5173

WORKDIR /app

# Install dependencies first (cached unless a package.json changes).
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/data/package.json packages/data/
COPY packages/engine/package.json packages/engine/
COPY packages/roster/package.json packages/roster/
COPY packages/tutorial/package.json packages/tutorial/
# Behind a TLS-intercepting proxy, pass its CA: docker build --secret id=ca,src=/path/ca.crt .
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    npm ci --no-audit --no-fund

# Build the packages and the web app.
COPY . .
RUN npm run build \
    && mkdir -p data-cache node_modules/.vite-temp \
    && chown -R node:node /app/data-cache node_modules/.vite-temp \
    && chmod +x docker/entrypoint.sh

USER node
VOLUME ["/app/data-cache"]
EXPOSE 5173
ENTRYPOINT ["docker/entrypoint.sh"]
