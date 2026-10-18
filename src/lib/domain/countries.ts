// The fixed country list behind the Country picker (D-41, D-133): ISO 3166-1 two-letter codes, named in
// English by the runtime's own data, so no list is fetched (no external requests).

/** Every ISO 3166-1 alpha-2 country code. */
export const COUNTRY_CODES: readonly string[] = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV ' +
  'BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ' +
  'ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE ' +
  'IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY ' +
  'MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU ' +
  'NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM ' +
  'SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE ' +
  'VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

const known = new Set(COUNTRY_CODES);
const names = new Intl.DisplayNames(['en'], { type: 'region' });

/** The English name of a country code ("ET" → "Ethiopia"); null for a code not on the list. */
export function countryName(code: string): string | null {
  return known.has(code) ? (names.of(code) ?? null) : null;
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const ALL = COUNTRY_CODES.map((code) => ({ code, name: countryName(code)! })).sort((a, b) =>
  a.name.localeCompare(b.name, 'en')
);

/** Countries A to Z whose name contains the search, ignoring case and accents (D-133). */
export function searchCountries(search: string): { code: string; name: string }[] {
  const wanted = fold(search.trim());
  return wanted === '' ? ALL : ALL.filter((c) => fold(c.name).includes(wanted));
}
