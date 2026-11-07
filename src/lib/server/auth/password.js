// Password hashing with scrypt (Node's crypto, no dependency). Plain JavaScript so that
// scripts/reset-password.mjs can use it on the server without a build step.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// One of OWASP's equally strong scrypt settings (N = 2^14, r = 8, p = 5), the one with the least memory:
// scrypt needs 128·N·r bytes, 16 MB here, where N = 2^17, p = 1 took 134 MB per sign-in. Stored hashes
// carry their parameters, so older ones still verify and are moved to these on the next sign-in.
const PARAMS = { N: 16384, r: 8, p: 5 };
/** Room for hashes stored with the earlier N = 2^17 (134 MB); Node's default limit is 32 MB. */
const MAX_MEMORY = 256 * 1024 * 1024;
const KEY_LENGTH = 64;

/**
 * @param {string} password
 * @param {Buffer} salt
 * @param {{ N: number, r: number, p: number }} params
 * @returns {Promise<Buffer>}
 */
function derive(password, salt, params) {
  return new Promise((resolve, reject) =>
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { ...params, maxmem: MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key))
    )
  );
}

/**
 * A salted hash to store: "scrypt$N$r$p$salt$hash" (base64). The password itself is never stored.
 * @param {string} password
 * @param {{ N: number, r: number, p: number }} [params] only tests pass other parameters
 * @returns {Promise<string>}
 */
export async function hashPassword(password, params = PARAMS) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, params);
  const { N, r, p } = params;
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

/**
 * Constant-time check of a password against a stored hash. A malformed hash never matches.
 * @param {string} password
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, stored) {
  const [scheme, N, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(password, Buffer.from(salt, 'base64'), {
    N: Number(N),
    r: Number(r),
    p: Number(p)
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/**
 * True when a stored hash was made with other parameters than the current ones.
 * @param {string} stored
 * @returns {boolean}
 */
export function needsRehash(stored) {
  const [, N, r, p] = stored.split('$');
  return Number(N) !== PARAMS.N || Number(r) !== PARAMS.r || Number(p) !== PARAMS.p;
}
