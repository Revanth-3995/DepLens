export interface Project {
  id: string;
  name: string;
  description?: string;
  ecosystem: string;
  created_at: string;
  updated_at: string;
  total_dependencies?: number;
  vulnerabilities_count?: number;
  latest_scan_id?: string;
  last_scanned_at?: string;
}

export interface Scan {
  id: string;
  project_id: string;
  project_name?: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
  source: string;
  total_dependencies: number;
  direct_dependencies: number;
  transitive_dependencies: number;
  vulnerabilities_count: number;
  vulnerable_paths_count: number;
  created_at: string;
}

export interface MatchedVulnerability {
  advisoryId: string;
  summary: string;
  details: string;
  packageName: string;
  installedVersion: string;
  affectedRange: string;
  fixedVersion: string | null;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN' | string;
  cvssScore: number | null;
  aliases: string[];
  references: Array<{ type: string; url: string }>;
  dataSource: 'Live OSV' | 'Local Demo Dataset';
}

export interface ScanDependency {
  package_name: string;
  version: string;
  is_direct: boolean;
  depth: number;
}

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

export interface BenchmarkMetrics {
  timestamp: string;
  experiments: {
    closureComparison: {
      runtimeCteMs: number;
      materializedClosureMs: number;
      speedupFactor: number;
    };
    indexingComparison: {
      withIndexMs: number;
      withoutIndexMs: number;
      improvementPercent: number;
    };
    advisoryStorageComparison: {
      postgresJsonbMs: number;
      mongoDbMs: number;
      fastest: string;
    };
    cachingComparison: {
      uncachedMs: number;
      cachedMs: number;
      speedupFactor: number;
    };
  };
}
