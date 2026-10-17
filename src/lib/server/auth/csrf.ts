// Request checks for a self-hosted server whose address is not known when the image is built.
// SvelteKit's own origin check compares with an origin it assumes to be https, which rejects every form
// on a plain-http home network; this compares hosts instead (the session cookie is also SameSite=Lax).

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** True for a write (POST, PUT, PATCH, DELETE) whose Origin is missing or names another host. */
export function isCrossSiteWrite(request: Request): boolean {
  if (!WRITES.has(request.method)) return false;
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!origin || !host) return true;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true; // "null" or another value that is not an origin
  }
}

/** True when a reverse proxy reports https; the Node server itself only speaks http. */
export function isHttps(request: Request): boolean {
  return request.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
}
