// Drizzle schema: exactly docs/data-model.md §3. A change here is a change to that document too.
// Quantities are whole thousandths (data-model §1.4), times are UTC milliseconds, ids are UUID v7 text.
// JSON columns are checked with the Zod schemas in src/lib/domain/schemas.ts before they are written.
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';
import type {
  BasketSpec,
  FeatureValue,
  GrinderSpec,
  MachineSpec,
  PrepStepSetting,
  RoutineSteps,
  SetupSnapshot
} from '../../domain/schemas';

const id = () => text('id').primaryKey();
const timestamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
};
const owner = () =>
  text('owner_id')
    .notNull()
    .references(() => user.id);
/** Library items: owned, shareable later (D-60), archived instead of deleted (data-model §1.7). */
const libraryItem = () => ({
  ownerId: owner(),
  shared: integer('shared', { mode: 'boolean' }).notNull().default(false),
  archivedAt: integer('archived_at')
});

export const user = sqliteTable('user', {
  id: id(),
  name: text('name').notNull(),
  email: text('email'), // optional, unused for now (D-85)
  passwordHash: text('password_hash').notNull(),
  ...timestamps
});

/** Sign-in sessions (D-86). `id` is the SHA-256 of the cookie token; the token itself is never stored. */
export const session = sqliteTable(
  'session',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
    ...timestamps
  },
  (t) => [index('session_user').on(t.userId)]
);

/** My setup (D-38, D-45): starting values for a bean's first shot. Empty until set up (D-88). */
export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id),
  defaultMachineId: text('default_machine_id').references(() => gear.id),
  defaultGrinderId: text('default_grinder_id').references(() => gear.id),
  defaultBasketId: text('default_basket_id').references(() => gear.id),
  defaultRoutineId: text('default_routine_id').references(() => routine.id),
  defaultGrind: integer('default_grind'),
  defaultDose: integer('default_dose'),
  defaultYield: integer('default_yield'),
  defaultFeatures: text('default_features', { mode: 'json' })
    .$type<Record<string, FeatureValue>>()
    .notNull()
    .default(sql`'{}'`),
  timeZone: text('time_zone').notNull(),
  /** −/+ steps on the shot form and Edit My setup, per user (D-89): 0.1 g, 0.1 g and 1 s by default. */
  doseStep: integer('dose_step').notNull().default(100),
  yieldStep: integer('yield_step').notNull().default(100),
  timeStep: integer('time_step').notNull().default(1000),
  ...timestamps
});

/** Fast-changing state: Home's bean, Brew next (one column, so only one mark, D-43), last graph. */
export const appState = sqliteTable('app_state', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id),
  currentBeanId: text('current_bean_id').references(() => bean.id),
  brewNextRecipeId: text('brew_next_recipe_id').references(() => recipe.id),
  homeGraph: text('home_graph'),
  /** The step-by-step start's basket step was skipped (D-157), so it is not asked again. */
  basketStepSkipped: integer('basket_step_skipped', { mode: 'boolean' }).notNull().default(false),
  ...timestamps
});

export const bean = sqliteTable(
  'bean',
  {
    id: id(),
    ownerId: owner(),
    shared: integer('shared', { mode: 'boolean' }).notNull().default(false),
    rebuyOfId: text('rebuy_of_id').references((): ReturnType<typeof text> => bean.id),
    name: text('name').notNull(),
    roaster: text('roaster'),
    region: text('region'),
    variety: text('variety'),
    countryCode: text('country_code'),
    process: text('process', { enum: ['washed', 'natural', 'honey', 'anaerobic', 'other'] }),
    altitudeMinM: integer('altitude_min_m'),
    altitudeMaxM: integer('altitude_max_m'),
    roastLevel: text('roast_level', { enum: ['light', 'medium_light', 'medium', 'dark'] }),
    roastDate: text('roast_date').notNull(), // calendar date, YYYY-MM-DD
    bagWeight: integer('bag_weight'),
    status: text('status', { enum: ['open', 'finished'] })
      .notNull()
      .default('open'),
    finishedAt: integer('finished_at'),
    finishedAutomatically: integer('finished_automatically', { mode: 'boolean' })
      .notNull()
      .default(false),
    ...timestamps
  },
  (t) => [index('bean_owner').on(t.ownerId)]
);

/** Machines, grinders and baskets in one table, each with a spec for its kind (D-39, D-68). */
export const gear = sqliteTable(
  'gear',
  {
    id: id(),
    ...libraryItem(),
    kind: text('kind', { enum: ['machine', 'grinder', 'basket'] }).notNull(),
    name: text('name').notNull(),
    spec: text('spec', { mode: 'json' }).$type<MachineSpec | GrinderSpec | BasketSpec>().notNull(),
    ...timestamps
  },
  (t) => [index('gear_owner').on(t.ownerId)]
);

export const prepStep = sqliteTable(
  'prep_step',
  {
    id: id(),
    ...libraryItem(),
    name: text('name').notNull(),
    setting: text('setting', { mode: 'json' }).$type<PrepStepSetting>().notNull(),
    ...timestamps
  },
  (t) => [index('prep_step_owner').on(t.ownerId)]
);

/** A straight line of steps with their values (D-51). */
export const routine = sqliteTable(
  'routine',
  {
    id: id(),
    ...libraryItem(),
    name: text('name').notNull(),
    steps: text('steps', { mode: 'json' }).$type<RoutineSteps>().notNull(),
    ...timestamps
  },
  (t) => [index('routine_owner').on(t.ownerId)]
);

/** What you set (D-13, D-63). Never edited; the database allows one recipe per identical setup. */
export const recipe = sqliteTable(
  'recipe',
  {
    id: id(),
    ownerId: owner(),
    method: text('method', { enum: ['espresso'] })
      .notNull()
      .default('espresso'),
    beanId: text('bean_id')
      .notNull()
      .references(() => bean.id),
    machineId: text('machine_id')
      .notNull()
      .references(() => gear.id),
    grinderId: text('grinder_id')
      .notNull()
      .references(() => gear.id),
    basketId: text('basket_id').references(() => gear.id),
    routineId: text('routine_id').references(() => routine.id),
    grind: integer('grind').notNull(),
    dose: integer('dose').notNull(),
    setup: text('setup', { mode: 'json' }).$type<SetupSnapshot>().notNull(),
    fingerprint: text('fingerprint').notNull(),
    ...timestamps
  },
  (t) => [uniqueIndex('recipe_identity').on(t.ownerId, t.beanId, t.machineId, t.fingerprint)]
);

/** What you got (D-13). Taste is null when not rated or not set, never 0 (D-11). */
export const shot = sqliteTable(
  'shot',
  {
    id: id(), // may be made on the phone (offline queue, D-61)
    ownerId: owner(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipe.id),
    brewedAt: integer('brewed_at').notNull(),
    yield: integer('yield'), // empty = not set; a shot may be saved without it (D-82, D-91)
    time: integer('time'), // empty = not set; a shot may be saved without it (D-72, D-91)
    score: integer('score'),
    balance: integer('balance'),
    body: integer('body'),
    sweetness: integer('sweetness'),
    aftertaste: integer('aftertaste'),
    notes: text('notes'),
    ...timestamps
  },
  (t) => [index('shot_owner_brewed').on(t.ownerId, t.brewedAt), index('shot_recipe').on(t.recipeId)]
);

/** Flavor notes in fixed families (D-53). Names are unique per owner, ignoring case. */
export const tag = sqliteTable(
  'tag',
  {
    id: id(),
    ownerId: owner(),
    shared: integer('shared', { mode: 'boolean' }).notNull().default(false),
    name: text('name').notNull(),
    family: text('family', {
      enum: ['fruity', 'sweet', 'floral', 'nutty_roasty', 'other']
    }).notNull(),
    builtIn: integer('built_in', { mode: 'boolean' }).notNull().default(false),
    /** Removed while shots used it (D-171): off the Tasting chips and the Tags page, kept on its shots. */
    archivedAt: integer('archived_at'),
    ...timestamps
  },
  (t) => [uniqueIndex('tag_owner_name').on(t.ownerId, sql`lower(${t.name})`)]
);

/** Two notes the duplicate finder no longer suggests merging, after "Keep both" (D-173); lower id first. */
export const tagPairKept = sqliteTable(
  'tag_pair_kept',
  {
    ownerId: owner(),
    tagId: text('tag_id')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
    otherTagId: text('other_tag_id')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.tagId, t.otherTagId] })]
);

/**
 * A note merged into another (D-53): kept so a shot saved later with the old id gets the note it went
 * into (D-182). No foreign key: the merged note is gone, and the kept one may be merged in turn.
 */
export const tagMerged = sqliteTable('tag_merged', {
  tagId: text('tag_id').primaryKey(),
  ownerId: owner(),
  intoTagId: text('into_tag_id').notNull()
});

export const shotTag = sqliteTable(
  'shot_tag',
  {
    shotId: text('shot_id')
      .notNull()
      .references(() => shot.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tag.id)
  },
  (t) => [primaryKey({ columns: [t.shotId, t.tagId] }), index('shot_tag_tag').on(t.tagId)]
);
