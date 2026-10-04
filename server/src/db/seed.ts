import { getPgClient, getMongoDb, closeDbConnections } from './index.js';
import { runMigrations } from './migrate.js';

export async function runSeed() {
  console.log('🌱 Seeding database with deterministic demo data...');
  await runMigrations();

  const pgClient = await getPgClient();
  const mongoDb = await getMongoDb();

  try {
    await pgClient.query('BEGIN');

    // Clear existing data
    await pgClient.query('TRUNCATE projects, packages, package_versions, dependency_edges, scans, scan_dependencies, materialized_closures, jsonb_advisories CASCADE');
    await mongoDb.collection('advisories').deleteMany({});

    // 1. Create Projects
    const projectsRes = await pgClient.query(`
      INSERT INTO projects (name, description, ecosystem) VALUES
      ('MyShop E-Commerce Platform', 'Core web application and API gateway', 'npm'),
      ('Analytics Engine Service', 'Data pipeline and real-time metrics backend', 'npm'),
      ('Payment Gateway API', 'Microservice handling Stripe and PayPal checkouts', 'npm'),
      ('Internal Admin Dashboard', 'Internal employee portal and user management', 'npm')
      RETURNING id, name;
    `);

    const projectMap: Record<string, string> = {};
    for (const row of projectsRes.rows) {
      projectMap[row.name] = row.id;
    }

    // 2. Insert Packages & Versions
    const packagesData = [
      { name: 'package-a', versions: ['1.0.0', '2.1.0', '2.5.0'] },
      { name: 'package-b', versions: ['1.0.0', '1.2.0'] },
      { name: 'package-c', versions: ['1.2.0', '1.5.0'] },
      { name: 'frontend-tool', versions: ['1.0.0', '2.0.0'] },
      { name: 'utility-library', versions: ['1.1.0', '2.5.0'] },
      { name: 'axios', versions: ['0.21.0', '1.7.2'] },
      { name: 'lodash', versions: ['4.17.15', '4.17.21'] },
      { name: 'express', versions: ['4.17.1', '4.19.2'] },
    ];

    const packageMap: Record<string, string> = {}; // pkgName -> pkgId
    const versionMap: Record<string, string> = {}; // pkgName@version -> verId

    for (const pkg of packagesData) {
      const pRes = await pgClient.query(
        'INSERT INTO packages (name, ecosystem, description) VALUES ($1, $2, $3) RETURNING id',
        [pkg.name, 'npm', `Demo package ${pkg.name}`]
      );
      const pkgId = pRes.rows[0].id;
      packageMap[pkg.name] = pkgId;

      for (const ver of pkg.versions) {
        const vRes = await pgClient.query(
          'INSERT INTO package_versions (package_id, version) VALUES ($1, $2) RETURNING id',
          [pkgId, ver]
        );
        versionMap[`${pkg.name}@${ver}`] = vRes.rows[0].id;
      }
    }

    // 3. Insert Dependency Edges
    // package-a@2.1.0 -> package-c@^1.2.0 (resolves to 1.2.0)
    // package-a@2.5.0 -> package-c@^1.5.0 (resolves to 1.5.0 - non-vulnerable!)
    // package-b@1.0.0 -> package-c@^1.2.0
    // frontend-tool@1.0.0 -> utility-library@^1.1.0
    // utility-library@1.1.0 -> package-c@^1.2.0
    const edges = [
      { source: 'package-a@2.1.0', target: 'package-c', req: '^1.2.0' },
      { source: 'package-a@2.5.0', target: 'package-c', req: '^1.5.0' },
      { source: 'package-b@1.0.0', target: 'package-c', req: '^1.2.0' },
      { source: 'frontend-tool@1.0.0', target: 'utility-library', req: '^1.1.0' },
      { source: 'utility-library@1.1.0', target: 'package-c', req: '^1.2.0' },
    ];

    for (const edge of edges) {
      const srcId = versionMap[edge.source];
      const tgtId = packageMap[edge.target];
      if (srcId && tgtId) {
        await pgClient.query(
          'INSERT INTO dependency_edges (source_version_id, target_package_id, version_requirement) VALUES ($1, $2, $3)',
          [srcId, tgtId, edge.req]
        );
      }
    }

    // 4. Create Initial Scans & Scan Dependencies for Demo Projects
    // MyShop Scan
    const myShopId = projectMap['MyShop E-Commerce Platform'];
    const scan1Res = await pgClient.query(`
      INSERT INTO scans (project_id, status, source, total_dependencies, direct_dependencies, transitive_dependencies, vulnerabilities_count, vulnerable_paths_count)
      VALUES ($1, 'COMPLETED', 'package-lock.json', 5, 2, 3, 1, 3)
      RETURNING id;
    `, [myShopId]);
    const scan1Id = scan1Res.rows[0].id;

    const myShopDeps = [
      { key: 'package-a@2.1.0', isDirect: true, depth: 1 },
      { key: 'package-b@1.0.0', isDirect: true, depth: 1 },
      { key: 'frontend-tool@1.0.0', isDirect: true, depth: 1 },
      { key: 'utility-library@1.1.0', isDirect: false, depth: 2 },
      { key: 'package-c@1.2.0', isDirect: false, depth: 2 },
    ];

    for (const dep of myShopDeps) {
      await pgClient.query(`
        INSERT INTO scan_dependencies (scan_id, package_version_id, is_direct, depth)
        VALUES ($1, $2, $3, $4)
      `, [scan1Id, versionMap[dep.key], dep.isDirect, dep.depth]);
    }

    // Analytics Engine Scan
    const analyticsId = projectMap['Analytics Engine Service'];
    const scan2Res = await pgClient.query(`
      INSERT INTO scans (project_id, status, source, total_dependencies, direct_dependencies, transitive_dependencies, vulnerabilities_count, vulnerable_paths_count)
      VALUES ($1, 'COMPLETED', 'package-lock.json', 2, 2, 0, 2, 2)
      RETURNING id;
    `, [analyticsId]);
    const scan2Id = scan2Res.rows[0].id;

    for (const dep of [{ key: 'lodash@4.17.15', isDirect: true, depth: 1 }, { key: 'package-c@1.2.0', isDirect: true, depth: 1 }]) {
      await pgClient.query(`
        INSERT INTO scan_dependencies (scan_id, package_version_id, is_direct, depth)
        VALUES ($1, $2, $3, $4)
      `, [scan2Id, versionMap[dep.key], dep.isDirect, dep.depth]);
    }

    // Payment Gateway Scan
    const paymentId = projectMap['Payment Gateway API'];
    const scan3Res = await pgClient.query(`
      INSERT INTO scans (project_id, status, source, total_dependencies, direct_dependencies, transitive_dependencies, vulnerabilities_count, vulnerable_paths_count)
      VALUES ($1, 'COMPLETED', 'package-lock.json', 3, 2, 1, 2, 2)
      RETURNING id;
    `, [paymentId]);
    const scan3Id = scan3Res.rows[0].id;

    for (const dep of [
      { key: 'axios@0.21.0', isDirect: true, depth: 1 },
      { key: 'package-b@1.0.0', isDirect: true, depth: 1 },
      { key: 'package-c@1.2.0', isDirect: false, depth: 2 },
    ]) {
      await pgClient.query(`
        INSERT INTO scan_dependencies (scan_id, package_version_id, is_direct, depth)
        VALUES ($1, $2, $3, $4)
      `, [scan3Id, versionMap[dep.key], dep.isDirect, dep.depth]);
    }

    // Internal Admin Scan (clean)
    const adminId = projectMap['Internal Admin Dashboard'];
    const scan4Res = await pgClient.query(`
      INSERT INTO scans (project_id, status, source, total_dependencies, direct_dependencies, transitive_dependencies, vulnerabilities_count, vulnerable_paths_count)
      VALUES ($1, 'COMPLETED', 'package-lock.json', 1, 1, 0, 0, 0)
      RETURNING id;
    `, [adminId]);
    const scan4Id = scan4Res.rows[0].id;

    await pgClient.query(`
      INSERT INTO scan_dependencies (scan_id, package_version_id, is_direct, depth)
      VALUES ($1, $2, true, 1)
    `, [scan4Id, versionMap['express@4.17.1']]);

    // 5. Seed OSV Advisories
    const advisories = [
      {
        id: 'GHSA-c120-vuln',
        summary: 'Remote Code Execution in package-c',
        details: 'package-c prior to 1.5.0 is vulnerable to arbitrary remote code execution via unsafe deserialization of untrusted input.',
        aliases: ['CVE-2023-99999'],
        modified: '2024-01-15T10:00:00Z',
        published: '2023-11-01T12:00:00Z',
        database_specific: { severity: 'HIGH', cvss_score: 8.5 },
        references: [{ type: 'WEB', url: 'https://github.com/advisories/GHSA-c120-vuln' }],
        affected: [
          {
            package: { name: 'package-c', ecosystem: 'npm' },
            ranges: [
              {
                type: 'SEMVER',
                events: [{ introduced: '0.0.0' }, { fixed: '1.5.0' }]
              }
            ],
            database_specific: { source: 'GHSA' }
          }
        ]
      },
      {
        id: 'GHSA-axios-021',
        summary: 'Server-Side Request Forgery (SSRF) in axios',
        details: 'axios before 0.21.2 allows attackers to cause SSRF via relative URLs in custom target configurations.',
        aliases: ['CVE-2021-3749'],
        modified: '2023-08-10T10:00:00Z',
        published: '2021-08-31T12:00:00Z',
        database_specific: { severity: 'CRITICAL', cvss_score: 9.1 },
        references: [{ type: 'WEB', url: 'https://github.com/advisories/GHSA-axios-021' }],
        affected: [
          {
            package: { name: 'axios', ecosystem: 'npm' },
            ranges: [
              {
                type: 'SEMVER',
                events: [{ introduced: '0.0.0' }, { fixed: '0.21.2' }]
              }
            ]
          }
        ]
      },
      {
        id: 'GHSA-lodash-417',
        summary: 'Prototype Pollution in lodash',
        details: 'lodash before 4.17.21 is vulnerable to prototype pollution via zipObjectDeep.',
        aliases: ['CVE-2021-23337'],
        modified: '2023-05-01T10:00:00Z',
        published: '2021-02-15T12:00:00Z',
        database_specific: { severity: 'MODERATE', cvss_score: 6.5 },
        references: [{ type: 'WEB', url: 'https://github.com/advisories/GHSA-lodash-417' }],
        affected: [
          {
            package: { name: 'lodash', ecosystem: 'npm' },
            ranges: [
              {
                type: 'SEMVER',
                events: [{ introduced: '0.0.0' }, { fixed: '4.17.21' }]
              }
            ]
          }
        ]
      }
    ];

    // Seed Mongo
    await mongoDb.collection('advisories').insertMany(advisories);

    // Seed PostgreSQL JSONB table for JSONB vs Mongo benchmark
    for (const adv of advisories) {
      await pgClient.query(
        'INSERT INTO jsonb_advisories (id, advisory_data) VALUES ($1, $2)',
        [adv.id, JSON.stringify(adv)]
      );
    }

    await pgClient.query('COMMIT');
    console.log('✅ Demo data seeded successfully.');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
    throw err;
  } finally {
    pgClient.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  runSeed()
    .then(async () => {
      await closeDbConnections();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await closeDbConnections();
      process.exit(1);
    });
}
