import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPgClient, closeDbConnections } from '../db/index.js';
import { runSeed } from '../db/seed.js';
import { getTransitiveClosureRuntime } from '../db/queries/dependencyGraph.js';
import { isVersionAffected } from '../services/vulnerabilityService.js';
import { simulateWhatIf } from '../simulations/whatIfEngine.js';

describe('Deep Dependency Graph & Edge Cases Verification', () => {
  beforeAll(async () => {
    await runSeed();
  });

  afterAll(async () => {
    await closeDbConnections();
  });

  it('Case 1 & 2: Should traverse deep dependency chains and handle cyclic dependency graph safely without hanging', async () => {
    const pg = await getPgClient();
    try {
      await pg.query('BEGIN');

      // Create cycle: cyclic-a -> cyclic-b -> cyclic-c -> cyclic-a
      const pARes = await pg.query("INSERT INTO packages (name, ecosystem) VALUES ('cyclic-a', 'npm') RETURNING id");
      const pBRes = await pg.query("INSERT INTO packages (name, ecosystem) VALUES ('cyclic-b', 'npm') RETURNING id");
      const pCRes = await pg.query("INSERT INTO packages (name, ecosystem) VALUES ('cyclic-c', 'npm') RETURNING id");

      const pAId = pARes.rows[0].id;
      const pBId = pBRes.rows[0].id;
      const pCId = pCRes.rows[0].id;

      const vARes = await pg.query("INSERT INTO package_versions (package_id, version) VALUES ($1, '1.0.0') RETURNING id", [pAId]);
      const vBRes = await pg.query("INSERT INTO package_versions (package_id, version) VALUES ($1, '1.0.0') RETURNING id", [pBId]);
      const vCRes = await pg.query("INSERT INTO package_versions (package_id, version) VALUES ($1, '1.0.0') RETURNING id", [pCId]);

      const vAId = vARes.rows[0].id;
      const vBId = vBRes.rows[0].id;
      const vCId = vCRes.rows[0].id;

      await pg.query("INSERT INTO dependency_edges (source_version_id, target_package_id, version_requirement) VALUES ($1, $2, '1.0.0')", [vAId, pBId]);
      await pg.query("INSERT INTO dependency_edges (source_version_id, target_package_id, version_requirement) VALUES ($1, $2, '1.0.0')", [vBId, pCId]);
      await pg.query("INSERT INTO dependency_edges (source_version_id, target_package_id, version_requirement) VALUES ($1, $2, '1.0.0')", [vCId, pAId]); // Cycle!

      // Execute Recursive CTE on cyclic root vAId passing transaction client pg
      const closure = await getTransitiveClosureRuntime(vAId, pg);

      // Traversal must terminate safely with 2 distinct nodes (cyclic-b, cyclic-c) and NOT loop infinitely
      expect(closure.length).toBe(2);
      expect(closure.some(n => n.package_name === 'cyclic-b')).toBe(true);
      expect(closure.some(n => n.package_name === 'cyclic-c')).toBe(true);

      await pg.query('ROLLBACK');
    } catch (err) {
      await pg.query('ROLLBACK');
      throw err;
    } finally {
      pg.release();
    }
  });

  it('Case 3: Should handle semver boundaries and loose version coercion', () => {
    const semverRange = {
      ranges: [
        {
          type: 'SEMVER',
          events: [{ introduced: '1.0.0' }, { fixed: '1.5.0' }],
        },
      ],
    };

    // Boundary < fixed
    expect(isVersionAffected('1.4.99', semverRange).affected).toBe(true);
    // Boundary == fixed (exclusive)
    expect(isVersionAffected('1.5.0', semverRange).affected).toBe(false);
    // Boundary > fixed
    expect(isVersionAffected('1.5.1', semverRange).affected).toBe(false);
    // Loose string input "v1.2.0"
    expect(isVersionAffected('v1.2.0', semverRange).affected).toBe(true);
  });

  it('Case 4: What-If Removal preserves vulnerability when alternate path still exists', async () => {
    const pg = await getPgClient();
    try {
      const projRes = await pg.query("SELECT id FROM projects WHERE name = 'MyShop E-Commerce Platform'");
      const projectId = projRes.rows[0].id;

      // In MyShop:
      // Path 1: MyShop -> package-a -> package-c (1.2.0)
      // Path 2: MyShop -> package-b -> package-c (1.2.0)
      // Path 3: MyShop -> frontend-tool -> utility-library -> package-c (1.2.0)

      // Simulating REMOVE package-a:
      const result = await simulateWhatIf(projectId, 'package-a', undefined, 'REMOVE');

      expect(result.diff.remainingVulnerabilities.some(v => v.packageName === 'package-c')).toBe(true);
      expect(result.diff.explanationText).toContain('remains because another dependency path still introduces it');
    } finally {
      pg.release();
    }
  });

  it('Case 5: Zero database mutation during simulation', async () => {
    const pg = await getPgClient();
    try {
      const projRes = await pg.query("SELECT id FROM projects WHERE name = 'MyShop E-Commerce Platform'");
      const projectId = projRes.rows[0].id;

      const countBefore = await pg.query("SELECT total_dependencies FROM scans WHERE project_id = $1", [projectId]);

      // Run simulation
      await simulateWhatIf(projectId, 'package-a', '2.5.0', 'UPGRADE');

      const countAfter = await pg.query("SELECT total_dependencies FROM scans WHERE project_id = $1", [projectId]);
      expect(countAfter.rows[0].total_dependencies).toBe(countBefore.rows[0].total_dependencies);
    } finally {
      pg.release();
    }
  });
});
