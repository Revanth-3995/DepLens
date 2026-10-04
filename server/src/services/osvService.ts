import { getMongoDb } from '../db/index.js';

export interface OSVAdvisory {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  modified?: string;
  published?: string;
  database_specific?: {
    severity?: string;
    cvss_score?: number;
    [key: string]: any;
  };
  references?: Array<{ type: string; url: string }>;
  affected?: Array<{
    package: { name: string; ecosystem: string };
    ranges?: Array<{
      type: string;
      events: Array<{ introduced?: string; fixed?: string; last_affected?: string }>;
    }>;
    versions?: string[];
  }>;
  sourceType?: 'Live OSV' | 'Local Demo Dataset';
}

export async function fetchAdvisoriesForPackage(
  packageName: string,
  ecosystem = 'npm'
): Promise<{ advisories: OSVAdvisory[]; source: 'Live OSV' | 'Local Demo Dataset' }> {
  const isDemoMode = process.env.DEMO_MODE === 'true';
  const osvApiUrl = process.env.OSV_API_URL || 'https://api.osv.dev/v1';

  if (!isDemoMode) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${osvApiUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: { name: packageName, ecosystem } }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const rawVulns: OSVAdvisory[] = data.vulns || [];
        const advisories = rawVulns.map(v => ({ ...v, sourceType: 'Live OSV' as const }));
        return { advisories, source: 'Live OSV' };
      }
    } catch (err) {
      console.warn(`[OSV Service] Live OSV fetch failed for ${packageName}. Falling back to local dataset.`, err);
    }
  }

  // Fallback to local MongoDB advisory database
  const db = await getMongoDb();
  const docs = await db
    .collection<OSVAdvisory>('advisories')
    .find({ "affected.package.name": packageName })
    .toArray();

  const advisories = docs.map((doc: any) => ({
    id: doc.id,
    summary: doc.summary,
    details: doc.details,
    aliases: doc.aliases,
    modified: doc.modified,
    published: doc.published,
    database_specific: doc.database_specific,
    references: doc.references,
    affected: doc.affected,
    sourceType: 'Local Demo Dataset' as const,
  }));

  return { advisories, source: 'Local Demo Dataset' };
}
