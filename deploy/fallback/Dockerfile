# One build, two images: `docker build --target web` (default, last stage) serves; `--target worker` runs pg-boss handlers.
# Debian (glibc), not Alpine: onnxruntime-node (embeddings) ships glibc binaries only.
FROM node:22-slim AS build
WORKDIR /app
RUN npm i -g pnpm@10.18.2
COPY . .
# SKIP_ENV_VALIDATION is build-only: the runtime stages below do not inherit it.
RUN SKIP_ENV_VALIDATION=1 pnpm install --frozen-lockfile && SKIP_ENV_VALIDATION=1 pnpm build \
 && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public \
 && mkdir -p .next/standalone/scripts .next/standalone/lib/db \
 && cp scripts/migrate.mjs .next/standalone/scripts/ && cp -r lib/db/migrations .next/standalone/lib/db/

FROM node:22-slim AS worker
ENV NODE_ENV=production
WORKDIR /app
# tsx runs worker/ and lib/ directly, so the worker keeps the full tree and devDependencies.
COPY --from=build /app ./
CMD ["node_modules/.bin/tsx", "--conditions=react-server", "worker/index.ts"]

FROM node:22-slim AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/.next/standalone ./
EXPOSE 3000
# Migrations first (idempotent; skipped when DATABASE_URL is unset), then serve.
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node server.js"]
