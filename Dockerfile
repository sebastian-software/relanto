# syntax=docker/dockerfile:1.25

FROM node:24.18.0-bookworm-slim AS context-probe

# Die Probe kopiert bewusst den gesamten von BuildKit übertragenen Kontext. So
# wird geprüft, dass die geheime Canary bereits vor dem ersten COPY fehlt.
WORKDIR /context
COPY . ./
RUN set -eu; \
  test ! -e packages/frontend/.env.context-canary; \
  test -f packages/frontend/.env.development.example

FROM node:24.18.0-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ARG RELANTO_GIT_SHORT_SHA=dev

RUN corepack enable
RUN apt-get update \
  && apt-get install -y --no-install-recommends g++ make python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm rebuild better-sqlite3
RUN pnpm --filter @relanto/backend exec node -e "import('better-sqlite3').then(({default: Database}) => { const db = new Database(':memory:'); db.exec('select 1'); db.close(); console.log('better-sqlite3 ready'); }).catch((error) => { console.error(error); process.exit(1); })"
RUN pnpm --filter @palamedes/config --filter @palamedes/core --filter @palamedes/react --filter @palamedes/transform --filter @palamedes/vite-plugin build
RUN pnpm --filter @relanto/frontend build

# The standard build is deliberately font-free. If an approved open font is
# introduced later, update this guard and the public asset notice together.
RUN set -eu; \
  scoped_asset_package_pattern='@[[:alnum:]._-]+/assets'; \
  font_file="$(find /app/packages/frontend/build/client -type f \( -iname '*.woff' -o -iname '*.woff2' -o -iname '*.ttf' -o -iname '*.otf' \) -print -quit)"; \
  test -z "${font_file}"; \
  ! grep -R -I -q -E "${scoped_asset_package_pattern}" /app/packages/frontend/build /app/packages/frontend/package.json /app/pnpm-lock.yaml; \
  ! grep -R -I -q -E '(Sa''ns|Ser''if|Sl''ab)' /app/packages/frontend/build

RUN pnpm --filter @relanto/frontend --prod deploy --legacy /app/runtime

# Keep the distributable image free of private package remnants and reserve the
# operator-assets path exclusively for a read-only runtime mount.
RUN set -eu; \
  scoped_asset_package_pattern='@[[:alnum:]._-]+/assets'; \
  font_file="$(find /app/runtime -type f \( -iname '*.woff' -o -iname '*.woff2' -o -iname '*.ttf' -o -iname '*.otf' \) -print -quit)"; \
  private_package_path="$(find /app/runtime -path '*node_modules/@*/assets*' -print -quit)"; \
  test -z "${font_file}"; \
  test -z "${private_package_path}"; \
  test ! -e /app/runtime/build/client/operator-assets; \
  ! grep -R -I -q -E "${scoped_asset_package_pattern}" /app/runtime; \
  ! grep -R -I -q -E '(Sa''ns|Ser''if|Sl''ab)' /app/runtime

FROM build AS runtime-probe

# Die Laufzeit-Canary muss im Build-Arbeitsbereich vorhanden sein, darf aber
# nicht in das per pnpm deploy erzeugte Laufzeitverzeichnis gelangen.
# Zugangsdaten für künftige Builds dürfen ausschließlich über kurzlebige
# BuildKit-Secret-Mounts eingebunden werden, nie über ARG, ENV, Labels oder COPY.
RUN set -eu; \
  test -f /app/packages/frontend/.relanto-runtime-canary; \
  test ! -e /app/runtime/.relanto-runtime-canary; \
  test ! -e /app/runtime/packages/frontend/.relanto-runtime-canary

FROM node:24.18.0-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ARG RELANTO_GIT_SHORT_SHA=dev
ENV RELANTO_GIT_SHORT_SHA=$RELANTO_GIT_SHORT_SHA

WORKDIR /app

COPY --from=build --chown=node:node /app/runtime ./

# Run as the unprivileged "node" user (uid/gid 1000, shipped by the base image)
# instead of root. Give that user ownership of the app directory and create the
# default data directory so the SQLite database can be written at runtime.
# When a fresh named volume is mounted onto /var/lib/relanto, Podman copies the
# ownership of this directory into the empty volume, so the container user keeps
# write access (see deploy/quadlet/relanto.container.example for pre-existing
# volumes).
# Keep package-manager dependency trees out of the final image; the built app
# only needs node and the deployed production node_modules.
RUN node -e "import('better-sqlite3').then(({default: Database}) => { const db = new Database(':memory:'); db.exec('select 1'); db.close(); console.log('better-sqlite3 ready'); }).catch((error) => { console.error(error); process.exit(1); })" \
  && mkdir -p /var/lib/relanto \
  && rm -rf \
    /usr/local/bin/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/pnpm \
    /usr/local/bin/pnpx \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg \
    /usr/local/lib/node_modules/corepack \
    /usr/local/lib/node_modules/npm \
  && chown node:node /app /var/lib/relanto

USER node

EXPOSE 3000

# Probe the application /health endpoint (checks DB + worker liveness, 200 healthy / 503 unhealthy).
# Uses Node's global fetch (Node >= 18) to avoid depending on curl/wget in the runtime image.
# Interval/retries are generous relative to the worker tick (default 2.5s, unhealthy after 2x).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "--import=./serverStartup.mjs", "./node_modules/@react-router/serve/dist/cli.js", "./build/server/index.js"]
