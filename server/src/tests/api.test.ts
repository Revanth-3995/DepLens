import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { runSeed } from '../db/seed.js';
import { closeDbConnections, getPgClient } from '../db/index.js';

describe('Server REST API Layer', () => {
  beforeAll(async () => {
    await runSeed();
  });

  afterAll(async () => {
    await closeDbConnections();
  });

  it('GET /api/health should return UP status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  it('GET /api/projects should return project list', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.projects)).toBe(true);
    expect(res.body.projects.length).toBeGreaterThan(0);
  });

  it('POST /api/projects should create a new project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'New Test Microservice', description: 'Testing API creation' });

    expect(res.status).toBe(201);
    expect(res.body.project.name).toBe('New Test Microservice');
  });

  it('POST /api/simulations/upgrade should simulate dependency upgrade', async () => {
    const pg = await getPgClient();
    try {
      const projRes = await pg.query("SELECT id FROM projects WHERE name = 'MyShop E-Commerce Platform'");
      const projectId = projRes.rows[0].id;

      const res = await request(app)
        .post('/api/simulations/upgrade')
        .send({
          projectId,
          targetPackage: 'package-a',
          proposedVersion: '2.5.0',
        });

      expect(res.status).toBe(200);
      expect(res.body.simulation.simulationType).toBe('UPGRADE');
      expect(res.body.simulation.targetPackage).toBe('package-a');
    } finally {
      pg.release();
    }
  });

  it('GET /api/vulnerabilities/:id/projects should return multi-project impact analysis', async () => {
    const res = await request(app).get('/api/vulnerabilities/GHSA-c120-vuln/projects');
    expect(res.status).toBe(200);
    expect(res.body.advisoryId).toBe('GHSA-c120-vuln');
    expect(Array.isArray(res.body.affectedProjects)).toBe(true);
    expect(res.body.affectedProjects.length).toBeGreaterThan(0);
  });

  it('GET /api/research/benchmarks should return benchmark metrics', async () => {
    const res = await request(app).get('/api/research/benchmarks');
    expect(res.status).toBe(200);
    expect(res.body.results).toBeDefined();
    expect(res.body.results.experiments).toBeDefined();
  });
});
