import { getTransitiveClosureRuntime, TransitiveDependencyNode } from '../db/queries/dependencyGraph.js';
import { getPgPool } from '../db/index.js';

class ClosureCache {
  private cache = new Map<string, { timestamp: number; data: TransitiveDependencyNode[] }>();
  private readonly ttlMs = 60000; // 1 minute TTL

  get(rootVersionId: string): TransitiveDependencyNode[] | null {
    const entry = this.cache.get(rootVersionId);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(rootVersionId);
      return null;
    }
    return entry.data;
  }

  set(rootVersionId: string, data: TransitiveDependencyNode[]): void {
    this.cache.set(rootVersionId, { timestamp: Date.now(), data });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const closureCache = new ClosureCache();

/**
 * Strategy-pattern method to fetch transitive dependency closure.
 */
export async function getTransitiveClosure(
  rootVersionId: string,
  strategy: 'runtime_cte' | 'materialized' | 'cached' = 'runtime_cte'
): Promise<TransitiveDependencyNode[]> {
  if (strategy === 'cached') {
    const cached = closureCache.get(rootVersionId);
    if (cached) return cached;

    const data = await getTransitiveClosureRuntime(rootVersionId);
    closureCache.set(rootVersionId, data);
    return data;
  }

  if (strategy === 'materialized') {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT
        mc.descendant_version_id AS package_version_id,
        pv.package_id,
        p.name AS package_name,
        pv.version,
        mc.depth
      FROM materialized_closures mc
      JOIN package_versions pv ON pv.id = mc.descendant_version_id
      JOIN packages p ON p.id = pv.package_id
      WHERE mc.root_version_id = $1
      ORDER BY mc.depth ASC;
    `, [rootVersionId]);

    if (result.rows.length === 0) {
      // Fallback to runtime CTE if materialized row not populated
      return await getTransitiveClosureRuntime(rootVersionId);
    }
    return result.rows.map(r => ({ ...r, path: [] }));
  }

  return await getTransitiveClosureRuntime(rootVersionId);
}
