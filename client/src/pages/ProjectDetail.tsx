import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldAlert, PackageCheck, Layers, GitCompare, ArrowLeft, Search, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { Project, Scan, ScanDependency, MatchedVulnerability } from '../types';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string>('');

  const [scanDependencies, setScanDependencies] = useState<ScanDependency[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<MatchedVulnerability[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'DIRECT' | 'TRANSITIVE' | 'VULNERABLE'>('ALL');

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    api.getProject(id)
      .then(({ project, scans }) => {
        setProject(project);
        setScans(scans);
        if (scans.length > 0) {
          const latestId = scans[0].id;
          setSelectedScanId(latestId);
          return api.getScanDetails(latestId);
        }
        return null;
      })
      .then((scanDetail) => {
        if (scanDetail) {
          setScanDependencies(scanDetail.dependencies);
          setVulnerabilities(scanDetail.vulnerabilities);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleScanChange = async (scanId: string) => {
    setSelectedScanId(scanId);
    setLoading(true);
    try {
      const detail = await api.getScanDetails(scanId);
      setScanDependencies(detail.dependencies);
      setVulnerabilities(detail.vulnerabilities);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !project) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
      </div>
    );
  }

  if (!project) {
    return <div className="text-center text-slate-400 py-12">Project not found.</div>;
  }

  const vulnerablePackageNames = new Set(vulnerabilities.map(v => v.packageName));

  const filteredDeps = scanDependencies.filter((dep) => {
    const matchesSearch = dep.package_name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'DIRECT') return dep.is_direct;
    if (filterType === 'TRANSITIVE') return !dep.is_direct;
    if (filterType === 'VULNERABLE') return vulnerablePackageNames.has(dep.package_name);
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Back Link & Header */}
      <div className="space-y-4 border-b border-slate-800 pb-5">
        <Link to="/projects" className="inline-flex items-center space-x-2 text-xs font-medium text-sky-400 hover:text-sky-300">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{project.name}</h1>
              <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-slate-800 text-sky-300 border border-slate-700">
                {project.ecosystem}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{project.description || 'Monitored dependency project.'}</p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to={`/simulator?projectId=${project.id}`}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/30 font-medium text-xs rounded-lg transition"
            >
              <GitCompare className="w-4 h-4" />
              <span>Simulate Dependency Changes</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Historical Scan Selector & Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Scans Timeline Selector */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 shadow-sm">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Historical Scan Timeline
          </label>
          <select
            value={selectedScanId}
            onChange={(e) => handleScanChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
          >
            {scans.map((s, idx) => (
              <option key={s.id} value={s.id}>
                Scan #{scans.length - idx} ({new Date(s.created_at).toLocaleDateString()})
              </option>
            ))}
          </select>

          <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2 text-xs text-slate-400">
            <div><strong>Scan ID:</strong> <span className="font-mono text-slate-300">{selectedScanId.substring(0, 8)}...</span></div>
            <div><strong>Source:</strong> <span className="text-slate-300">{scans.find(s => s.id === selectedScanId)?.source}</span></div>
            <div><strong>Scanned At:</strong> <span className="text-slate-300">{new Date(scans.find(s => s.id === selectedScanId)?.created_at || '').toLocaleString()}</span></div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase">Total Dependencies</span>
              <PackageCheck className="w-5 h-5 text-sky-400" />
            </div>
            <p className="text-3xl font-extrabold text-white mt-3">{scanDependencies.length}</p>
            <p className="text-xs text-slate-400 mt-1">
              Direct: {scanDependencies.filter(d => d.is_direct).length} | Transitive: {scanDependencies.filter(d => !d.is_direct).length}
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase">Active Vulnerabilities</span>
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-3xl font-extrabold text-amber-400 mt-3">{vulnerabilities.length}</p>
            <p className="text-xs text-slate-400 mt-1">Advisories in current closure</p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase">Security Status</span>
              {vulnerabilities.length > 0 ? (
                <ShieldAlert className="w-5 h-5 text-rose-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <p className={`text-xl font-bold mt-3 ${vulnerabilities.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {vulnerabilities.length > 0 ? 'Action Required' : 'All Clear'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {vulnerabilities.length > 0 ? 'Review vulnerable paths below' : 'Zero vulnerabilities found'}
            </p>
          </div>
        </div>

      </div>

      {/* Vulnerabilities Section if present */}
      {vulnerabilities.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Detected Vulnerability Advisories</h2>
            </div>
            <span className="text-xs font-medium text-amber-300 bg-amber-900/60 px-2.5 py-1 rounded-full border border-amber-700/50">
              {vulnerabilities.length} Advisory Match(es)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vulnerabilities.map((vuln) => (
              <div
                key={vuln.advisoryId}
                className="bg-slate-800/90 border border-slate-700 rounded-lg p-4 shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-amber-400">{vuln.advisoryId}</span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                      {vuln.severity}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white line-clamp-1">{vuln.summary}</h3>

                  <div className="mt-3 text-xs text-slate-300 space-y-1">
                    <div><strong>Package:</strong> <code className="text-sky-300">{vuln.packageName}</code> ({vuln.installedVersion})</div>
                    <div><strong>Affected:</strong> <span className="text-rose-300">{vuln.affectedRange}</span></div>
                    <div><strong>Fix:</strong> <span className="text-emerald-300">{vuln.fixedVersion || 'N/A'}</span></div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Source: {vuln.dataSource}</span>
                  <Link
                    to={`/vulnerabilities/${vuln.advisoryId}?scanId=${selectedScanId}&packageName=${vuln.packageName}&installedVersion=${vuln.installedVersion}`}
                    className="text-sky-400 font-medium hover:underline"
                  >
                    View Trace & Path →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved Dependencies Table */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white">Resolved Dependency Closure</h2>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search packages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-700 text-xs font-medium text-slate-300">
              {(['ALL', 'DIRECT', 'TRANSITIVE', 'VULNERABLE'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 py-1 rounded-md transition ${
                    filterType === type ? 'bg-sky-600 text-white shadow' : 'hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-xs text-slate-400 uppercase font-semibold border-b border-slate-700/60">
              <tr>
                <th className="px-4 py-3">Package Name</th>
                <th className="px-4 py-3">Resolved Version</th>
                <th className="px-4 py-3">Dependency Type</th>
                <th className="px-4 py-3">Tree Depth</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {filteredDeps.map((dep, idx) => {
                const isVuln = vulnerablePackageNames.has(dep.package_name);
                return (
                  <tr key={`${dep.package_name}-${idx}`} className="hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3 font-mono font-semibold text-white">{dep.package_name}</td>
                    <td className="px-4 py-3 font-mono text-sky-300">{dep.version}</td>
                    <td className="px-4 py-3">
                      {dep.is_direct ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-sky-950 text-sky-300 border border-sky-800">
                          Direct
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-900 text-slate-400 border border-slate-700">
                          Transitive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">Depth {dep.depth}</td>
                    <td className="px-4 py-3">
                      {isVuln ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/60 text-rose-400 border border-rose-800/50">
                          Vulnerable
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                          Secure
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {dep.is_direct && (
                        <Link
                          to={`/simulator?projectId=${project.id}&package=${dep.package_name}`}
                          className="text-xs text-amber-400 hover:text-amber-300 hover:underline"
                        >
                          Simulate What-If →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
