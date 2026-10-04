import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import projectsRouter from './routes/projects.js';
import scansRouter from './routes/scans.js';
import vulnerabilitiesRouter from './routes/vulnerabilities.js';
import simulationsRouter from './routes/simulations.js';
import researchRouter from './routes/research.js';

const app: Express = express();

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'UP',
    system: 'DepLens System',
    demoMode: process.env.DEMO_MODE === 'true',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api', scansRouter);
app.use('/api/vulnerabilities', vulnerabilitiesRouter);
app.use('/api/simulations', simulationsRouter);
app.use('/api/research/benchmarks', researchRouter);

// Centralized error sanitizer middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[DepLens Server Error]', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

export default app;
