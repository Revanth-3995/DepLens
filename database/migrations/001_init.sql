-- DepLens PostgreSQL Database Schema Migration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    ecosystem VARCHAR(50) NOT NULL DEFAULT 'npm',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Packages table (e.g. express, lodash, package-a)
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    ecosystem VARCHAR(50) NOT NULL DEFAULT 'npm',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_package_ecosystem UNIQUE(name, ecosystem)
);

-- Package Versions table (e.g. express@4.18.2)
CREATE TABLE IF NOT EXISTS package_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    version VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_package_version UNIQUE(package_id, version)
);

-- Dependency Edges (source_version -> target_package version_requirement)
CREATE TABLE IF NOT EXISTS dependency_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_version_id UUID NOT NULL REFERENCES package_versions(id) ON DELETE CASCADE,
    target_package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    version_requirement VARCHAR(100) NOT NULL,
    is_dev BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_dependency_edge UNIQUE(source_version_id, target_package_id, version_requirement)
);

-- Scans table
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    source VARCHAR(100) NOT NULL DEFAULT 'package-lock.json',
    total_dependencies INT NOT NULL DEFAULT 0,
    direct_dependencies INT NOT NULL DEFAULT 0,
    transitive_dependencies INT NOT NULL DEFAULT 0,
    vulnerabilities_count INT NOT NULL DEFAULT 0,
    vulnerable_paths_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scan Dependencies table (resolved packages for a specific scan)
CREATE TABLE IF NOT EXISTS scan_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    package_version_id UUID NOT NULL REFERENCES package_versions(id) ON DELETE CASCADE,
    is_direct BOOLEAN NOT NULL DEFAULT FALSE,
    depth INT NOT NULL DEFAULT 1,
    CONSTRAINT unique_scan_dependency UNIQUE(scan_id, package_version_id)
);

-- Materialized Closures table (for closure comparison experiment)
CREATE TABLE IF NOT EXISTS materialized_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    root_version_id UUID NOT NULL REFERENCES package_versions(id) ON DELETE CASCADE,
    ancestor_version_id UUID NOT NULL REFERENCES package_versions(id) ON DELETE CASCADE,
    descendant_version_id UUID NOT NULL REFERENCES package_versions(id) ON DELETE CASCADE,
    depth INT NOT NULL,
    path_array UUID[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PostgreSQL JSONB Advisories table (for JSONB vs MongoDB experiment)
CREATE TABLE IF NOT EXISTS jsonb_advisories (
    id VARCHAR(100) PRIMARY KEY,
    advisory_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Database Indexes for optimized querying
CREATE INDEX IF NOT EXISTS idx_packages_name ON packages(name);
CREATE INDEX IF NOT EXISTS idx_package_versions_pkg_ver ON package_versions(package_id, version);
CREATE INDEX IF NOT EXISTS idx_dependency_edges_source ON dependency_edges(source_version_id);
CREATE INDEX IF NOT EXISTS idx_dependency_edges_target ON dependency_edges(target_package_id);
CREATE INDEX IF NOT EXISTS idx_scans_project_id ON scans(project_id);
CREATE INDEX IF NOT EXISTS idx_scan_dependencies_scan ON scan_dependencies(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_dependencies_pkg_ver ON scan_dependencies(package_version_id);
CREATE INDEX IF NOT EXISTS idx_jsonb_advisories_gin ON jsonb_advisories USING gin (advisory_data);
