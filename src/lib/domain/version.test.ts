import { describe, expect, it } from 'vitest';
import { versionText } from './version';

describe('versionText', () => {
  it('Settings names the release, then when it was built', () => {
    const built = String(Date.UTC(2026, 9, 26, 13, 19));
    expect(versionText('1.0.0', built, 'UTC')).toBe('Version 1.0.0 · 26 October 2026, 13:19');
  });

  it('a build version that is not a build time is shown as it is', () => {
    expect(versionText('1.0.0', 'next', 'UTC')).toBe('Version 1.0.0 · next');
  });

  it('the release is the one package.json names', () => {
    expect(__APP_VERSION__).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
