# DepLens — Dependency Vulnerability Impact & What-If Analysis System

DepLens is a database-centric software dependency analysis platform. The system analyzes application dependencies (`package-lock.json`), identifies known vulnerability advisories, and provides dependency-path explanations, multi-project impact analysis, what-if dependency change simulations, and database performance benchmarking.

---

## 🚀 System Features

1. **Dependency Path Explanation**: Shows exact chains from root project to transitive vulnerable packages (e.g. `MyShop` → `frontend-tool` → `utility-library` → `package-c 1.2.0`).
2. **What-If Upgrade Simulation**: Simulates upgrading direct dependencies and recomputes the transitive dependency closure and advisory matches without mutating real project data.
3. **What-If Removal Simulation**: Simulates removing dependencies and accurately detects if a vulnerability remains because another path still introduces the package.
4. **Multi-Project Impact Analysis**: Queries across all registered projects to report which systems are affected by a specific vulnerability advisory.
5. **Database Research & Benchmarking**: Executes real database performance benchmarks comparing:
   - **Experiment A**: Runtime Recursive CTE closure vs. Materialized closure.
   - **Experiment B**: Indexed vs. Non-indexed dependency lookups.
   - **Experiment C**: PostgreSQL `JSONB` vs. MongoDB document storage.
   - **Experiment D**: Uncached traversal vs. In-memory LRU caching.
6. **Robust OSV & Offline Fallback**: Fetches live advisories from OSV API with automatic fallback to a local deterministic MongoDB advisory dataset when offline or in Demo Mode.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons.
- **Backend**: Node.js, Express, TypeScript, Zod, Multer, Semver.
- **Relational Store**: PostgreSQL 16 (Structured package versions, dependency edges, scans, recursive CTEs).
- **Document Store**: MongoDB 7 (Heterogeneous OSV vulnerability advisories).
- **Tooling**: Docker Compose, Vitest, Supertest, TSX.

---

## 🏁 Quick Start Guide

### Prerequisites
- Node.js (v18+) & `npm`
- PostgreSQL 16 & MongoDB 7 (or Docker Compose)

### 1. Start Databases
Using Docker Compose:
```bash
docker compose up -d
```
*Alternatively, run local PostgreSQL on port `5432` (`user: deplens_user`, `password: deplens_password`, `db: deplens`) and MongoDB on port `27017`.*

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Migration & Seed Data
```bash
npm run migrate
npm run seed
```

### 4. Start Application
```bash
npm run dev
```
- **Frontend Dashboard**: `http://localhost:3000`
- **Backend REST API**: `http://localhost:5000`

---

## 🧪 Testing & Benchmarks

### Run Automated Test Suite
```bash
npm test
```

### Execute Database Research Benchmarks
```bash
npm run benchmark
```
Results will be displayed on stdout and saved to `benchmark_results.json`.

---

## 🎬 3-Minute Demo Script

1. **Dashboard Overview**: Open `http://localhost:3000`. View security metrics, monitored projects, and vulnerability distribution.
2. **Inspect Project Details**: Open **MyShop E-Commerce Platform**. Observe direct vs transitive dependencies and detected vulnerability advisories.
3. **Inspect Dependency Trace**: Click on advisory `GHSA-c120-vuln`. Observe the multi-project impact table and visual dependency path trace (`MyShop -> package-a -> package-c 1.2.0`).
4. **Run What-If Upgrade**: Click **Simulate Dependency Changes**. Select package `package-a` and propose version `2.5.0`. Click **Simulate Change** to view the Before vs After side-by-side comparison matrix.
5. **Run What-If Removal**: Switch action to **Remove** `package-a`. Click **Simulate Change** and verify that `package-c 1.2.0` vulnerability remains because `package-b` still introduces it!
6. **Database Research Dashboard**: Open **Database Research** from the navbar. Click **Run Database Benchmarks** to view live measured timings for Recursive CTEs, Materialized Closures, Indexes, and JSONB vs MongoDB queries.
