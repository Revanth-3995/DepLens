import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { simulateWhatIf } from '../simulations/whatIfEngine.js';

const router = Router();

const upgradeSimulationSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  targetPackage: z.string().min(1, 'Target package is required'),
  proposedVersion: z.string().min(1, 'Proposed version is required'),
});

const removeSimulationSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  targetPackage: z.string().min(1, 'Target package is required'),
});

// POST /api/simulations/upgrade
router.post('/upgrade', async (req: Request, res: Response) => {
  try {
    const parsed = upgradeSimulationSchema.parse(req.body);
    const result = await simulateWhatIf(
      parsed.projectId,
      parsed.targetPackage,
      parsed.proposedVersion,
      'UPGRADE'
    );
    res.json({ simulation: result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: err.message || 'Upgrade simulation failed' });
  }
});

// POST /api/simulations/remove
router.post('/remove', async (req: Request, res: Response) => {
  try {
    const parsed = removeSimulationSchema.parse(req.body);
    const result = await simulateWhatIf(
      parsed.projectId,
      parsed.targetPackage,
      undefined,
      'REMOVE'
    );
    res.json({ simulation: result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: err.message || 'Removal simulation failed' });
  }
});

// Generic POST /api/simulations
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, targetPackage, proposedVersion, simulationType } = req.body;
    if (!projectId || !targetPackage) {
      return res.status(400).json({ error: 'projectId and targetPackage are required' });
    }

    const type = simulationType || (proposedVersion ? 'UPGRADE' : 'REMOVE');
    const result = await simulateWhatIf(projectId, targetPackage, proposedVersion, type);
    res.json({ simulation: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Simulation failed' });
  }
});

export default router;
