# Coffee Nerd: one image, one data volume (D-59).

# --- build: install everything, compile the app ---
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
# better-sqlite3 ships prebuilt binaries, so no install scripts (and no compiler) are needed.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
# The reference seed as one file, for trying the app on a server (D-88; it only fills an empty database).
RUN npx esbuild scripts/seed.ts --bundle --platform=node --format=esm --packages=external \
      --tsconfig-raw='{}' --outfile=build-scripts/seed.mjs

# --- deps: production dependencies only ---
FROM build AS deps
RUN npm ci --omit=dev --ignore-scripts

# --- runtime: non-root, only what the server needs ---
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/coffee-nerd.db
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
# Password reset on the server (D-87): docker compose exec coffee-nerd node scripts/reset-password.mjs
COPY --from=build /app/scripts/reset-password.mjs ./scripts/reset-password.mjs
COPY --from=build /app/src/lib/server/auth/password.js ./src/lib/server/auth/password.js
# Reference setup for trying it out: docker compose exec coffee-nerd node scripts/seed.mjs
COPY --from=build /app/build-scripts/seed.mjs ./scripts/seed.mjs
COPY package.json ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "build"]
