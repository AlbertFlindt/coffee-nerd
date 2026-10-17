// Fills an empty database with the reference setup for development and screenshots (roadmap M2, D-88).
// Usage: npm run db:seed   (uses DATABASE_PATH, default ./data/coffee-nerd.db)
import { hashPassword } from '../src/lib/server/auth/password.js';
import { openDatabase } from '../src/lib/server/db/client';
import { DEFAULT_DATABASE_PATH } from '../src/lib/server/db/paths';
import { seedReferenceSetup } from '../src/lib/server/db/seed';

const NAME = 'Demo';
const PASSWORD = 'coffee-nerd';

const path = process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH;
const db = openDatabase(path);
seedReferenceSetup(db, { now: Date.now(), name: NAME, passwordHash: await hashPassword(PASSWORD) });
console.log(`Seeded ${path}. Sign in as "${NAME}" with the password "${PASSWORD}".`);
