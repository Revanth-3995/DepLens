import { getPgPool } from '../index.js';
import pg from 'pg';

export interface TransitiveDependencyNode {
  package_version_id: string;
  package_id: string;
  package_name: string;
  version: string;
  depth: number;
  path: string[];
}

export interface DependencyPathResult {
  targetPackage: string;
  targetVersion: string;
  paths: string[][];
}

/**
 * Executes a PostgreSQL Recursive CTE to find all transitive dependencies starting from a root package version.
 * Includes cycle protection via array containment check.
 */
export async function getTransitiveClosureRuntime(
  rootVersionId: string,
  clientRunner?: pg.Pool | pg.PoolClient
): Promise<TransitiveDependencyNode[]> {
  const runner = clientRunner || getPgPool();
  const query = `
    WITH RECURSIVE dependency_tree AS (
      -- Anchor member: direct dependencies of the root version
      SELECT
        e.target_package_id,
        pv.id AS package_version_id,
        p.name AS package_name,
        pv.version,
        1 AS depth,
        ARRAY[e.source_version_id, pv.id]::uuid[] AS visited_versions,
        ARRAY[p.name]::text[] AS visited_names
      FROM dependency_edges e
      JOIN packages p ON p.id = e.target_package_id
      JOIN package_versions pv ON pv.package_id = p.id
        AND pv.version = REPLACE(REPLACE(REPLACE(e.version_requirement, '^', ''), '~', ''), '>=', '')
      WHERE e.source_version_id = $1

      UNION ALL

      -- Recursive member: dependencies of dependencies
      SELECT
        e.target_package_id,
        pv.id AS package_version_id,
        p.name AS package_name,
        pv.version,
        dt.depth + 1 AS depth,
        dt.visited_versions || pv.id,
        dt.visited_names || p.name::text
      FROM dependency_tree dt
      JOIN dependency_edges e ON e.source_version_id = dt.package_version_id
      JOIN packages p ON p.id = e.target_package_id
      JOIN package_versions pv ON pv.package_id = p.id
        AND pv.version = REPLACE(REPLACE(REPLACE(e.version_requirement, '^', ''), '~', ''), '>=', '')
      WHERE NOT (pv.id = ANY(dt.visited_versions))
        AND dt.depth < 20
    )
    SELECT DISTINCT ON (package_version_id)
      package_version_id,
      target_package_id AS package_id,
      package_name,
      version,
      depth,
      visited_names AS path
    FROM dependency_tree
    ORDER BY package_version_id, depth ASC;
  `;

  const result = await runner.query(query, [rootVersionId]);
  return result.rows;
}

/**
 * Finds all paths from direct dependencies of a project scan down to a specific target package.
 */
export async function getDependencyPathsForScan(
  projectName: string,
  scanId: string,
  targetPackageName: string,
  clientRunner?: pg.Pool | pg.PoolClient
): Promise<string[][]> {
  const runner = clientRunner || getPgPool();
  const query = `
    WITH RECURSIVE scan_paths AS (
      -- Anchor: Direct dependencies in the scan
      SELECT
        pv.id AS current_version_id,
        p.id AS current_package_id,
        p.name AS current_package_name,
        ARRAY[ $1::text, p.name::text ]::text[] AS path,
        ARRAY[ pv.id ]::uuid[] AS visited_versions
      FROM scan_dependencies sd
      JOIN package_versions pv ON pv.id = sd.package_version_id
      JOIN packages p ON p.id = pv.package_id
      WHERE sd.scan_id = $2 AND sd.is_direct = TRUE

      UNION ALL

      -- Recursive traversal down dependency edges
      SELECT
        pv.id AS current_version_id,
        p.id AS current_package_id,
        p.name AS current_package_name,
        sp.path || p.name::text AS path,
        sp.visited_versions || pv.id AS visited_versions
      FROM scan_paths sp
      JOIN dependency_edges e ON e.source_version_id = sp.current_version_id
      JOIN packages p ON p.id = e.target_package_id
      JOIN package_versions pv ON pv.package_id = p.id
      WHERE NOT (pv.id = ANY(sp.visited_versions))
        AND array_length(sp.path, 1) < 15
    )
    SELECT DISTINCT path
    FROM scan_paths
    WHERE current_package_name = $3;
  `;

  const result = await runner.query(query, [projectName, scanId, targetPackageName]);

  if (result.rows.length === 0) {
    // If targetPackage is itself a direct dependency
    const directCheck = await runner.query(`
      SELECT p.name
      FROM scan_dependencies sd
      JOIN package_versions pv ON pv.id = sd.package_version_id
      JOIN packages p ON p.id = pv.package_id
      WHERE sd.scan_id = $1 AND p.name = $2
    `, [scanId, targetPackageName]);

    if (directCheck.rows.length > 0) {
      return [[projectName, targetPackageName]];
    }
  }

  return result.rows.map(r => r.path);
}

/**
 * Populates or rebuilds the materialized closures table for a root version (Experiment B).
 */
export async function populateMaterializedClosure(
  rootVersionId: string,
  clientRunner?: pg.Pool | pg.PoolClient
): Promise<number> {
  const runner = clientRunner || getPgPool();
  await runner.query('DELETE FROM materialized_closures WHERE root_version_id = $1', [rootVersionId]);

  const insertQuery = `
    WITH RECURSIVE dependency_tree AS (
      SELECT
        $1::uuid AS root_version_id,
        e.source_version_id AS ancestor_version_id,
        pv.id AS descendant_version_id,
        1 AS depth,
        ARRAY[e.source_version_id, pv.id]::uuid[] AS path_array
      FROM dependency_edges e
      JOIN packages p ON p.id = e.target_package_id
      JOIN package_versions pv ON pv.package_id = p.id
        AND pv.version = REPLACE(REPLACE(REPLACE(e.version_requirement, '^', ''), '~', ''), '>=', '')
      WHERE e.source_version_id = $1

      UNION ALL

      SELECT
        $1::uuid AS root_version_id,
        dt.descendant_version_id AS ancestor_version_id,
        pv.id AS descendant_version_id,
        dt.depth + 1 AS depth,
        dt.path_array || pv.id
      FROM dependency_tree dt
      JOIN dependency_edges e ON e.source_version_id = dt.descendant_version_id
      JOIN packages p ON p.id = e.target_package_id
      JOIN package_versions pv ON pv.package_id = p.id
        AND pv.version = REPLACE(REPLACE(REPLACE(e.version_requirement, '^', ''), '~', ''), '>=', '')
      WHERE NOT (pv.id = ANY(dt.path_array))
        AND dt.depth < 20
    )
    INSERT INTO materialized_closures (root_version_id, ancestor_version_id, descendant_version_id, depth, path_array)
    SELECT DISTINCT ON (descendant_version_id)
      root_version_id, ancestor_version_id, descendant_version_id, depth, path_array
    FROM dependency_tree;
  `;

  const result = await runner.query(insertQuery, [rootVersionId]);
  return result.rowCount || 0;
}
