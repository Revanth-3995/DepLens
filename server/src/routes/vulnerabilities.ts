import { Router, Request, Response } from 'express';
import { getMongoDb, getPgPool } from '../db/index.js';
import { analyzePackageVulnerabilities } from '../services/vulnerabilityService.js';
import { explainDependencyPaths } from '../services/pathExplanationService.js';

const router = Router();

// GET /api/vulnerabilities/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getMongoDb();
    const advisory = await db.collection('advisories').findOne({ id });

    if (!advisory) {
      return res.status(404).json({ error: 'Vulnerability advisory not found' });
    }

    res.json({ advisory });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch vulnerability' });
  }
});

// GET /api/vulnerabilities/:id/projects (Multi-Project Analysis)
router.get('/:id/projects', async (req: Request, res: Response) => {
  try {
    const { id: advisoryId } = req.params;
    const pool = getPgPool();

    // Fetch advisory from Mongo to know target package name
    const db = await getMongoDb();
    const advisory = await db.collection('advisories').findOne({ id: advisoryId });

    if (!advisory) {
      return res.status(404).json({ error: 'Advisory not found' });
    }

    const targetPackageName = advisory.affected?.[0]?.package?.name;
    if (!targetPackageName) {
      return res.status(400).json({ error: 'Advisory does not specify affected package name' });
    }

    // Query PostgreSQL to find all projects and scans containing this package
    const projectsRes = await pool.query(`
      SELECT DISTINCT
        p.id AS project_id,
        p.name AS project_name,
        pv.version AS installed_version,
        s.id AS scan_id,
        s.created_at AS scan_date
      FROM projects p
      JOIN scans s ON s.project_id = p.id
      JOIN scan_dependencies sd ON sd.scan_id = s.id
      JOIN package_versions pv ON pv.id = sd.package_version_id
      JOIN packages pkg ON pkg.id = pv.package_id
      WHERE pkg.name = $1
      ORDER BY p.name ASC;
    `, [targetPackageName]);

    // For each project, verify if installed version is actually affected
    const affectedProjects: any[] = [];
    const unaffectedProjects: any[] = [];

    const allProjectsRes = await pool.query('SELECT id, name FROM projects ORDER BY name ASC');

    const projectImpactMap = new Map<string, any>();
    for (const projRow of projectsRes.rows) {
      const { vulnerabilities } = await analyzePackageVulnerabilities([{
        name: targetPackageName,
        version: projRow.installed_version,
      }]);

      const isAffected = vulnerabilities.some(v => v.advisoryId === advisoryId);
      projectImpactMap.set(projRow.project_id, {
        projectId: projRow.project_id,
        projectName: projRow.project_name,
        installedVersion: projRow.installed_version,
        scanId: projRow.scan_id,
        isAffected,
      });
    }

    for (const proj of allProjectsRes.rows) {
      const impact = projectImpactMap.get(proj.id);
      if (impact && impact.isAffected) {
        affectedProjects.push(impact);
      } else {
        unaffectedProjects.push({
          projectId: proj.id,
          projectName: proj.name,
          installedVersion: impact ? impact.installedVersion : 'Not Installed',
          isAffected: false,
        });
      }
    }

    res.json({
      advisoryId,
      targetPackage: targetPackageName,
      affectedProjects,
      unaffectedProjects,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to analyze project impact' });
  }
});

// GET /api/vulnerabilities/:id/paths?scanId=...&packageName=...&installedVersion=...
router.get('/:id/paths', async (req: Request, res: Response) => {
  try {
    const { scanId, packageName, installedVersion } = req.query;

    if (!scanId || !packageName) {
      return res.status(400).json({ error: 'scanId and packageName query parameters are required' });
    }

    const pool = getPgPool();
    const scanRes = await pool.query(`
      SELECT s.id, p.name AS project_name
      FROM scans s
      JOIN projects p ON p.id = s.project_id
      WHERE s.id = $1
    `, [scanId]);

    if (scanRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const projectName = scanRes.rows[0].project_name;
    const pathResult = await explainDependencyPaths(
      projectName,
      scanId as string,
      packageName as string,
      (installedVersion as string) || ''
    );

    res.json({
      scanId,
      projectName,
      packageName,
      installedVersion,
      paths: pathResult.paths,
      explanations: pathResult.explanations,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to trace dependency paths' });
  }
});

export default router;
