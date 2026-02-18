-- Migration: Update existing class_packages prices to match the new pricing formula.
-- For teachers with NULL custom markup columns, defaults apply:
--   10-session: base × 1.15, MROUND 50
--   20-session: base × 1.10, MROUND 50
--   30-session: base × 1.05, MROUND 50
--
-- Formula: new_price = ROUND(base_price * multiplier / 50) * 50 * classes_count
--
-- Only updates packages where a matching beginner tier exists
-- (same logic that created the originals during onboarding).

-- First, let's see what would change (dry run)
-- SELECT t.name, cp.classes_count, cp.price AS old_price,
--        CASE cp.classes_count
--          WHEN 10 THEN ROUND(tit.price_inr * 1.15 / 50) * 50 * 10
--          WHEN 20 THEN ROUND(tit.price_inr * 1.10 / 50) * 50 * 20
--          WHEN 30 THEN ROUND(tit.price_inr * 1.05 / 50) * 50 * 30
--        END AS new_price
-- FROM class_packages cp
-- JOIN teachers t ON t.id = cp.teacher_id
-- JOIN teacher_instruments ti ON ti.teacher_id = t.id AND ti.teach_or_perform = 'teach'
-- JOIN teacher_instrument_tiers tit ON tit.teacher_instrument_id = ti.id AND tit.level = 'beginner'
-- WHERE t.custom_markup_pct_10 IS NULL  -- only teachers using defaults
-- ORDER BY t.name, cp.classes_count;

-- Actual update using a CTE to find the min beginner base price per teacher
WITH teacher_base AS (
  SELECT ti.teacher_id,
         MIN(tit.price_inr) AS base_price
  FROM teacher_instruments ti
  JOIN teacher_instrument_tiers tit ON tit.teacher_instrument_id = ti.id
  WHERE LOWER(ti.teach_or_perform) = 'teach'
    AND tit.level = 'beginner'
  GROUP BY ti.teacher_id
)
UPDATE class_packages cp
SET price = CASE cp.classes_count
              WHEN 10 THEN ROUND(tb.base_price * 1.15 / 50) * 50 * 10
              WHEN 20 THEN ROUND(tb.base_price * 1.10 / 50) * 50 * 20
              WHEN 30 THEN ROUND(tb.base_price * 1.05 / 50) * 50 * 30
              ELSE cp.price  -- leave unchanged if somehow not 10/20/30
            END
FROM teacher_base tb
JOIN teachers t ON t.id = tb.teacher_id
WHERE cp.teacher_id = tb.teacher_id
  AND t.custom_markup_pct_10 IS NULL  -- only teachers using defaults (no admin overrides)
  AND cp.classes_count IN (10, 20, 30);
