/**
 * Shared pricing utility for Maestera backend.
 *
 * Standard formula:
 *   ≤9 sessions (1:1)  → base × (1 + singleMarkup%/100)  → MROUND(rounding1v1)
 *   10-19 sessions      → base × (1 + markup10%/100)      → MROUND(rounding10)
 *   20-29 sessions      → base × (1 + markup20%/100)      → MROUND(rounding20)
 *   30+ sessions        → base × (1 + markup30%/100)      → MROUND(rounding30)
 *
 * Defaults:
 *   singleMarkup = 20%  |  markup10 = 15%  |  markup20 = 10%  |  markup30 = 5%
 *   rounding1v1  = 25   |  rounding10 = 50  |  rounding20 = 50  |  rounding30 = 50
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_MARKUP_PCT = {
  single: 20,
  tier10: 15,
  tier20: 10,
  tier30: 5,
} as const

export const DEFAULT_ROUNDING = {
  single: 25,
  tier10: 50,
  tier20: 50,
  tier30: 50,
} as const

// ── Types ────────────────────────────────────────────────────────────────────

export interface PricingConfig {
  markupPctSingle?: number | null
  markupPct10?: number | null
  markupPct20?: number | null
  markupPct30?: number | null
  roundingSingle?: number | null
  rounding10?: number | null
  rounding20?: number | null
  rounding30?: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Excel-style MROUND: rounds `value` to the nearest `multiple`. */
export function mround(value: number, multiple: number): number {
  if (multiple === 0) return value
  return Math.round(value / multiple) * multiple
}

function resolve(val: number | null | undefined, fallback: number): number {
  return val !== null && val !== undefined ? val : fallback
}

// ── Price Computation ────────────────────────────────────────────────────────

export function getMarkupPctForSessions(sessions: number, config?: PricingConfig): number {
  if (sessions >= 30) return resolve(config?.markupPct30, DEFAULT_MARKUP_PCT.tier30)
  if (sessions >= 20) return resolve(config?.markupPct20, DEFAULT_MARKUP_PCT.tier20)
  if (sessions >= 10) return resolve(config?.markupPct10, DEFAULT_MARKUP_PCT.tier10)
  return resolve(config?.markupPctSingle, DEFAULT_MARKUP_PCT.single)
}

export function getRoundingForSessions(sessions: number, config?: PricingConfig): number {
  if (sessions >= 30) return resolve(config?.rounding30, DEFAULT_ROUNDING.tier30)
  if (sessions >= 20) return resolve(config?.rounding20, DEFAULT_ROUNDING.tier20)
  if (sessions >= 10) return resolve(config?.rounding10, DEFAULT_ROUNDING.tier10)
  return resolve(config?.roundingSingle, DEFAULT_ROUNDING.single)
}

/** Compute the per-class price for a package of `sessions` sessions. */
export function computePerClassPrice(basePrice: number, sessions: number, config?: PricingConfig): number {
  const pct = getMarkupPctForSessions(sessions, config)
  const rnd = getRoundingForSessions(sessions, config)
  return mround(basePrice * (1 + pct / 100), rnd)
}

/** Compute the total package price = per-class × sessions. */
export function computeTotalPrice(basePrice: number, sessions: number, config?: PricingConfig): number {
  return computePerClassPrice(basePrice, sessions, config) * sessions
}

/** Compute the auto "starting at" price (lowest per-class = 30-session tier). */
export function computeStartingPrice(basePrice: number, config?: PricingConfig): number {
  return computePerClassPrice(basePrice, 30, config)
}

/** Build a PricingConfig from a teacher's custom columns (Prisma Decimal types). */
export function buildPricingConfig(teacher: any): PricingConfig | null {
  const pctSingle = teacher.custom_markup_pct_single != null ? Number(teacher.custom_markup_pct_single) : null
  const pct10 = teacher.custom_markup_pct_10 != null ? Number(teacher.custom_markup_pct_10) : null
  const pct20 = teacher.custom_markup_pct_20 != null ? Number(teacher.custom_markup_pct_20) : null
  const pct30 = teacher.custom_markup_pct_30 != null ? Number(teacher.custom_markup_pct_30) : null
  const rndSingle = teacher.custom_rounding_single != null ? Number(teacher.custom_rounding_single) : null
  const rnd10 = teacher.custom_rounding_10 != null ? Number(teacher.custom_rounding_10) : null
  const rnd20 = teacher.custom_rounding_20 != null ? Number(teacher.custom_rounding_20) : null
  const rnd30 = teacher.custom_rounding_30 != null ? Number(teacher.custom_rounding_30) : null

  if (pctSingle == null && pct10 == null && pct20 == null && pct30 == null && rndSingle == null && rnd10 == null && rnd20 == null && rnd30 == null) {
    return null
  }

  return {
    markupPctSingle: pctSingle,
    markupPct10: pct10,
    markupPct20: pct20,
    markupPct30: pct30,
    roundingSingle: rndSingle,
    rounding10: rnd10,
    rounding20: rnd20,
    rounding30: rnd30,
  }
}
