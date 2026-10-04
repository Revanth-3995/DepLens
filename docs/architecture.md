# DepLens Architecture Documentation

## Overview
DepLens is a database-centric software dependency analysis platform. It combines PostgreSQL for relational dependency graph storage and recursive traversal with MongoDB for heterogeneous OSV vulnerability advisory documents.

```
+-----------------------------------------------------------------------+
|                           React + Vite Frontend                      |
| (Dashboard, Projects, Vulnerability Detail, Simulator, Benchmarks)     |
+-----------------------------------------------------------------------+
                                   |
                                   | REST API (HTTP)
                                   v
+-----------------------------------------------------------------------+
|                         Node.js / Express Backend                     |
|  +-------------------+  +--------------------+  +------------------+  |
|  | Lockfile Parser   |  | What-If Engine     |  | Benchmark Runner |  |
|  +-------------------+  +--------------------+  +------------------+  |
|  | OSV / Local Sync  |  | Semver Matcher     |  | Path Explainer   |  |
|  +-------------------+  +--------------------+  +------------------+  |
+-----------------------------------------------------------------------+
                |                                    |
                v                                    v
+-------------------------------+    +----------------------------------+
|      PostgreSQL 16 DB         |    |            MongoDB 7             |
| (Projects, Packages, Versions,|    |   (Advisory documents, affected  |
| Edges, Scans, Recursive CTEs) |    |        package versions)         |
+-------------------------------+    +----------------------------------+
```

## System Components

### 1. Lockfile Parser (`server/src/parsers/packageLockParser.ts`)
- Parses npm `package-lock.json` manifests across v1, v2, and v3 schema formats.
- Extracts package version declarations, direct dependency mappings, and transitive dependency relationships.

### 2. Dependency Graph Query Engine (`server/src/db/queries/dependencyGraph.ts`)
- Executes PostgreSQL Recursive Common Table Expressions (CTEs) starting from root packages.
- Implements array-based cycle protection (`NOT (pv.id = ANY(dt.visited_versions))`) to prevent infinite recursion on cyclic dependency edges.
- Traces exact dependency paths from root projects to target packages.

### 3. Vulnerability Service (`server/src/services/vulnerabilityService.ts`)
- Connects to OSV API with offline/demo mode fallback to local MongoDB collection.
- Evaluates semver ranges (`>=`, `<`, `<=`) against installed package versions.

### 4. What-If Simulation Engine (`server/src/simulations/whatIfEngine.ts`)
- Operates in isolation without modifying stored database records.
- Constructs simulated direct dependency lists, recalculates transitive closure via PostgreSQL CTEs, and re-evaluates vulnerability state to output Before vs After comparison matrices.

### 5. Research Benchmark Subsystem (`server/src/benchmarks/benchmarkRunner.ts`)
- Runs real database performance experiments measuring execution latencies for closure queries, index scans, JSONB vs MongoDB queries, and caching.
