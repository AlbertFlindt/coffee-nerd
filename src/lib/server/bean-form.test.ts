import { describe, expect, it } from 'vitest';
import { saveBeanForm } from './bean-form';
import { BeanRejected } from './db/beans';

const post = (fields: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return new Request('http://localhost/library/beans/new', { method: 'POST', body });
};

describe('saveBeanForm', () => {
  it('D-41: a readable form is saved', async () => {
    let saved = '';
    const result = await saveBeanForm(post({ name: 'Kiambu AA', roastDate: '2026-10-13' }), (b) => {
      saved = b.name;
    });
    expect(result).toBeNull();
    expect(saved).toBe('Kiambu AA');
  });

  it('D-138: a roast date after today comes back in plain words', async () => {
    const result = await saveBeanForm(post({ name: 'Kiambu AA', roastDate: '2099-01-01' }), () => {
      throw new BeanRejected(['roastDate: after today']);
    });
    expect(result?.status).toBe(400);
    expect(result?.data).toEqual({ problems: ['Roast date cannot be after today'] });
  });
});
