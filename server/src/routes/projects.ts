import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getPgPool } from '../db/index.js';

const router = Router();

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  ecosystem: z.string().default('npm'),
});

// GET /api/projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    const result = await pool.query(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.ecosystem,
        p.created_at,
        p.updated_at,
        COALESCE(latest_scan.total_dependencies, 0) AS total_dependencies,
        COALESCE(latest_scan.vulnerabilities_count, 0) AS vulnerabilities_count,
        latest_scan.id AS latest_scan_id,
        latest_scan.created_at AS last_scanned_at
      FROM projects p
      LEFT JOIN LATERAL (
        SELECT id, total_dependencies, vulnerabilities_count, created_at
        FROM scans s
        WHERE s.project_id = p.id
        ORDER BY s.created_at DESC
        LIMIT 1
      ) latest_scan ON TRUE
      ORDER BY p.updated_at DESC;
    `);
    res.json({ projects: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch projects' });
  }
});

// POST /api/projects
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createProjectSchema.parse(req.body);
    const pool = getPgPool();
    const result = await pool.query(
      'INSERT INTO projects (name, description, ecosystem) VALUES ($1, $2, $3) RETURNING *',
      [parsed.name, parsed.description || '', parsed.ecosystem]
    );
    res.status(201).json({ project: result.rows[0] });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A project with this name already exists' });
    }
    res.status(500).json({ error: err.message || 'Failed to create project' });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPgPool();
    const projRes = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const scansRes = await pool.query(
      'SELECT * FROM scans WHERE project_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({
      project: projRes.rows[0],
      scans: scansRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch project' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPgPool();
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully', id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete project' });
  }
});

export default router;
