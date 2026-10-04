# DepLens Demonstration Script

This script provides a step-by-step walkthrough for a 3-5 minute demonstration.

---

## 1. Security Dashboard Overview
- Navigate to `http://localhost:3000`.
- **Key Points**: Point out total projects, active vulnerabilities count, and the vulnerability distribution bar chart.
- **Explain**: DepLens acts as a central dependency governance system powered by PostgreSQL and MongoDB.

---

## 2. Inspecting Project Dependencies
- Click on **MyShop E-Commerce Platform** from the monitored projects table.
- **Key Points**: View the direct vs transitive dependency count (5 total: 2 direct, 3 transitive).
- **Explain**: Notice that `package-c 1.2.0` is installed transitively and is vulnerable (`GHSA-c120-vuln`).

---

## 3. Dependency Path Explanation & Multi-Project Analysis
- Click on advisory **GHSA-c120-vuln**.
- **Visual Path Trace**: Point out the dependency path trace (`MyShop -> package-a -> package-c 1.2.0`). Explain that the developer did not directly install `package-c`; it entered transitively through `package-a`.
- **Multi-Project Table**: Show which registered projects in the database are affected (MyShop, Analytics Engine, Payment Gateway) vs unaffected (Internal Admin).

---

## 4. What-If Dependency Simulation (Upgrade)
- Click **Simulate Dependency Changes** (or navigate to `/simulator`).
- Select **MyShop E-Commerce Platform** and package **package-a**.
- Select action **Upgrade** and set proposed version to **2.5.0**.
- Click **Simulate Change**.
- **Explain**: Point out the Before vs After matrix. Emphasize that this calculation was executed in memory via PostgreSQL CTEs and did NOT mutate the stored project data.

---

## 5. What-If Dependency Simulation (Removal)
- Switch action to **Remove** `package-a`.
- Click **Simulate Change**.
- **Key Point**: Explain the result message: *"vulnerability for package-c remains because another dependency path still introduces it into the project."*
- Point out that `package-b` and `utility-library` still reach `package-c 1.2.0`, proving that DepLens performs actual graph resolution rather than superficial string filtering.

---

## 6. Database Research Benchmarks
- Click **Database Research** from the navbar.
- Click **Run Database Benchmarks**.
- **Key Points**: Showcase live measured metrics comparing:
  - Runtime Recursive CTEs vs Materialized Closures.
  - Indexed vs Non-indexed queries.
  - PostgreSQL JSONB vs MongoDB advisory queries.
  - In-memory traversal caching.
