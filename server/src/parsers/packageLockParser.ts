export interface ParsedDependency {
  name: string;
  version: string;
  isDirect: boolean;
  dependencies: Record<string, string>; // package_name -> version_req
}

export interface ParsedLockfile {
  name: string;
  version: string;
  lockfileVersion: number;
  dependencies: Map<string, ParsedDependency>; // key: "pkgName@version"
  directDependencies: Set<string>; // direct package names
}

export function parsePackageLockJson(jsonContent: string): ParsedLockfile {
  let raw: any;
  try {
    raw = JSON.parse(jsonContent);
  } catch (err: any) {
    throw new Error(`Invalid JSON format: ${err.message}`);
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid package-lock.json format: expected root object');
  }

  const name = raw.name || 'unnamed-project';
  const version = raw.version || '1.0.0';
  const lockfileVersion = raw.lockfileVersion || 1;

  const dependenciesMap = new Map<string, ParsedDependency>();
  const directDependencies = new Set<string>();

  // Determine direct dependency names from root dependencies / devDependencies
  if (raw.dependencies && typeof raw.dependencies === 'object') {
    Object.keys(raw.dependencies).forEach((depName) => directDependencies.add(depName));
  }
  if (raw.devDependencies && typeof raw.devDependencies === 'object') {
    Object.keys(raw.devDependencies).forEach((depName) => directDependencies.add(depName));
  }

  if (lockfileVersion >= 2 && raw.packages && typeof raw.packages === 'object') {
    // Parse v2 / v3 format
    const rootPkg = raw.packages[''] || {};
    if (rootPkg.dependencies) {
      Object.keys(rootPkg.dependencies).forEach((d) => directDependencies.add(d));
    }
    if (rootPkg.devDependencies) {
      Object.keys(rootPkg.devDependencies).forEach((d) => directDependencies.add(d));
    }

    Object.entries(raw.packages).forEach(([pkgPath, pkgObj]: [string, any]) => {
      if (pkgPath === '') return; // Skip root project itself

      // Extract package name from node_modules path (e.g., "node_modules/foo" or "node_modules/parent/node_modules/child")
      const pathParts = pkgPath.split('node_modules/');
      const pkgName = pathParts[pathParts.length - 1];
      if (!pkgName || !pkgObj || !pkgObj.version) return;

      const isDirect = directDependencies.has(pkgName);
      const subDeps: Record<string, string> = {
        ...(pkgObj.dependencies || {}),
      };

      const depKey = `${pkgName}@${pkgObj.version}`;
      if (!dependenciesMap.has(depKey)) {
        dependenciesMap.set(depKey, {
          name: pkgName,
          version: pkgObj.version,
          isDirect,
          dependencies: subDeps,
        });
      }
    });
  } else if (raw.dependencies && typeof raw.dependencies === 'object') {
    // Parse v1 format (recursive nesting)
    function traverseV1(depsObj: Record<string, any>, isTopLevel: boolean) {
      Object.entries(depsObj).forEach(([pkgName, pkgObj]: [string, any]) => {
        if (!pkgObj || typeof pkgObj !== 'object' || !pkgObj.version) return;

        const isDirect = isTopLevel || directDependencies.has(pkgName);
        const subDeps: Record<string, string> = {
          ...(pkgObj.requires || pkgObj.dependencies ?
            Object.fromEntries(
              Object.entries(pkgObj.requires || pkgObj.dependencies || {}).map(([k, v]: [string, any]) => [
                k,
                typeof v === 'string' ? v : v.version || '*'
              ])
            ) : {}),
        };

        const depKey = `${pkgName}@${pkgObj.version}`;
        if (!dependenciesMap.has(depKey)) {
          dependenciesMap.set(depKey, {
            name: pkgName,
            version: pkgObj.version,
            isDirect,
            dependencies: subDeps,
          });
        }

        if (pkgObj.dependencies && typeof pkgObj.dependencies === 'object') {
          traverseV1(pkgObj.dependencies, false);
        }
      });
    }

    traverseV1(raw.dependencies, true);
  }

  return {
    name,
    version,
    lockfileVersion,
    dependencies: dependenciesMap,
    directDependencies,
  };
}
