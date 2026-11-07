# Coffee Nerd: one image, one data volume.

# --- build: install everything, compile the app ---
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
# better-sqlite3 ships prebuilt binaries, so no install scripts (and no compiler) are needed.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# --- deps: production dependencies only ---
FROM build AS deps
RUN npm ci --omit=dev --ignore-scripts

# --- runtime: non-root, only what the server needs ---
FROM node:22-bookworm-slim AS runtime
LABEL org.opencontainers.image.title="Coffee Nerd" \
      org.opencontainers.image.description="A self-hosted espresso journal for your phone" \
      org.opencontainers.image.source="https://github.com/AlbertFlindt/coffee-nerd" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/coffee-nerd.db \
    NODE_OPTIONS="--max-semi-space-size=2 --max-old-space-size=96" \
    MALLOC_ARENA_MAX=1 \
    MALLOC_TRIM_THRESHOLD_=131072
# Memory: by default Node sizes its heap from the host's memory and glibc keeps a malloc arena per
# thread, so an idle app for one person held hundreds of megabytes. A small young generation (the
# semi-space) and one arena that is trimmed often keep it around 100 MB; the old-space cap leaves
# room for an export or backup of a large journal.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
# Password reset on the server: docker compose exec coffee-nerd node scripts/reset-password.mjs
COPY --from=build /app/scripts/reset-password.mjs ./scripts/reset-password.mjs
COPY --from=build /app/src/lib/server/auth/password.js ./src/lib/server/auth/password.js
COPY package.json ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "build"]
