import { defineEnvVars } from '@sveltejs/kit/env';
import { DEFAULT_DATABASE_PATH } from './lib/server/db/client';

export const variables = defineEnvVars({
  DATABASE_PATH: {
    description: 'Path of the SQLite database file.',
    schema: (value) => value || DEFAULT_DATABASE_PATH
  }
});
