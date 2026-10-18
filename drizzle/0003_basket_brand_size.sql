-- D-150: a basket is named by brand and size ("VST · 18 g"). Existing baskets are split once: a name that
-- ends in a separate size in grams ("VST 18 g", "IMS E61 18 g") becomes brand "VST" and size 18 g; any other
-- name becomes the brand. Below, substr(name, 1, length(name) - 2) is the name without its " g", and rtrim of
-- that by digits and dots is the brand followed by the space before the size.
UPDATE gear SET
  spec = json_set(
    spec,
    '$.brand', trim(rtrim(substr(name, 1, length(name) - 2), '0123456789.')),
    '$.sizeG', CAST(round(CAST(substr(substr(name, 1, length(name) - 2), length(rtrim(substr(name, 1, length(name) - 2), '0123456789.')) + 1) AS REAL) * 1000) AS INTEGER)
  ),
  name = trim(rtrim(substr(name, 1, length(name) - 2), '0123456789.')) || ' · ' || substr(substr(name, 1, length(name) - 2), length(rtrim(substr(name, 1, length(name) - 2), '0123456789.')) + 1) || ' g'
WHERE kind = 'basket'
  AND json_extract(spec, '$.brand') IS NULL
  AND name LIKE '% g'
  AND rtrim(substr(name, 1, length(name) - 2), '0123456789.') LIKE '% '
  AND trim(rtrim(substr(name, 1, length(name) - 2), '0123456789.')) <> ''
  AND substr(substr(name, 1, length(name) - 2), length(rtrim(substr(name, 1, length(name) - 2), '0123456789.')) + 1) GLOB '[0-9]*';
--> statement-breakpoint
UPDATE gear SET spec = json_set(spec, '$.brand', name)
WHERE kind = 'basket' AND json_extract(spec, '$.brand') IS NULL;
