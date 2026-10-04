import { Router, Request, Response } from 'express';
import multer from 'multer';
import { getPgPool } from '../db/index.js';
import { parsePackageLockJson } from '../parsers/packageLockParser.js';
import { analyzePackageVulnerabilities } from '../services/vulnerabilityService.js';

const router = Router();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.json') || file.mimetype.includes('json')) {
      cb(null, true);
    } else {
      cb(new Error('Only package-lock.json files are allowed'));
    }
  },
});

// POST /api/projects/:id/scan (Upload or payload scan)
router.post('/projects/:id/scan', upload.single('file'), async (req: Request, res: Response) => {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const { id: projectId } = req.params;

    let jsonContent = '';
    if (req.file) {
      jsonContent = req.file.buffer.toString('utf-8');
    } else if (req.body.content) {
      jsonContent = req.body.content;
    } else {
      return res.status(400).json({ error: 'Please provide a package-lock.json file or content' });
    }

    // Verify project exists
    const projRes = await client.query('SELECT id, name FROM projects WHERE id = $1', [projectId]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const projectName = projRes.rows[0].name;

    // Parse package-lock.json
    const parsedLockfile = parsePackageLockJson(jsonContent);

    await client.query('BEGIN');

    // 1. Create Scan entry
    const scanRes = await client.query(`
      INSERT INTO scans (project_id, status, source)
      VALUES ($1, 'IN_PROGRESS', $2)
      RETURNING id;
    `, [projectId, req.file ? req.file.originalname : 'package-lock.json']);

    const scanId = scanRes.rows[0].id;

    // 2. Insert Packages & Versions into database
    const versionIdMap = new Map<string, string>(); // "name@version" -> pv_id

    for (const [depKey, dep] of parsedLockfile.dependencies.entries()) {
      // Upsert package
      const pkgRes = await client.query(`
        INSERT INTO packages (name, ecosystem)
        VALUES ($1, 'npm')
        ON CONFLICT (name, ecosystem) DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
      `, [dep.name]);
      const pkgId = pkgRes.rows[0].id;

      // Upsert version
      const verRes = await client.query(`
        INSERT INTO package_versions (package_id, version)
        VALUES ($1, $2)
        ON CONFLICT (package_id, version) DO UPDATE SET version = EXCLUDED.version
        RETURNING id;
      `, [pkgId, dep.version]);
      const verId = verRes.rows[0].id;

      versionIdMap.set(depKey, verId);

      // Insert into scan_dependencies
      await client.query(`
        INSERT INTO scan_dependencies (scan_id, package_version_id, is_direct, depth)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (scan_id, package_version_id) DO NOTHING;
      `, [scanId, verId, dep.isDirect, dep.isDirect ? 1 : 2]);
    }

    // 3. Insert Dependency Edges
    for (const [depKey, dep] of parsedLockfile.dependencies.entries()) {
      const srcVerId = versionIdMap.get(depKey);
      if (!srcVerId || !dep.dependencies) continue;

      for (const [targetName, reqRange] of Object.entries(dep.dependencies)) {
        const targetPkgRes = await client.query(`
          INSERT INTO packages (name, ecosystem)
          VALUES ($1, 'npm')
          ON CONFLICT (name, ecosystem) DO UPDATE SET name = EXCLUDED.name
          RETURNING id;
        `, [targetName]);
        const targetPkgId = targetPkgRes.rows[0].id;

        await client.query(`
          INSERT INTO dependency_edges (source_version_id, target_package_id, version_requirement)
          VALUES ($1, $2, $3)
          ON CONFLICT (source_version_id, target_package_id, version_requirement) DO NOTHING;
        `, [srcVerId, targetPkgId, reqRange]);
      }
    }

    // 4. Perform Vulnerability Analysis
    const pkgList = Array.from(parsedLockfile.dependencies.values()).map(d => ({
      name: d.name,
      version: d.version,
    }));

    const { vulnerabilities } = await analyzePackageVulnerabilities(pkgList);

    const directCount = Array.from(parsedLockfile.dependencies.values()).filter(d => d.isDirect).length;
    const transitiveCount = parsedLockfile.dependencies.size - directCount;

    // 5. Update Scan counts & status
    await client.query(`
      UPDATE scans SET
        status = 'COMPLETED',
        total_dependencies = $1,
        direct_dependencies = $2,
        transitive_dependencies = $3,
        vulnerabilities_count = $4,
        vulnerable_paths_count = $5
      WHERE id = $6;
    `, [
      parsedLockfile.dependencies.size,
      directCount,
      transitiveCount,
      vulnerabilities.length,
      vulnerabilities.length * 2,
      scanId,
    ]);

    await client.query('UPDATE projects SET updated_at = NOW() WHERE id = $1', [projectId]);

    await client.query('COMMIT');

    res.status(201).json({
      scanId,
      projectId,
      projectName,
      totalDependencies: parsedLockfile.dependencies.size,
      directDependencies: directCount,
      transitiveDependencies: transitiveCount,
      vulnerabilitiesCount: vulnerabilities.length,
      vulnerabilities,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message || 'Scan processing failed' });
  } finally {
    client.release();
  }
});

// GET /api/projects/:id/scans
router.get('/projects/:id/scans', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPgPool();
    const result = await pool.query(
      'SELECT * FROM scans WHERE project_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json({ scans: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch scans' });
  }
});

// GET /api/scans/:id
router.get('/scans/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPgPool();
    const scanRes = await pool.query(`
      SELECT s.*, p.name AS project_name
      FROM scans s
      JOIN projects p ON p.id = s.project_id
      WHERE s.id = $1
    `, [id]);

    if (scanRes.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const depsRes = await pool.query(`
      SELECT
        p.name AS package_name,
        pv.version,
        sd.is_direct,
        sd.depth
      FROM scan_dependencies sd
      JOIN package_versions pv ON pv.id = sd.package_version_id
      JOIN packages p ON p.id = pv.package_id
      WHERE sd.scan_id = $1
      ORDER BY sd.is_direct DESC, p.name ASC
    `, [id]);

    const packagesList = depsRes.rows.map(r => ({ name: r.package_name, version: r.version }));
    const { vulnerabilities, dataSources } = await analyzePackageVulnerabilities(packagesList);

    res.json({
      scan: scanRes.rows[0],
      dependencies: depsRes.rows,
      vulnerabilities,
      dataSources: Array.from(dataSources),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch scan details' });
  }
});

export default router;
