// Password hashing with scrypt (Node's crypto, no dependency). Plain JavaScript so that
// scripts/reset-password.mjs can use it on the server without a build step (D-87).
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

/**
 * @param {string} password
 * @param {Buffer} salt
 * @param {{ N: number, r: number, p: number }} params
 * @returns {Promise<Buffer>}
 */
function derive(password, salt, params) {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, params, (error, key) =>
      error ? reject(error) : resolve(key)
    )
  );
}

/**
 * A salted hash to store: "scrypt$N$r$p$salt$hash" (base64). The password itself is never stored.
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  const { N, r, p } = PARAMS;
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
