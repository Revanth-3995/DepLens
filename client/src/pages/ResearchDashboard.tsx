import React, { useEffect, useState } from 'react';
import { Database, Play, Cpu, Zap, Layers, Server, Clock, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../services/api';
import { BenchmarkMetrics } from '../types';

export const ResearchDashboard: React.FC = () => {
  const [benchmarks, setBenchmarks] = useState<BenchmarkMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchResults = () => {
    setLoading(true);
    api.getBenchmarks()
      .then(setBenchmarks)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleRunBenchmarks = async () => {
    setRunning(true);
    try {
      const results = await api.runBenchmarks();
      setBenchmarks(results);
    } catch (err) {
      console.error(err);
      alert('Failed to execute database benchmarks');
    } finally {
      setRunning(false);
    }
  };

  if (loading && !benchmarks) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
      </div>
    );
  }

  const closureChartData = benchmarks ? [
    { name: 'Runtime Recursive CTE', timeMs: benchmarks.experiments.closureComparison.runtimeCteMs, fill: '#38bdf8' },
    { name: 'Materialized Closure', timeMs: benchmarks.experiments.closureComparison.materializedClosureMs, fill: '#10b981' },
  ] : [];

  const indexChartData = benchmarks ? [
    { name: 'Without Index Scan', timeMs: benchmarks.experiments.indexingComparison.withoutIndexMs, fill: '#f43f5e' },
    { name: 'With B-Tree Index', timeMs: benchmarks.experiments.indexingComparison.withIndexMs, fill: '#10b981' },
  ] : [];

  const storageChartData = benchmarks ? [
    { name: 'PostgreSQL JSONB', timeMs: benchmarks.experiments.advisoryStorageComparison.postgresJsonbMs, fill: '#38bdf8' },
    { name: 'MongoDB Document', timeMs: benchmarks.experiments.advisoryStorageComparison.mongoDbMs, fill: '#a855f7' },
  ] : [];

  const cachingChartData = benchmarks ? [
    { name: 'Uncached CTE Query', timeMs: benchmarks.experiments.cachingComparison.uncachedMs, fill: '#f59e0b' },
    { name: 'In-Memory Cache', timeMs: benchmarks.experiments.cachingComparison.cachedMs, fill: '#10b981' },
  ] : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Database Engineering Research</h1>
            <p className="text-sm text-slate-400 mt-1">
              Performance benchmarks evaluating relational graph CTEs, materialized closures, JSONB vs MongoDB, and indexing.
            </p>
          </div>
        </div>

        <button
          onClick={handleRunBenchmarks}
          disabled={running}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-sm transition disabled:opacity-50 shrink-0"
        >
          <Play className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          <span>{running ? 'Executing Experiments...' : 'Run Database Benchmarks'}</span>
        </button>
      </div>

      {benchmarks && (
        <div className="space-y-8">

          {/* Metadata Banner */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>Last Executed: <strong className="text-slate-200">{new Date(benchmarks.timestamp).toLocaleString()}</strong></span>
            </div>
            <div className="flex items-center space-x-4">
              <span>PostgreSQL 16 Engine</span>
              <span>•</span>
              <span>MongoDB 7 Document Store</span>
            </div>
          </div>

          {/* Experiment Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Experiment 1: Closure Comparison */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-sky-400" />
                  <h2 className="text-base font-bold text-white">Experiment 1: Transitive Closure</h2>
                </div>
                <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/50">
                  {benchmarks.experiments.closureComparison.speedupFactor}x Speedup
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Runtime PostgreSQL Recursive CTE graph traversal vs Materialized closure pre-computation table lookup.
              </p>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={closureChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit=" ms" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="timeMs" radius={[4, 4, 0, 0]}>
                      {closureChartData.map((e, idx) => (
                        <Cell key={idx} fill={e.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-700/50">
                <div>Runtime CTE: <strong className="text-sky-300">{benchmarks.experiments.closureComparison.runtimeCteMs} ms</strong></div>
                <div>Materialized: <strong className="text-emerald-300">{benchmarks.experiments.closureComparison.materializedClosureMs} ms</strong></div>
              </div>
            </div>

            {/* Experiment 2: Indexing Comparison */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-bold text-white">Experiment 2: B-Tree Index Impact</h2>
                </div>
                <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/50">
                  {benchmarks.experiments.indexingComparison.improvementPercent}% Faster
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Query execution time comparing indexed lookup <code className="text-sky-300">Package(name, ecosystem)</code> vs full sequential table scan.
              </p>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={indexChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit=" ms" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="timeMs" radius={[4, 4, 0, 0]}>
                      {indexChartData.map((e, idx) => (
                        <Cell key={idx} fill={e.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-700/50">
                <div>Without Index: <strong className="text-rose-400">{benchmarks.experiments.indexingComparison.withoutIndexMs} ms</strong></div>
                <div>With Index: <strong className="text-emerald-300">{benchmarks.experiments.indexingComparison.withIndexMs} ms</strong></div>
              </div>
            </div>

            {/* Experiment 3: JSONB vs MongoDB */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Server className="w-5 h-5 text-purple-400" />
                  <h2 className="text-base font-bold text-white">Experiment 3: JSONB vs MongoDB</h2>
                </div>
                <span className="text-xs font-bold font-mono text-indigo-300 bg-indigo-950/60 px-2.5 py-1 rounded border border-indigo-800/50">
                  {benchmarks.experiments.advisoryStorageComparison.fastest}
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Heterogeneous advisory document retrieval: PostgreSQL JSONB column GIN index vs MongoDB document collection.
              </p>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={storageChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit=" ms" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="timeMs" radius={[4, 4, 0, 0]}>
                      {storageChartData.map((e, idx) => (
                        <Cell key={idx} fill={e.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-700/50">
                <div>PostgreSQL JSONB: <strong className="text-sky-300">{benchmarks.experiments.advisoryStorageComparison.postgresJsonbMs} ms</strong></div>
                <div>MongoDB Doc: <strong className="text-purple-300">{benchmarks.experiments.advisoryStorageComparison.mongoDbMs} ms</strong></div>
              </div>
            </div>

            {/* Experiment 4: Caching Speedup */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-bold text-white">Experiment 4: Traversal Caching</h2>
                </div>
                <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/50">
                  {benchmarks.experiments.cachingComparison.speedupFactor}x Speedup
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Latency comparison between uncached database CTE execution vs in-memory LRU graph cache lookup.
              </p>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cachingChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit=" ms" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="timeMs" radius={[4, 4, 0, 0]}>
                      {cachingChartData.map((e, idx) => (
                        <Cell key={idx} fill={e.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-700/50">
                <div>Uncached CTE: <strong className="text-amber-400">{benchmarks.experiments.cachingComparison.uncachedMs} ms</strong></div>
                <div>Cached Lookup: <strong className="text-emerald-300">{benchmarks.experiments.cachingComparison.cachedMs} ms</strong></div>
              </div>
            </div>

          </div>

          {/* Research Trade-offs Summary Table */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2">
              <BarChart2 className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-bold text-white">Database Design & Trade-Off Matrix</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold border-b border-slate-700/60">
                  <tr>
                    <th className="px-4 py-3">Strategy</th>
                    <th className="px-4 py-3">Read Latency</th>
                    <th className="px-4 py-3">Write / Rebuild Overhead</th>
                    <th className="px-4 py-3">Storage Requirement</th>
                    <th className="px-4 py-3">Recommended Use Case</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  <tr className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-bold text-sky-300">Runtime Recursive CTE</td>
                    <td className="px-4 py-3">Medium (1-3 ms)</td>
                    <td className="px-4 py-3 text-emerald-400">Zero write overhead</td>
                    <td className="px-4 py-3 text-emerald-400">Minimal (Graph edges only)</td>
                    <td className="px-4 py-3">Real-time What-If simulations & dynamic graphs</td>
                  </tr>
                  <tr className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-bold text-emerald-300">Materialized Closure Table</td>
                    <td className="px-4 py-3 text-emerald-400">Fast (&lt; 1 ms)</td>
                    <td className="px-4 py-3 text-amber-400">Requires background sync on edge insert</td>
                    <td className="px-4 py-3 text-amber-400">O(V²) space for closure rows</td>
                    <td className="px-4 py-3">High-frequency read dashboards & security analytics</td>
                  </tr>
                  <tr className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-bold text-purple-300">MongoDB Advisory Storage</td>
                    <td className="px-4 py-3">Fast (&lt; 2 ms)</td>
                    <td className="px-4 py-3 text-emerald-400">Flexible schema updates</td>
                    <td className="px-4 py-3">Medium (JSON documents)</td>
                    <td className="px-4 py-3">Heterogeneous OSV vulnerability advisory ingestion</td>
                  </tr>
                  <tr className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-bold text-indigo-300">PostgreSQL JSONB Storage</td>
                    <td className="px-4 py-3 text-emerald-400">Very Fast (&lt; 1 ms)</td>
                    <td className="px-4 py-3">ACID relational transactional lock</td>
                    <td className="px-4 py-3">Compact JSONB binary format</td>
                    <td className="px-4 py-3">Unified single-database deployments with JSON indexing</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
