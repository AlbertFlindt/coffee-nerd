// A shot history for Insights' screenshots and tests (screens 23–25): 214 shots on 9 beans
// over the last 13 weeks, 96 of them rated, shaped like the designed numbers (more rated naturals and
// Ethiopians, scores rising and steadying over time, a Light roast routine on Guji's best recipe).
// Development and screenshots only, like the reference setup. Deterministic: the same `now`
// always gives the same history.
import { localDate } from '../../domain/bean';
import type { SetupSnapshot } from '../../domain/schemas';
import type { Db } from './client';
import { newId } from './ids';
import { bean, routine } from './schema';
import { REFERENCE, type SeededIds } from './seed';
import { saveShot } from './shots';
import { and, eq, ne } from 'drizzle-orm';

const DAY = 86_400_000;
const TIME_ZONE = 'Europe/Copenhagen';
const WEEKS = 13;

type HistoryBean = {
  name: string;
  roaster: string;
  countryCode: string;
  process: 'washed' | 'natural' | 'honey' | null;
  shots: number;
  rated: number;
  /** The bean's typical score, before the trend over time. */
  score: number;
  /** How widely its scores vary, against the usual noise: Ethiopians vary least (screen 23). */
  spread: number;
};

/** Rated shots per origin and process add up to screens 23's groups: 41/22/18/15 and 38/12/36. */
const BEANS: readonly HistoryBean[] = [
  {
    name: 'Yirgacheffe Konga',
    roaster: 'Nordlys Roasters',
    countryCode: 'ET',
    process: 'washed',
    shots: 18,
    rated: 9,
    score: 7.8,
    spread: 1.5
  },
  {
    name: 'Sidama Bensa',
    roaster: 'Nordlys Roasters',
    countryCode: 'ET',
    process: 'honey',
    shots: 15,
    rated: 7,
    score: 7.3,
    spread: 0.9
  },
  {
    name: 'Kiambu AA',
    roaster: 'Kaffeværket',
    countryCode: 'KE',
    process: 'washed',
    shots: 26,
    rated: 14,
    score: 7.3,
    spread: 1.3
  },
  {
    name: 'Nyeri Karatina',
    roaster: 'Kaffeværket',
    countryCode: 'KE',
    process: 'natural',
    shots: 16,
    rated: 8,
    score: 8,
    spread: 1.3
  },
  {
    name: 'Huila',
    roaster: 'Prolog',
    countryCode: 'CO',
    process: 'washed',
    shots: 25,
    rated: 13,
    score: 6.6,
    spread: 1.3
  },
  {
    name: 'Nariño',
    roaster: 'Prolog',
    countryCode: 'CO',
    process: 'honey',
    shots: 12,
    rated: 5,
    score: 6.8,
    spread: 1.3
  },
  {
    name: 'Cerrado',
    roaster: 'Coffee Collective',
    countryCode: 'BR',
    process: 'natural',
    shots: 12,
    rated: 5,
    score: 7,
    spread: 1.3
  },
  {
    name: 'Mogiana',
    roaster: 'Coffee Collective',
    countryCode: 'BR',
    process: null,
    shots: 20,
    rated: 10,
    score: 6.2,
    spread: 1.3
  }
];
/** The reference bean: the most shots, the last ones, and the recipes Dial-in and Comparisons need. */
const GUJI = { shots: 70, rated: 25, score: 8.2, spread: 0.3 };

/** mulberry32: a small seeded generator, so the history is the same every time. */
function generator(seed: number) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Box–Muller: a standard normal value.
  const normal = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return { next, normal };
}

/**
 * Adds the history to a database made by `seedReferenceSetup`. The other beans end finished; Guji
 * Hambela stays open and is the bean on Home.
 */
export function seedShotHistory(db: Db, ids: SeededIds, now: number): void {
  const random = generator(9);
  const start = now - WEEKS * 7 * DAY;

  // A second routine for Guji's best recipe: the same steps, firmer (screen 25).
  const lightRoast = newId(start);
  db.insert(routine)
    .values({
      id: lightRoast,
      ownerId: ids.userId,
      name: 'Light roast',
      steps: [
        { stepId: ids.stepIds[0], value: 30000 },
        { stepId: ids.stepIds[1], value: null },
        { stepId: ids.stepIds[2], value: 20000 },
        { stepId: ids.stepIds[3], value: null }
      ],
      createdAt: start,
      updatedAt: start
    })
    .run();
  const routineSnapshot = (id: string): SetupSnapshot['routine'] =>
    id === lightRoast
      ? {
          name: 'Light roast',
          steps: [
            { stepId: ids.stepIds[0], name: 'WDT', unit: 's', value: 30000 },
            { stepId: ids.stepIds[1], name: 'Distributor', value: null },
            { stepId: ids.stepIds[2], name: 'Tamp', unit: 'kg', value: 20000 },
            { stepId: ids.stepIds[3], name: 'Puck screen', value: null }
          ]
        }
      : {
          name: 'Daily routine',
          steps: [
            { stepId: ids.stepIds[0], name: 'WDT', unit: 's', value: 20000 },
            { stepId: ids.stepIds[1], name: 'Distributor', value: null },
            { stepId: ids.stepIds[2], name: 'Tamp', unit: 'kg', value: 15000 },
            { stepId: ids.stepIds[3], name: 'Puck screen', value: null }
          ]
        };

  // Each shot's bean, in brewing order: the other beans spread over the weeks, Guji throughout and last.
  const order: (HistoryBean | null)[] = [];
  for (const b of BEANS) for (let i = 0; i < b.shots; i++) order.push(b);
  for (let i = 0; i < GUJI.shots - 12; i++) order.push(null);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 0; i < 12; i++) order.push(null);

  // Which shots are rated: per bean, spread over its shots.
  const ratedLeft = new Map<HistoryBean | null, { shots: number; rated: number }>([
    ...BEANS.map((b) => [b, { shots: b.shots, rated: b.rated }] as const),
    [null, { ...GUJI }]
  ]);

  const beanIds = new Map<HistoryBean, string>();
  let gujiShot = 0;
  order.forEach((b, i) => {
    // Mornings, about 2.4 shots a day, over the 13 weeks up to an hour before `now`.
    const brewedAt = Math.round(start + ((i + 1) / (order.length + 1)) * (now - start - 3_600_000));
    let beanId = ids.beanId;
    if (b) {
      let id = beanIds.get(b);
      if (!id) {
        id = newId(brewedAt);
        db.insert(bean)
          .values({
            id,
            ownerId: ids.userId,
            name: b.name,
            roaster: b.roaster,
            countryCode: b.countryCode,
            process: b.process,
            roastLevel: 'light',
            roastDate: localDate(brewedAt - 7 * DAY, TIME_ZONE),
            createdAt: brewedAt,
            updatedAt: brewedAt
          })
          .run();
        beanIds.set(b, id);
      }
      beanId = id;
    }

    const left = ratedLeft.get(b)!;
    const rated = random.next() < left.rated / left.shots;
    left.shots -= 1;
    if (rated) left.rated -= 1;

    // Over the weeks scores rise 1.4 points and steady (screen 24); finer grinds run slower.
    const progress = i / order.length;
    const typical = (b?.score ?? GUJI.score) - 0.9 + 1.4 * progress;
    const score = Math.min(
      10,
      Math.max(
        1,
        Math.round(typical + random.normal() * (b ?? GUJI).spread * (0.9 - 0.45 * progress))
      )
    );

    // Guji: mostly its best recipe (grind 1.6) with the Daily routine, some 1.5 and 1.7, and every
    // fifth best-recipe shot with the Light roast routine (screen 25).
    let grind = 1600;
    let routineId = ids.routineId;
    if (!b) {
      gujiShot += 1;
      if (gujiShot % 7 === 3) grind = 1500;
      else if (gujiShot % 7 === 5) grind = 1700;
      else if (gujiShot % 5 === 0) routineId = lightRoast;
    } else if (random.next() < 0.3) grind = random.next() < 0.5 ? 1500 : 1700;
    // Guji's 1.5 and 1.7 taste a point less, so 1.6 stays its best recipe by average.
    const tasted = !b && grind !== 1600 ? Math.max(1, score - 1) : score;
    const time =
      Math.round(
        (27.9 + (1600 - grind) / 25 + random.normal() * (routineId === lightRoast ? 2.1 : 1.4)) * 10
      ) * 100;

    saveShot(
      db,
      ids.userId,
      {
        id: newId(brewedAt),
        beanId,
        machineId: ids.machineId,
        grinderId: ids.grinderId,
        basketId: ids.basketId,
        routineId,
        grind,
        dose: 18000,
        setup: { features: { ...REFERENCE.myFeatures }, routine: routineSnapshot(routineId) },
        yield: 36000 + Math.round(random.normal() * 8) * 100,
        time,
        taste: rated
          ? { score: tasted, balance: 0, body: null, sweetness: null, aftertaste: null }
          : { score: null, balance: null, body: null, sweetness: null, aftertaste: null },
        tagIds: [],
        notes: null,
        brewedAt
      },
      brewedAt
    );
  });

  // Guji Hambela was roasted a week before its first shot here; the other bags are used up, and Guji
  // Hambela is the one open bean, as on Home.
  db.update(bean)
    .set({ roastDate: localDate(start - 7 * DAY, TIME_ZONE) })
    .where(eq(bean.id, ids.beanId))
    .run();
  db.update(bean)
    .set({ status: 'finished', finishedAt: now - DAY, updatedAt: now - DAY })
    .where(and(eq(bean.ownerId, ids.userId), ne(bean.id, ids.beanId)))
    .run();
}
