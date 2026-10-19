// Random ids made in the browser. crypto.randomUUID() exists only in secure contexts (HTTPS or localhost),
// and a self-hosted server is often opened over plain http://<server>:3000, where calling it throws.
// crypto.getRandomValues() works everywhere, so the id is a version 4 UUID built from it.

/** A random version 4 UUID, also on plain HTTP. */
export function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
