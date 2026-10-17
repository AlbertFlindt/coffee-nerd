import { describe, expect, it } from 'vitest';
import { isCrossSiteWrite, isHttps } from './csrf';

const post = (headers: Record<string, string>, method = 'POST') =>
  new Request('http://ignored.example/login', { method, headers });

describe('isCrossSiteWrite', () => {
  it('D-60: a form sent from the page it came from is allowed, over http or https', () => {
    expect(
      isCrossSiteWrite(post({ host: '192.168.1.20:3000', origin: 'http://192.168.1.20:3000' }))
    ).toBe(false);
    expect(isCrossSiteWrite(post({ host: 'coffee.home', origin: 'https://coffee.home' }))).toBe(
      false
    );
  });

  it('D-60: behind a proxy, the forwarded host counts', () => {
    expect(
      isCrossSiteWrite(
        post({
          host: 'localhost:3000',
          'x-forwarded-host': 'coffee.home',
          origin: 'https://coffee.home'
        })
      )
    ).toBe(false);
  });

  it('D-60: a form sent from another site, or without an origin, is refused', () => {
    expect(isCrossSiteWrite(post({ host: 'coffee.home', origin: 'https://evil.example' }))).toBe(
      true
    );
    expect(isCrossSiteWrite(post({ host: 'coffee.home' }))).toBe(true);
    expect(isCrossSiteWrite(post({ host: 'coffee.home', origin: 'null' }))).toBe(true);
  });

  it('D-60: reading pages is never blocked', () => {
    expect(isCrossSiteWrite(new Request('http://x/', { headers: { host: 'coffee.home' } }))).toBe(
      false
    );
  });
});

describe('isHttps', () => {
  it('D-86: the cookie is marked secure only when a proxy says the visit used https', () => {
    expect(isHttps(new Request('http://x/', { headers: { 'x-forwarded-proto': 'https' } }))).toBe(
      true
    );
    expect(isHttps(new Request('http://x/'))).toBe(false);
    expect(isHttps(new Request('http://x/', { headers: { 'x-forwarded-proto': 'http' } }))).toBe(
      false
    );
  });
});
