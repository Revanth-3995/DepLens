import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { parsePackageLockJson } from '../parsers/packageLockParser.js';
import { getTransitiveClosureRuntime } from '../db/queries/dependencyGraph.js';
import { getPgClient, closeDbConnections } from '../db/index.js';
import { runSeed } from '../db/seed.js';

describe('Dependency Parser & CTE Closure Engine', () => {
  beforeAll(async () => {
    await runSeed();
  });

  afterAll(async () => {
    await closeDbConnections();
  });

  it('should parse package-lock.json v3 format correctly', () => {
    const lockfileContent = JSON.stringify({
      name: 'test-app',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {
        '': {
          dependencies: {
            'express': '^4.18.2',
          },
        },
        'node_modules/express': {
          version: '4.18.2',
          dependencies: {
            'body-parser': '1.20.1',
          },
        },
        'node_modules/express/node_modules/body-parser': {
          version: '1.20.1',
        },
      },
    });

    const parsed = parsePackageLockJson(lockfileContent);
    expect(parsed.name).toBe('test-app');
    expect(parsed.lockfileVersion).toBe(3);
    expect(parsed.directDependencies.has('express')).toBe(true);
    expect(parsed.dependencies.has('express@4.18.2')).toBe(true);
    expect(parsed.dependencies.get('express@4.18.2')?.dependencies['body-parser']).toBe('1.20.1');
  });

  it('should parse package-lock.json v1 format correctly', () => {
    const v1Content = JSON.stringify({
      name: 'v1-app',
      version: '1.0.0',
      lockfileVersion: 1,
      dependencies: {
        'lodash': {
          version: '4.17.21',
          requires: { 'a': '1.0.0' }
        }
      }
    });

    const parsed = parsePackageLockJson(v1Content);
    expect(parsed.name).toBe('v1-app');
    expect(parsed.dependencies.has('lodash@4.17.21')).toBe(true);
  });

  it('should execute PostgreSQL Recursive CTE closure traversal', async () => {
    const pg = await getPgClient();
    try {
      const verRes = await pg.query(`
        SELECT pv.id
        FROM package_versions pv
        JOIN packages p ON p.id = pv.package_id
        WHERE p.name = 'package-a' AND pv.version = '2.1.0'
      `);
      const pkgAVerId = verRes.rows[0].id;

      const closure = await getTransitiveClosureRuntime(pkgAVerId);
      expect(closure.length).toBeGreaterThan(0);
      const pkgCNode = closure.find((node) => node.package_name === 'package-c');
      expect(pkgCNode).toBeDefined();
      expect(pkgCNode?.version).toBe('1.2.0');
    } finally {
      pg.release();
    }
  });
});
