# DepLens Database Schema & Query Documentation

## PostgreSQL Relational Schema

### Entities & Relationships

1. **`projects`**: Top-level application project entity.
   - `id` (UUID, Primary Key)
   - `name` (VARCHAR 255, Unique)
   - `description` (TEXT)
   - `ecosystem` (VARCHAR 50)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

2. **`packages`**: Abstract software package identifier.
   - `id` (UUID, Primary Key)
   - `name` (VARCHAR 255)
   - `ecosystem` (VARCHAR 50)
   - Constraint: `UNIQUE(name, ecosystem)`

3. **`package_versions`**: Specific version instances of a package.
   - `id` (UUID, Primary Key)
   - `package_id` (UUID, Foreign Key → `packages.id` ON DELETE CASCADE)
   - `version` (VARCHAR 100)
   - Constraint: `UNIQUE(package_id, version)`

4. **`dependency_edges`**: Directed dependency graph edges.
   - `id` (UUID, Primary Key)
   - `source_version_id` (UUID, Foreign Key → `package_versions.id` ON DELETE CASCADE)
   - `target_package_id` (UUID, Foreign Key → `packages.id` ON DELETE CASCADE)
   - `version_requirement` (VARCHAR 100)
   - Constraint: `UNIQUE(source_version_id, target_package_id, version_requirement)`

5. **`scans`**: Immutable historical analysis scan events.
   - `id` (UUID, Primary Key)
   - `project_id` (UUID, Foreign Key → `projects.id` ON DELETE CASCADE)
   - `status`, `source`, `total_dependencies`, `direct_dependencies`, `transitive_dependencies`, `vulnerabilities_count`, `vulnerable_paths_count`, `created_at`

6. **`scan_dependencies`**: Resolved package versions for a scan.
   - `id` (UUID, Primary Key)
   - `scan_id` (UUID, Foreign Key → `scans.id` ON DELETE CASCADE)
   - `package_version_id` (UUID, Foreign Key → `package_versions.id` ON DELETE CASCADE)
   - `is_direct` (BOOLEAN), `depth` (INT)

7. **`materialized_closures`**: Pre-computed closure table for performance benchmarking.
   - `id` (UUID, Primary Key)
   - `root_version_id`, `ancestor_version_id`, `descendant_version_id` (UUIDs)
   - `depth` (INT), `path_array` (UUID[])

8. **`jsonb_advisories`**: PostgreSQL JSONB storage table for JSONB vs MongoDB benchmarks.
   - `id` (VARCHAR 100, Primary Key)
   - `advisory_data` (JSONB, GIN indexed)

---

## Recursive CTE Traversal Query

```sql
WITH RECURSIVE dependency_tree AS (
  SELECT
    e.target_package_id,
    pv.id AS package_version_id,
    p.name AS package_name,
    pv.version,
    1 AS depth,
    ARRAY[e.source_version_id, pv.id]::uuid[] AS visited_versions,
    ARRAY[p.name]::text[] AS visited_names
  FROM dependency_edges e
  JOIN packages p ON p.id = e.target_package_id
  JOIN package_versions pv ON pv.package_id = p.id
  WHERE e.source_version_id = $1

  UNION ALL

  SELECT
    e.target_package_id,
    pv.id AS package_version_id,
    p.name AS package_name,
    pv.version,
    dt.depth + 1 AS depth,
    dt.visited_versions || pv.id,
    dt.visited_names || p.name::text
  FROM dependency_tree dt
  JOIN dependency_edges e ON e.source_version_id = dt.package_version_id
  JOIN packages p ON p.id = e.target_package_id
  JOIN package_versions pv ON pv.package_id = p.id
  WHERE NOT (pv.id = ANY(dt.visited_versions)) -- Cycle Protection
    AND dt.depth < 20
)
SELECT DISTINCT ON (package_version_id)
  package_version_id, target_package_id AS package_id, package_name, version, depth, visited_names AS path
FROM dependency_tree
ORDER BY package_version_id, depth ASC;
```

---

## MongoDB Advisory Document Schema

Collection: `advisories`
Indexes:
- `{ id: 1 }` (Unique)
- `{ "affected.package.name": 1, "affected.package.ecosystem": 1 }`
- `{ aliases: 1 }`
