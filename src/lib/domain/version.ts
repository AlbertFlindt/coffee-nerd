// The version line in Settings: the release, then when the app on the phone was built, so you
// can tell which release it is and whether the phone has taken the newest build.

/**
 * "Version 1.0.0 · 26 October 2026, 13:19" from the release (package.json) and the build's
 * version (the time it was built, in milliseconds; the service worker's cache key).
 */
export function versionText(release: string, build: string, timeZone?: string): string {
  const built = Number(build);
  if (!Number.isInteger(built) || built <= 0) return `Version ${release} · ${build}`;
  const when = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone
  }).format(built);
  return `Version ${release} · ${when.replace(' at ', ', ')}`;
}
