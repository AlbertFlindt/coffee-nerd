import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomId } from './id.ts';
import { featureDefinitionSchema } from './schemas.ts';

describe('randomId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is a version 4 UUID, different each time', () => {
    const a = randomId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(randomId()).not.toBe(a);
  });

  it('works without crypto.randomUUID, as on plain HTTP', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect(randomId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('D-65: a new custom feature key stays custom-<uuid>', () => {
    const key = `custom-${randomId()}`;
    const parsed = featureDefinitionSchema.safeParse({
      key,
      label: 'Bloom',
      builtIn: false,
      enabled: true,
      switchable: true,
      value: { kind: 'seconds', step: 1000 }
    });
    expect(parsed.success).toBe(true);
  });
});
