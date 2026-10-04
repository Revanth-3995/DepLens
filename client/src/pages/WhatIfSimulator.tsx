import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GitCompare, ArrowRight, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { Project, ScanDependency, SimulationResult } from '../types';

export const WhatIfSimulator: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';
  const initialPackageName = searchParams.get('package') || '';

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [projectDeps, setProjectDeps] = useState<ScanDependency[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>(initialPackageName);

  const [simulationType, setSimulationType] = useState<'UPGRADE' | 'REMOVE'>('UPGRADE');
  const [proposedVersion, setProposedVersion] = useState<string>('2.5.0');

  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    api.getProjects()
      .then((projs) => {
        setProjects(projs);
        if (!selectedProjectId && projs.length > 0) {
          setSelectedProjectId(projs[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    setLoading(true);

    api.getProject(selectedProjectId)
      .then(({ scans }) => {
        if (scans.length > 0) {
          return api.getScanDetails(scans[0].id);
        }
        return null;
      })
      .then((detail) => {
        if (detail) {
          const directDeps = detail.dependencies.filter((d) => d.is_direct);
          setProjectDeps(directDeps);
          if (directDeps.length > 0 && !selectedPackage) {
            setSelectedPackage(directDeps[0].package_name);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedProjectId]);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedPackage) return;
    setSimulating(true);
    setError('');

    try {
      let result: SimulationResult;
      if (simulationType === 'UPGRADE') {
        result = await api.simulateUpgrade(selectedProjectId, selectedPackage, proposedVersion);
      } else {
        result = await api.simulateRemove(selectedProjectId, selectedPackage);
      }
      setSimulationResult(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <GitCompare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">What-If Dependency Simulator</h1>
            <p className="text-sm text-slate-400 mt-1">
              Simulate dependency upgrades or removals and evaluate the resulting transitive vulnerability state without mutating project data.
            </p>
          </div>
        </div>
      </div>

      {/* Control Form */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-6 shadow-sm">
        <form onSubmit={handleSimulate} className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">

          {/* Select Project */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Target Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Select Direct Dependency */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Direct Dependency</label>
            <select
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
              disabled={loading || projectDeps.length === 0}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 disabled:opacity-50"
            >
              {projectDeps.map((d) => (
                <option key={d.package_name} value={d.package_name}>
                  {d.package_name} ({d.version})
                </option>
              ))}
            </select>
          </div>

          {/* Action Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Simulation Action</label>
            <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-700 text-xs font-medium">
              <button
                type="button"
                onClick={() => setSimulationType('UPGRADE')}
                className={`flex-1 py-1.5 rounded-md transition ${
                  simulationType === 'UPGRADE' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Upgrade
              </button>
              <button
                type="button"
                onClick={() => setSimulationType('REMOVE')}
                className={`flex-1 py-1.5 rounded-md transition ${
                  simulationType === 'REMOVE' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Remove
              </button>
            </div>
          </div>

          {/* Proposed Version / Action Submit */}
          <div className="flex items-center space-x-3">
            {simulationType === 'UPGRADE' ? (
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Proposed Version</label>
                <input
                  type="text"
                  required
                  value={proposedVersion}
                  onChange={(e) => setProposedVersion(e.target.value)}
                  placeholder="e.g. 2.5.0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            ) : (
              <div className="flex-1 text-xs text-slate-400 italic">Simulate complete removal from manifest.</div>
            )}

            <button
              type="submit"
              disabled={simulating || !selectedPackage}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5 shrink-0 disabled:opacity-50 h-[38px] mt-auto"
            >
              {simulating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Simulate Change</span>
                </>
              )}
            </button>
          </div>

        </form>

        {error && (
          <div className="mt-4 p-3 bg-rose-950/60 border border-rose-800/60 rounded-lg text-xs text-rose-300">
            {error}
          </div>
        )}
      </div>

      {/* Simulation Results Display */}
      {simulationResult && (
        <div className="space-y-6 animate-fadeIn">

          {/* Explanation Banner */}
          <div className="bg-sky-950/40 border border-sky-800/60 rounded-xl p-5 shadow-sm flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Simulation Analysis Summary</h2>
              <p className="text-sm text-sky-200 mt-1 leading-relaxed">{simulationResult.diff.explanationText}</p>
            </div>
          </div>

          {/* Side-by-Side Before / After Matrix (Section 6 & 26) */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-white">Before / After Comparison Matrix</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/60 text-xs text-slate-400 uppercase font-semibold border-b border-slate-700/60">
                  <tr>
                    <th className="px-4 py-3">Metric</th>
                    <th className="px-4 py-3 text-center bg-slate-900/40">BEFORE (Current State)</th>
                    <th className="px-4 py-3 text-center bg-amber-950/20 text-amber-300">AFTER (Simulated State)</th>
                    <th className="px-4 py-3 text-right">Net Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40 font-mono text-xs">
                  <tr className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-sans font-semibold text-white">Total Dependencies</td>
                    <td className="px-4 py-3 text-center bg-slate-900/20 font-bold">{simulationResult.before.totalDependencies}</td>
                    <td className="px-4 py-3 text-center bg-amber-950/10 font-bold text-amber-300">{simulationResult.after.totalDependencies}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      {simulationResult.after.totalDependencies - simulationResult.before.totalDependencies}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-sans font-semibold text-white">Direct Dependencies</td>
                    <td className="px-4 py-3 text-center bg-slate-900/20">{simulationResult.before.directDependencies}</td>
                    <td className="px-4 py-3 text-center bg-amber-950/10 text-amber-300">{simulationResult.after.directDependencies}</td>
                    <td className="px-4 py-3 text-right">
                      {simulationResult.after.directDependencies - simulationResult.before.directDependencies}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-sans font-semibold text-white">Transitive Closure Count</td>
                    <td className="px-4 py-3 text-center bg-slate-900/20">{simulationResult.before.transitiveDependencies}</td>
                    <td className="px-4 py-3 text-center bg-amber-950/10 text-amber-300">{simulationResult.after.transitiveDependencies}</td>
                    <td className="px-4 py-3 text-right">
                      {simulationResult.after.transitiveDependencies - simulationResult.before.transitiveDependencies}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-sans font-semibold text-white">Vulnerabilities Count</td>
                    <td className="px-4 py-3 text-center bg-slate-900/20 font-bold text-rose-400">
                      {simulationResult.before.vulnerabilitiesCount}
                    </td>
                    <td className="px-4 py-3 text-center bg-amber-950/10 font-bold text-amber-300">
                      {simulationResult.after.vulnerabilitiesCount}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                      {simulationResult.after.vulnerabilitiesCount - simulationResult.before.vulnerabilitiesCount}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-sans font-semibold text-white">Vulnerable Paths Count</td>
                    <td className="px-4 py-3 text-center bg-slate-900/20">{simulationResult.before.vulnerablePathsCount}</td>
                    <td className="px-4 py-3 text-center bg-amber-950/10 text-amber-300">{simulationResult.after.vulnerablePathsCount}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                      {simulationResult.after.vulnerablePathsCount - simulationResult.before.vulnerablePathsCount}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Resolved vs Remaining Issues */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Resolved Vulnerabilities */}
            <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-5 space-y-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Resolved Vulnerabilities ({simulationResult.diff.resolvedVulnerabilities.length})</span>
              </div>

              <div className="space-y-2 text-xs">
                {simulationResult.diff.resolvedVulnerabilities.map((v) => (
                  <div key={v.advisoryId} className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between font-mono font-bold text-emerald-400">
                      <span>{v.advisoryId}</span>
                      <span>{v.packageName} ({v.installedVersion})</span>
                    </div>
                    <p className="text-slate-300 mt-1">{v.summary}</p>
                  </div>
                ))}
                {simulationResult.diff.resolvedVulnerabilities.length === 0 && (
                  <div className="text-slate-400 italic">No vulnerabilities were resolved by this change.</div>
                )}
              </div>
            </div>

            {/* Remaining Vulnerabilities */}
            <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-5 space-y-3">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>Remaining Vulnerabilities ({simulationResult.diff.remainingVulnerabilities.length})</span>
              </div>

              <div className="space-y-2 text-xs">
                {simulationResult.diff.remainingVulnerabilities.map((v) => (
                  <div key={v.advisoryId} className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                    <div className="flex items-center justify-between font-mono font-bold text-amber-400">
                      <span>{v.advisoryId}</span>
                      <span>{v.packageName} ({v.installedVersion})</span>
                    </div>
                    <p className="text-slate-300 mt-1">{v.summary}</p>
                  </div>
                ))}
                {simulationResult.diff.remainingVulnerabilities.length === 0 && (
                  <div className="text-slate-400 italic">Zero vulnerabilities remain in simulated state!</div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
