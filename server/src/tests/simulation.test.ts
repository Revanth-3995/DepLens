import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { simulateWhatIf } from '../simulations/whatIfEngine.js';
import { getPgClient, closeDbConnections } from '../db/index.js';
import { runSeed } from '../db/seed.js';

describe('What-If Simulation Engine', () => {
  beforeAll(async () => {
    await runSeed();
  });

  afterAll(async () => {
    await closeDbConnections();
  });

  it('should simulate dependency removal and detect remaining vulnerability via alternate path', async () => {
    const pg = await getPgClient();
    try {
      const projRes = await pg.query("SELECT id FROM projects WHERE name = 'MyShop E-Commerce Platform'");
      const projectId = projRes.rows[0].id;

      // Simulate removing package-a.
      // Notice: MyShop also depends on package-b@1.0.0, which ALSO depends on package-c@1.2.0!
      // So removing package-a should NOT eliminate package-c@1.2.0 vulnerability.
      const simResult = await simulateWhatIf(projectId, 'package-a', undefined, 'REMOVE');

      expect(simResult.simulationType).toBe('REMOVE');
      expect(simResult.targetPackage).toBe('package-a');
      expect(simResult.before.totalDependencies).toBe(5);
      expect(simResult.after.totalDependencies).toBe(4); // package-a removed; package-b, frontend-tool, utility-library, package-c remain

      // package-c is still in the simulated transitive tree via package-b and utility-library!
      const pkgCInAfter = simResult.after.dependencies.find(d => d.name === 'package-c');
      expect(pkgCInAfter).toBeDefined();

      expect(simResult.diff.remainingVulnerabilities.length).toBeGreaterThan(0);
      expect(simResult.diff.explanationText).toContain('remains because another dependency path still introduces it');

      // Verify ZERO database mutation
      const scanCheck = await pg.query("SELECT total_dependencies FROM scans WHERE project_id = $1", [projectId]);
      expect(scanCheck.rows[0].total_dependencies).toBe(5);
    } finally {
      pg.release();
    }
  });

  it('should simulate dependency upgrade correctly', async () => {
    const pg = await getPgClient();
    try {
      const projRes = await pg.query("SELECT id FROM projects WHERE name = 'MyShop E-Commerce Platform'");
      const projectId = projRes.rows[0].id;

      const simResult = await simulateWhatIf(projectId, 'package-a', '2.5.0', 'UPGRADE');

      expect(simResult.simulationType).toBe('UPGRADE');
      expect(simResult.targetPackage).toBe('package-a');
      expect(simResult.currentVersion).toBe('2.1.0');
      expect(simResult.proposedVersion).toBe('2.5.0');
      expect(simResult.before.vulnerabilitiesCount).toBeGreaterThan(0);
    } finally {
      pg.release();
    }
  });
});
