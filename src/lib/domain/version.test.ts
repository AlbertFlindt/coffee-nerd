import { describe, expect, it } from 'vitest';
import { versionText } from './version';

describe('versionText', () => {
  it('Settings names the version by when it was built', () => {
    const built = String(Date.UTC(2026, 9, 26, 13, 19));
    expect(versionText(built, 'UTC')).toBe('Version of 26 October 2026, 13:19');
  });

  it('a version that is not a build time is shown as it is', () => {
    expect(versionText('next', 'UTC')).toBe('Version next');
  });
});
