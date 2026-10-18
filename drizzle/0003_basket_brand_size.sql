-- D-150: a basket is named by brand and size ("VST · 18 g"). Existing baskets are split once: a name that
-- ends in a size in grams ("VST 18 g") becomes brand "VST" and size 18 g; any other name becomes the brand.
UPDATE gear SET
  spec = json_set(
    spec,
    '$.brand', trim(rtrim(name, '0123456789. g')),
    '$.sizeG', CAST(round(CAST(replace(trim(substr(name, length(rtrim(name, '0123456789. g')) + 1)), ' g', '') AS REAL) * 1000) AS INTEGER)
  ),
  name = trim(rtrim(name, '0123456789. g')) || ' · ' || trim(substr(name, length(rtrim(name, '0123456789. g')) + 1))
WHERE kind = 'basket'
  AND json_extract(spec, '$.brand') IS NULL
  AND name LIKE '% g'
  AND trim(rtrim(name, '0123456789. g')) <> ''
  AND trim(substr(name, length(rtrim(name, '0123456789. g')) + 1)) GLOB '[0-9]*';
--> statement-breakpoint
UPDATE gear SET spec = json_set(spec, '$.brand', name)
WHERE kind = 'basket' AND json_extract(spec, '$.brand') IS NULL;
