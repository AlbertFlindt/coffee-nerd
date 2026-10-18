// The bean detail page's recipe rows (D-42, D-128, D-143). Pure, like the rest of the domain.
import { decimalsFor, formatQuantity, type Thousandths } from './units';
import { altitudeText, PROCESS_LABEL, roastDateText, type Process } from './bean';
import { countryName } from './countries';

type Steps = { grind: Thousandths; dose: Thousandths; yield: Thousandths };

/** "Grind 1.6 · 18.0 g → 36.0 g": the yield is the latest shot's, left out without one (D-143). */
export function recipeTitle(
  recipe: { grind: Thousandths; dose: Thousandths; yield: Thousandths | null },
  steps: Steps
): string {
  const grams = (value: Thousandths, step: Thousandths) =>
    formatQuantity(value, { decimals: Math.max(1, decimalsFor(value, step)), unit: 'g' });
  const grind = formatQuantity(recipe.grind, { decimals: decimalsFor(recipe.grind, steps.grind) });
  const core = `Grind ${grind} · ${grams(recipe.dose, steps.dose)}`;
  return recipe.yield === null ? core : `${core} → ${grams(recipe.yield, steps.yield)}`;
}

/** The setup line (D-100), then the average of the times entered: "… · avg 28.0 s" (D-128). */
export function recipeRowDetail(
  setup: string,
  times: readonly (Thousandths | null)[],
  timeStep: Thousandths
): string {
  const entered = times.filter((t): t is Thousandths => t !== null);
  const parts = setup ? [setup] : [];
  if (entered.length > 0) {
    const average = Math.round(entered.reduce((sum, t) => sum + t, 0) / entered.length);
    parts.push(
      `avg ${formatQuantity(average, { decimals: Math.max(1, decimalsFor(average, timeStep)), unit: 's' })}`
    );
  }
  return parts.join(' · ');
}

/** "Reused 4x" in cherry, "Tried once" with a hollow dot (D-42); "New recipe" without shots (D-128). */
export function recipeHistory(shotCount: number): { text: string; reused: boolean } {
  if (shotCount === 0) return { text: 'New recipe', reused: false };
  if (shotCount === 1) return { text: 'Tried once', reused: false };
  return { text: `Reused ${shotCount - 1}x`, reused: true };
}

const ROAST_LEVEL = { light: 'Light', medium_light: 'Med-light', medium: 'Medium', dark: 'Dark' };

/**
 * The about card's lines (D-42): roaster; country · region · process; variety · altitude · roast level;
 * "Roasted 4 Oct · Open". What is not set is left out, and so is a line left empty.
 */
export function aboutLines(
  bean: {
    roaster: string | null;
    countryCode: string | null;
    region: string | null;
    process: Process | null;
    variety: string | null;
    altitudeMinM: number | null;
    altitudeMaxM: number | null;
    roastLevel: keyof typeof ROAST_LEVEL | null;
    roastDate: string;
    status: 'open' | 'finished';
  },
  today: string
): string[] {
  const line = (...parts: (string | null)[]) => parts.filter((p) => p).join(' · ');
  return [
    line(bean.roaster),
    line(
      bean.countryCode ? countryName(bean.countryCode) : null,
      bean.region,
      bean.process ? PROCESS_LABEL[bean.process] : null
    ),
    line(
      bean.variety,
      altitudeText(bean.altitudeMinM, bean.altitudeMaxM),
      bean.roastLevel ? ROAST_LEVEL[bean.roastLevel] : null
    ),
    line(
      `Roasted ${roastDateText(bean.roastDate, today).date}`,
      bean.status === 'open' ? 'Open' : 'Finished'
    )
  ].filter((l) => l !== '');
}
