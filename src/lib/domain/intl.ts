// Shared date formatters. Each Intl.DateTimeFormat holds tens of kilobytes of native ICU memory that
// the garbage collector does not see, so building one per row made the server grow by tens of
// megabytes per page. A formatter depends only on its locale and options, so one of each is kept.

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The formatter for `locale` and `options`, made once and reused. */
export function dateTimeFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const defined = Object.entries(options).filter(([, value]) => value !== undefined);
  const key = locale + JSON.stringify(defined.sort(([a], [b]) => (a < b ? -1 : 1)));
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}
