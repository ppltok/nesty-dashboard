/**
 * Shared tier definitions used across the Funnel and Overview pages.
 *
 * Source of truth: Nesty-Obsidian/Product/User-Tiers.md.
 * If a definition changes there, change it here too.
 *
 * Each tier exposes:
 *   - label: display name (English, internal only)
 *   - criteria: short rule shown next to the label so a developer never
 *               has to look up "what counts as Active" — it's right there
 *   - description: one-line context for why this tier matters
 *   - color: chart/bar fill colour
 */
import type { TierName } from '@/types/dashboard'

export interface TierDef {
  label: string
  criteria: string
  description: string
  color: string
}

export const TIER_META: Record<TierName, TierDef> = {
  user: {
    label: 'User',
    criteria: '0 items',
    description: 'Signed up but never added anything',
    color: '#94a3b8',
  },
  started: {
    label: 'Started',
    criteria: '≥1 item',
    description: 'Mostly the forced-onboarding first item',
    color: '#60a5fa',
  },
  active: {
    label: 'Active',
    criteria: '≥2 items',
    description: 'First real return-engagement signal',
    color: '#34d399',
  },
  super: {
    label: 'Super user',
    criteria: '≥5 items',
    description: 'Meaningful registry-building intent',
    color: '#fbbf24',
  },
  champion: {
    label: 'Champion',
    criteria: '≥1 item received',
    description: 'Real outcome — something reached the baby',
    color: '#f472b6',
  },
}

/** Tier display ordering (User → Champion). */
export const TIER_ORDER: TierName[] = ['user', 'started', 'active', 'super', 'champion']
