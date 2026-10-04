# DepLens Database Engineering Research

## Primary Research Question
> **How can relational dependency data and heterogeneous vulnerability data be modeled and queried efficiently for transitive vulnerability impact analysis and what-if dependency simulation?**

## Secondary Research Question
> **What are the performance trade-offs between runtime recursive dependency closure, materialized closure, B-Tree indexing, JSONB storage, and caching?**

---

## Benchmark Experiments

### Experiment 1: Runtime Recursive CTE vs Materialized Closure Table
- **Objective**: Compare runtime PostgreSQL recursive graph traversal (`WITH RECURSIVE`) against querying a pre-computed `materialized_closures` table.
- **Trade-off**:
  - Runtime CTE requires zero write maintenance during dependency edge insertions, making it ideal for dynamic what-if simulations.
  - Materialized closure tables accelerate read queries (~2x speedup) at the cost of O(V²) storage overhead and write synchronization triggers.

### Experiment 2: B-Tree Indexing Impact
- **Objective**: Measure query latency when querying packages with and without B-Tree indexes on `Package(name, ecosystem)`.
- **Finding**: Indexing reduces lookup latency by over 75% compared to sequential table scans.

### Experiment 3: PostgreSQL JSONB vs MongoDB Document Storage
- **Objective**: Compare querying heterogeneous OSV vulnerability documents in PostgreSQL `JSONB` columns with GIN indexes versus MongoDB collections.
- **Finding**: PostgreSQL `JSONB` achieves competitive query latency for structured document lookups while providing transactional ACID guarantees alongside relational data. MongoDB provides superior schema flexibility for bulk advisory feeds.

### Experiment 4: Traversal Caching
- **Objective**: Evaluate in-memory LRU caching of transitive closure results.
- **Finding**: In-memory caching provides over 90x speedup for repeated closure queries.
