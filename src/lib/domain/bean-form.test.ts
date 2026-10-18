import { describe, expect, it } from 'vitest';
import { beanFormText, readBeanForm, type BeanFormText } from './bean-form';

const text = (overrides: Partial<BeanFormText> = {}): BeanFormText => ({
  name: 'Guji Hambela',
  roaster: 'Nordlys Roasters',
  countryCode: 'ET',
  region: 'Guji',
  variety: '',
  process: 'natural',
  altitude: '1,900–2,100 m',
  roastLevel: 'light',
  roastDate: '2026-10-14',
  bagWeight: '250',
  rebuyOfId: '',
  ...overrides
});

describe('readBeanForm', () => {
  it('D-41: what was typed becomes a bean; empty fields are not set', () => {
    expect(readBeanForm(text())).toEqual({
      bean: {
        name: 'Guji Hambela',
        roaster: 'Nordlys Roasters',
        countryCode: 'ET',
        region: 'Guji',
        variety: null,
        process: 'natural',
        altitudeMinM: 1900,
        altitudeMaxM: 2100,
        roastLevel: 'light',
        roastDate: '2026-10-14',
        bagWeight: 250000,
        rebuyOfId: null
      }
    });
  });

  it('D-41, D-138: name and roast date are required, in plain words', () => {
    expect(readBeanForm(text({ name: ' ', roastDate: '' }))).toEqual({
      problems: ['Name is required', 'Roast date is required']
    });
  });

  it('D-35, D-41: an altitude or bag weight that cannot be read says so', () => {
    expect(readBeanForm(text({ altitude: 'high', bagWeight: 'lots' }))).toEqual({
      problems: ['Altitude: write it like 1,900–2,100 m', 'Bag weight: write it in grams, like 250']
    });
    expect(readBeanForm(text({ bagWeight: '0' }))).toEqual({
      problems: ['Bag weight: write it in grams, like 250']
    });
  });

  it('D-142: numbers the international way; a comma only between groups of three digits', () => {
    const grams = (bagWeight: string) => {
      const read = readBeanForm(text({ bagWeight }));
      return 'bean' in read ? read.bean.bagWeight : read.problems;
    };
    expect(grams('250.5')).toBe(250500);
    expect(grams('250.5 g')).toBe(250500);
    expect(grams('1,000')).toBe(1000000);
    expect(grams('1,000g')).toBe(1000000);
    expect(grams('250,5')).toEqual(['Bag weight: write it in grams, like 250']);
  });

  it('D-41: an altitude of 0 m says how to write it, never a field name', () => {
    expect(readBeanForm(text({ altitude: '0' }))).toEqual({
      problems: ['Altitude: write it like 1,900–2,100 m']
    });
  });
});

describe('beanFormText', () => {
  it('D-130: a saved bean back as the form shows it', () => {
    const read = readBeanForm(text());
    if (!('bean' in read)) throw new Error('not read');
    expect(beanFormText({ ...read.bean, roastDate: read.bean.roastDate })).toEqual(text());
  });

  it('D-130: a weight with grams to three decimals survives an untouched edit', () => {
    const read = readBeanForm(text({ bagWeight: '250.25' }));
    if (!('bean' in read)) throw new Error('not read');
    const again = readBeanForm(beanFormText(read.bean));
    expect('bean' in again && again.bean.bagWeight).toBe(250250);
    expect(beanFormText({ ...read.bean, bagWeight: 1000000 }).bagWeight).toBe('1,000');
  });

  it('D-138: no roast date yet stays empty', () => {
    expect(
      beanFormText({
        name: 'Guji Hambela',
        roaster: null,
        countryCode: null,
        region: null,
        variety: null,
        process: null,
        altitudeMinM: null,
        altitudeMaxM: null,
        roastLevel: null,
        roastDate: null,
        bagWeight: null,
        rebuyOfId: null
      })
    ).toEqual(
      text({
        roaster: '',
        countryCode: '',
        region: '',
        process: '',
        altitude: '',
        roastLevel: '',
        roastDate: '',
        bagWeight: ''
      })
    );
  });
});
