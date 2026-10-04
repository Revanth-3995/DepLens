# DepLens REST API Documentation

Base URL: `/api`

## Health Check
- `GET /api/health`
  - Returns server health status, demo mode flag, and system timestamp.

## Projects
- `GET /api/projects`
  - Returns list of projects with latest scan dependency counts and vulnerability status.
- `POST /api/projects`
  - Creates a new project (`{ name, description, ecosystem }`).
- `GET /api/projects/:id`
  - Returns project metadata and scan history timeline.
- `DELETE /api/projects/:id`
  - Deletes project and associated scan records.

## Scans & Uploads
- `POST /api/projects/:id/scan`
  - Uploads `package-lock.json` file or JSON payload, parses dependencies, writes graph edges, and executes vulnerability analysis.
- `GET /api/projects/:id/scans`
  - Returns scan history list for a project.
- `GET /api/scans/:id`
  - Returns detailed scan breakdown including resolved dependency list and vulnerability matches.

## Vulnerabilities & Path Analysis
- `GET /api/vulnerabilities/:id`
  - Returns OSV advisory document from MongoDB.
- `GET /api/vulnerabilities/:id/projects`
  - Multi-project impact analysis: returns affected vs unaffected projects for an advisory.
- `GET /api/vulnerabilities/paths?scanId=...&packageName=...&installedVersion=...`
  - Returns exact dependency paths and human-readable chain explanations.

## What-If Simulations
- `POST /api/simulations/upgrade`
  - Simulates proposed dependency version upgrade (`{ projectId, targetPackage, proposedVersion }`).
- `POST /api/simulations/remove`
  - Simulates proposed dependency removal (`{ projectId, targetPackage }`).

## Research Benchmarks
- `GET /api/research/benchmarks`
  - Returns latest recorded database benchmark metrics.
- `POST /api/research/benchmarks/run`
  - Executes live performance experiments and updates `benchmark_results.json`.
