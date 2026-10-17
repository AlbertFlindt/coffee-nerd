// Import-free on purpose: read by src/env.ts and drizzle.config.ts, which must not load the native SQLite module.
export const DEFAULT_DATABASE_PATH = './data/coffee-nerd.db';
export const MIGRATIONS_FOLDER = './drizzle';
