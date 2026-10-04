import { getDependencyPathsForScan } from '../db/queries/dependencyGraph.js';

export interface PathExplanation {
  path: string[];
  explanationText: string;
  isDirect: boolean;
}

export async function explainDependencyPaths(
  projectName: string,
  scanId: string,
  targetPackageName: string,
  targetVersion: string
): Promise<{ paths: string[][]; explanations: PathExplanation[] }> {
  const rawPaths = await getDependencyPathsForScan(projectName, scanId, targetPackageName);

  const explanations: PathExplanation[] = rawPaths.map((path) => {
    const isDirect = path.length === 2; // e.g. ["MyShop", "package-c"]

    let text = `${path[0]}`;
    if (path.length === 2) {
      text += ` → ${path[1]} ${targetVersion} (direct, vulnerable)`;
    } else {
      for (let i = 1; i < path.length; i++) {
        const pkg = path[i];
        if (i === 1) {
          text += ` → ${pkg} (direct)`;
        } else if (i === path.length - 1) {
          text += ` → ${pkg} ${targetVersion} (transitive, vulnerable)`;
        } else {
          text += ` → ${pkg} (transitive)`;
        }
      }
    }

    return {
      path,
      explanationText: text,
      isDirect,
    };
  });

  return {
    paths: rawPaths,
    explanations,
  };
}
