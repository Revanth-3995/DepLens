import { Router, Request, Response } from 'express';
import { runBenchmarks, getLatestBenchmarkResults } from '../benchmarks/benchmarkRunner.js';

const router = Router();

// GET /api/research/benchmarks
router.get('/', async (req: Request, res: Response) => {
  try {
    const results = await getLatestBenchmarkResults();
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch benchmark results' });
  }
});

// POST /api/research/benchmarks/run
router.post('/run', async (req: Request, res: Response) => {
  try {
    const results = await runBenchmarks();
    res.json({ message: 'Benchmarks executed successfully', results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Benchmark execution failed' });
  }
});

export default router;
