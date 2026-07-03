/**
 * Region registry — regions are selected with `--region=<id>` on the CLI.
 * Each RegionConfig carries timezone, country, bbox, city fallback coords,
 * the curated venue registry, precision policy and the source list.
 */
import type { RegionConfig } from '../types.ts'
import { TENERIFE } from './tenerife.ts'

export const REGIONS: Record<string, RegionConfig> = {
  tenerife: TENERIFE,
}
