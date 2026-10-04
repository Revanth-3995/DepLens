import { getPgPool } from '../db/index.js';
import { getTransitiveClosureRuntime } from '../db/queries/dependencyGraph.js';
import { analyzePackageVulnerabilities, MatchedVulnerability } from '../services/vulnerabilityService.js';

export interface SimulationResult {
  projectId: string;
  projectName: string;
  simulationType: 'UPGRADE' | 'REMOVE';
  targetPackage: string;
  currentVersion?: string;
  proposedVersion?: string;

  before: {
    totalDependencies: number;
    directDependencies: number;
    transitiveDependencies: number;
    vulnerabilitiesCount: number;
    vulnerablePathsCount: number;
    vulnerabilities: MatchedVulnerability[];
    dependencies: Array<{ name: string; version: string; isDirect: boolean }>;
  };

  after: {
    totalDependencies: number;
    directDependencies: number;
    transitiveDependencies: number;
    vulnerabilitiesCount: number;
    vulnerablePathsCount: number;
    vulnerabilities: MatchedVulnerability[];
    dependencies: Array<{ name: string; version: string; isDirect: boolean }>;
  };

  diff: {
    resolvedVulnerabilities: MatchedVulnerability[];
    remainingVulnerabilities: MatchedVulnerability[];
    newVulnerabilities: MatchedVulnerability[];
    explanationText: string;
  };
}

export async function simulateWhatIf(
  projectId: string,
  targetPackageName: string,
  proposedVersion?: string, // Present if UPGRADE, undefined if REMOVE
  simulationType: 'UPGRADE' | 'REMOVE' = proposedVersion ? 'UPGRADE' : 'REMOVE'
): Promise<SimulationResult> {
  const pool = getPgPool();

  // 1. Fetch Project and Latest Scan info
  const projRes = await pool.query('SELECT id, name FROM projects WHERE id = $1', [projectId]);
  if (projRes.rows.length === 0) {
    throw new Error(`Project ${projectId} not found`);
  }
  const projectName = projRes.rows[0].name;

  const scanRes = await pool.query(`
    SELECT id FROM scans
    WHERE project_id = $1
    ORDER BY created_at DESC LIMIT 1
  `, [projectId]);

  if (scanRes.rows.length === 0) {
    throw new Error(`No scan found for project ${projectName}`);
  }
  const scanId = scanRes.rows[0].id;

  // 2. Fetch current scan dependencies (Real State)
  const depsRes = await pool.query(`
    SELECT p.name AS package_name, pv.version, sd.is_direct
    FROM scan_dependencies sd
    JOIN package_versions pv ON pv.id = sd.package_version_id
    JOIN packages p ON p.id = pv.package_id
    WHERE sd.scan_id = $1
  `, [scanId]);

  const currentDeps = depsRes.rows.map(r => ({
    name: r.package_name,
    version: r.version,
    isDirect: r.is_direct,
  }));

  const currentDirectDeps = currentDeps.filter(d => d.isDirect);
  const currentTransitiveDeps = currentDeps.filter(d => !d.isDirect);

  // Analyze vulnerabilities for Current State
  const { vulnerabilities: currentVulns } = await analyzePackageVulnerabilities(currentDeps);

  // 3. Construct Simulated Direct Dependencies
  let currentTargetVersion: string | undefined = undefined;
  const simulatedDirectDeps: Array<{ name: string; version: string }> = [];

  for (const dep of currentDirectDeps) {
    if (dep.name === targetPackageName) {
      currentTargetVersion = dep.version;
      if (simulationType === 'UPGRADE') {
        if (!proposedVersion) throw new Error('Proposed version is required for upgrade simulation');
        simulatedDirectDeps.push({ name: dep.name, version: proposedVersion });
      }
      // If REMOVE, omit this package from simulatedDirectDeps
    } else {
      simulatedDirectDeps.push({ name: dep.name, version: dep.version });
    }
  }

  // 4. Resolve Transitive Closure for Simulated Direct Dependencies
  const simulatedTotalMap = new Map<string, { name: string; version: string; isDirect: boolean }>();

  for (const direct of simulatedDirectDeps) {
    simulatedTotalMap.set(direct.name, { name: direct.name, version: direct.version, isDirect: true });

    // Look up version ID in database for graph traversal
    const verRes = await pool.query(`
      SELECT pv.id
      FROM package_versions pv
      JOIN packages p ON p.id = pv.package_id
      WHERE p.name = $1 AND pv.version = $2
    `, [direct.name, direct.version]);

    if (verRes.rows.length > 0) {
      const rootVerId = verRes.rows[0].id;
      const closure = await getTransitiveClosureRuntime(rootVerId);

      for (const node of closure) {
        if (!simulatedTotalMap.has(node.package_name)) {
          simulatedTotalMap.set(node.package_name, {
            name: node.package_name,
            version: node.version,
            isDirect: false,
          });
        }
      }
    }
  }

  const simulatedDeps = Array.from(simulatedTotalMap.values());
  const simulatedDirectCount = simulatedDeps.filter(d => d.isDirect).length;
  const simulatedTransitiveCount = simulatedDeps.filter(d => !d.isDirect).length;

  // Analyze vulnerabilities for Simulated State
  const { vulnerabilities: simulatedVulns } = await analyzePackageVulnerabilities(simulatedDeps);

  // 5. Calculate Diff & Explanations
  const currentAdvIds = new Set(currentVulns.map(v => v.advisoryId));
  const simulatedAdvIds = new Set(simulatedVulns.map(v => v.advisoryId));

  const resolvedVulnerabilities = currentVulns.filter(v => !simulatedAdvIds.has(v.advisoryId));
  const remainingVulnerabilities = currentVulns.filter(v => simulatedAdvIds.has(v.advisoryId));
  const newVulnerabilities = simulatedVulns.filter(v => !currentAdvIds.has(v.advisoryId));

  let explanationText = '';
  if (simulationType === 'REMOVE') {
    if (remainingVulnerabilities.length > 0 && currentVulns.some(v => v.packageName !== targetPackageName)) {
      const remainingNames = remainingVulnerabilities.map(v => v.packageName).join(', ');
      explanationText = `Removing ${targetPackageName} resolved ${resolvedVulnerabilities.length} issue(s), but vulnerability for (${remainingNames}) remains because another dependency path still introduces it into the project.`;
    } else if (resolvedVulnerabilities.length > 0) {
      explanationText = `Removing ${targetPackageName} successfully resolved all ${resolvedVulnerabilities.length} associated vulnerability issue(s).`;
    } else {
      explanationText = `Removing ${targetPackageName} did not affect total vulnerabilities.`;
    }
  } else {
    // UPGRADE
    if (resolvedVulnerabilities.length > 0) {
      explanationText = `Upgrading ${targetPackageName} from ${currentTargetVersion} to ${proposedVersion} resolves ${resolvedVulnerabilities.length} vulnerability advisory(ies).`;
    } else {
      explanationText = `Upgrading ${targetPackageName} to ${proposedVersion} did not resolve existing vulnerabilities.`;
    }
  }

  return {
    projectId,
    projectName,
    simulationType,
    targetPackage: targetPackageName,
    currentVersion: currentTargetVersion,
    proposedVersion,

    before: {
      totalDependencies: currentDeps.length,
      directDependencies: currentDirectDeps.length,
      transitiveDependencies: currentTransitiveDeps.length,
      vulnerabilitiesCount: currentVulns.length,
      vulnerablePathsCount: currentVulns.length * 2, // Approximate path count representation
      vulnerabilities: currentVulns,
      dependencies: currentDeps,
    },

    after: {
      totalDependencies: simulatedDeps.length,
      directDependencies: simulatedDirectCount,
      transitiveDependencies: simulatedTransitiveCount,
      vulnerabilitiesCount: simulatedVulns.length,
      vulnerablePathsCount: simulatedVulns.length * 2,
      vulnerabilities: simulatedVulns,
      dependencies: simulatedDeps,
    },

    diff: {
      resolvedVulnerabilities,
      remainingVulnerabilities,
      newVulnerabilities,
      explanationText,
    },
  };
}
