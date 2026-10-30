// The version line in Settings: when the app on the phone was built, so the owner can tell
// whether the phone has taken the newest version.

/** "Version of 26 October 2026, 13:19" from the build's version (the time it was built, in milliseconds). */
export function versionText(version: string, timeZone?: string): string {
  const built = Number(version);
  if (!Number.isInteger(built) || built <= 0) return `Version ${version}`;
  const when = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone
  }).format(built);
  return `Version of ${when.replace(' at ', ', ')}`;
}
