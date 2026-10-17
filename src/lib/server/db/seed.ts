// The reference setup (roadmap M2) for development, tests and screenshots; not part of a real
// installation (D-88). Values follow the designed screens: GearDetail, GrinderDetail, BasketDetail,
// PuckPrep, RoutineBuilder, EditSetup and BeanDetail.
import { localDate } from '../../domain/bean';
import type {
  BasketSpec,
  FeatureDefinition,
  FeatureValue,
  GrinderSpec,
  MachineSpec,
  PrepStepSetting
} from '../../domain/schemas';
import { insertBuiltInTags } from './built-in-tags';
import type { Db } from './client';
import { newId } from './ids';
import { appState, bean, gear, prepStep, routine, user, userSettings } from './schema';

const DAY = 86_400_000;
const TIME_ZONE = 'Europe/Copenhagen';

const machineFeatures: FeatureDefinition[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    builtIn: true,
    enabled: true,
    switchable: false,
    value: { kind: 'number', unit: '°C', step: 1000 }
  },
  {
    key: 'flat_pressure',
    label: 'Flat pressure',
    builtIn: true,
    enabled: true,
    switchable: false,
    value: { kind: 'number', unit: 'bar', step: 500 }
  },
  {
    key: 'preinfusion',
    label: 'Preinfusion',
    builtIn: true,
    enabled: true,
    switchable: true,
    value: { kind: 'phase', step: 1000 }
  },
  {
    key: 'low_bar_start',
    label: 'Low bar start',
    builtIn: true,
    enabled: true,
    switchable: true,
    value: { kind: 'phase', step: 1000, pressure: { step: 500, min: 0, max: 12000 } }
  },
  {
    key: 'low_bar_end',
    label: 'Low bar end',
    builtIn: true,
    enabled: true,
    switchable: true,
    value: { kind: 'phase', step: 1000, pressure: { step: 500, min: 0, max: 12000 } }
  }
];

export const REFERENCE = {
  machine: {
    name: 'Lelit Bianca',
    spec: { type: 'semi_auto', groupSizeMm: 58000, features: machineFeatures } satisfies MachineSpec
  },
  grinder: {
    name: 'Timemore 064S',
    spec: {
      type: 'electric',
      burrs: 'flat',
      burrSizeMm: 64000,
      dial: { mode: 'stepless', step: 100, finest: 0, coarsest: 16000 }
    } satisfies GrinderSpec
  },
  basket: {
    name: 'VST 18 g',
    spec: { type: 'precision', shotSize: 'double', diameterMm: 58000 } satisfies BasketSpec
  },
  steps: [
    { name: 'WDT', setting: { kind: 'seconds', step: 1000, startsAt: 20000 } },
    { name: 'Distributor', setting: { kind: 'none' } },
    { name: 'Tamp', setting: { kind: 'number', unit: 'kg', step: 500, startsAt: 15000 } },
    { name: 'Puck screen', setting: { kind: 'none' } }
  ] satisfies { name: string; setting: PrepStepSetting }[],
  myFeatures: {
    temperature: { label: 'Temperature', unit: '°C', on: true, value: 93000 },
    flat_pressure: { label: 'Flat pressure', unit: 'bar', on: true, value: 9000 },
    preinfusion: { label: 'Preinfusion', on: true, value: 4000 },
    low_bar_start: { label: 'Low bar start', on: true, value: 5000, pressure: 2000 },
    low_bar_end: { label: 'Low bar end', on: false }
  } satisfies Record<string, FeatureValue>
} as const;

export type SeededIds = {
  userId: string;
  machineId: string;
  grinderId: string;
  basketId: string;
  routineId: string;
  stepIds: string[];
  beanId: string;
};

/**
 * Creates the reference setup on an empty database: an account, the built-in tags, the reference gear,
 * puck prep, My setup and one open bean roasted 12 days ago. Refuses a database that already has an account.
 */
export function seedReferenceSetup(
  db: Db,
  { now, name, passwordHash }: { now: number; name: string; passwordHash: string }
): SeededIds {
  return db.transaction((tx) => {
    if (tx.select({ id: user.id }).from(user).limit(1).get())
      throw new Error(
        'The database already has an account; the seed only runs on an empty database.'
      );

    const stamps = { createdAt: now, updatedAt: now };
    const userId = newId(now);
    tx.insert(user)
      .values({ id: userId, name, passwordHash, ...stamps })
      .run();
    insertBuiltInTags(tx, userId, now);

    const addGear = (
      kind: 'machine' | 'grinder' | 'basket',
      item: { name: string; spec: object }
    ) => {
      const id = newId(now);
      tx.insert(gear)
        .values({
          id,
          ownerId: userId,
          kind,
          name: item.name,
          spec: item.spec as MachineSpec,
          ...stamps
        })
        .run();
      return id;
    };
    const machineId = addGear('machine', REFERENCE.machine);
    const grinderId = addGear('grinder', REFERENCE.grinder);
    const basketId = addGear('basket', REFERENCE.basket);

    const stepIds = REFERENCE.steps.map((step) => {
      const id = newId(now);
      tx.insert(prepStep)
        .values({ id, ownerId: userId, name: step.name, setting: step.setting, ...stamps })
        .run();
      return id;
    });
    const routineId = newId(now);
    tx.insert(routine)
      .values({
        id: routineId,
        ownerId: userId,
        name: 'Daily routine',
        steps: REFERENCE.steps.map((step, i) => ({
          stepId: stepIds[i],
          value: step.setting.kind === 'none' ? null : step.setting.startsAt
        })),
        ...stamps
      })
      .run();

    tx.insert(userSettings)
      .values({
        userId,
        defaultMachineId: machineId,
        defaultGrinderId: grinderId,
        defaultBasketId: basketId,
        defaultRoutineId: routineId,
        defaultGrind: 1600,
        defaultDose: 18000,
        defaultYield: 36000,
        defaultFeatures: REFERENCE.myFeatures,
        timeZone: TIME_ZONE,
        ...stamps
      })
      .run();

    const beanId = newId(now);
    tx.insert(bean)
      .values({
        id: beanId,
        ownerId: userId,
        name: 'Guji Hambela',
        roaster: 'Nordlys Roasters',
        countryCode: 'ET',
        region: 'Guji',
        variety: 'Heirloom',
        process: 'natural',
        altitudeMinM: 1900,
        altitudeMaxM: 2100,
        roastLevel: 'light',
        roastDate: localDate(now - 12 * DAY, TIME_ZONE),
        ...stamps
      })
      .run();
    tx.insert(appState)
      .values({ userId, currentBeanId: beanId, ...stamps })
      .run();

    return { userId, machineId, grinderId, basketId, routineId, stepIds, beanId };
  });
}
