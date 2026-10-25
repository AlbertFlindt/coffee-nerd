// Shot facts for tests: the reference values, with ids and times that count up so facts stay oldest first.
import type { ShotFact } from './facts';

let counter = 0;

/** A shot fact with the reference values, changed by `overrides`. */
export function fact(overrides: Partial<ShotFact> = {}): ShotFact {
  counter += 1;
  return {
    shotId: `shot-${String(counter).padStart(4, '0')}`,
    recipeId: 'recipe-a',
    beanId: 'bean-guji',
    beanName: 'Guji Hambela',
    machineId: 'machine',
    grinderId: 'grinder',
    grinderName: 'Timemore 064S',
    grindStep: 100,
    basketId: 'basket',
    basketName: 'VST · 18 g',
    routineId: 'routine-daily',
    routineName: 'Daily routine',
    brewedAt: counter * 60_000,
    localDay: '2026-10-17',
    week: '2026-10-12',
    roastAgeDays: 12,
    score: 8,
    balance: 0,
    body: null,
    sweetness: null,
    aftertaste: null,
    dose: 18000,
    yield: 36000,
    time: 28000,
    ratio: 2000,
    grind: 1600,
    recipeDose: 18000,
    process: 'natural',
    countryCode: 'ET',
    roaster: 'Nordlys Roasters',
    roastLevel: 'light',
    recipeShots: 1,
    setup: {
      features: {
        temperature: { label: 'Temperature', unit: '°C', on: true, value: 93000 },
        preinfusion: { label: 'Preinfusion', on: true, value: 4000, pressure: 2000 },
        low_bar_end: { label: 'Low bar end', on: false }
      },
      routine: {
        name: 'Daily routine',
        steps: [
          { stepId: 'step-wdt', name: 'WDT', unit: 's', value: 20000 },
          { stepId: 'step-screen', name: 'Puck screen type', value: 'metal' },
          { stepId: 'step-distributor', name: 'Distributor', value: null }
        ]
      }
    },
    ...overrides
  };
}
