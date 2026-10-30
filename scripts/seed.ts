// Fills an empty database with the reference setup for development and screenshots.
// Usage: npm run db:seed   (uses DATABASE_PATH, default ./data/coffee-nerd.db)
//        npm run db:seed -- --history   adds 13 weeks of shots for Insights
import { hashPassword } from '../src/lib/server/auth/password.js';
import { openDatabase } from '../src/lib/server/db/client';
import { DEFAULT_DATABASE_PATH } from '../src/lib/server/db/paths';
import { seedReferenceSetup } from '../src/lib/server/db/seed';
import { seedShotHistory } from '../src/lib/server/db/seed-history';

const NAME = 'Demo';
const PASSWORD = 'coffee-nerd';

const path = process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH;
const db = openDatabase(path);
const now = Date.now();
const ids = seedReferenceSetup(db, { now, name: NAME, passwordHash: await hashPassword(PASSWORD) });
const history = process.argv.includes('--history');
if (history) seedShotHistory(db, ids, now);
console.log(
  `Seeded ${path}${history ? ' with a shot history' : ''}. Sign in as "${NAME}" with the password "${PASSWORD}".`
);
