import { defineConfig } from 'drizzle-kit';
import { DEFAULT_DATABASE_PATH } from './src/lib/server/db/client';

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH },
  verbose: true,
  strict: true
});
