import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, PackageCheck, AlertTriangle, Layers, ArrowRight, Activity, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../services/api';
import { Project } from '../types';

export const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProjects()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalProjects = projects.length;
  const totalDeps = projects.reduce((acc, p) => acc + (p.total_dependencies || 0), 0);
  const totalVulns = projects.reduce((acc, p) => acc + (p.vulnerabilities_count || 0), 0);
  const atRiskProjects = projects.filter((p) => (p.vulnerabilities_count || 0) > 0).length;

  const chartData = projects.map((p) => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
    Vulnerabilities: p.vulnerabilities_count || 0,
    Dependencies: p.total_dependencies || 0,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Database-centric software dependency analysis & transitive vulnerability impact dashboard.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to="/projects"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Project / Upload Lockfile</span>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Projects</span>
            <div className="p-2 bg-slate-700/50 rounded-lg text-slate-300">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-3">{totalProjects}</p>
          <p className="text-xs text-slate-400 mt-2">Active monitored applications</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Dependencies</span>
            <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-3">{totalDeps}</p>
          <p className="text-xs text-slate-400 mt-2">Direct & transitive packages</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Vulnerabilities</span>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-400 mt-3">{totalVulns}</p>
          <p className="text-xs text-slate-400 mt-2">Active advisory matches</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">At-Risk Projects</span>
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-rose-400 mt-3">{atRiskProjects}</p>
          <p className="text-xs text-slate-400 mt-2">Projects requiring remediation</p>
        </div>
      </div>

      {/* Main Visual Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Projects Chart */}
        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700/60 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Vulnerabilities per Project</h2>
              <p className="text-xs text-slate-400">Database query results across monitored systems</p>
            </div>
            <Activity className="w-5 h-5 text-sky-400" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="Vulnerabilities" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.Vulnerabilities > 0 ? '#f43f5e' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Features Highlights */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">DepLens Core Capabilities</h2>
            <p className="text-xs text-slate-400 mb-4">PostgreSQL & MongoDB hybrid architecture</p>

            <ul className="space-y-3.5 text-sm text-slate-300">
              <li className="flex items-start space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 mt-1.5 shrink-0"></span>
                <span><strong>Recursive Graph CTE:</strong> Computes complete transitive dependency closures.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
                <span><strong>Path Explanation:</strong> Traces exact chains from root project to vulnerable package.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0"></span>
                <span><strong>What-If Simulation:</strong> Simulates upgrades & removals without mutating database state.</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
                <span><strong>DBMS Benchmarks:</strong> Evaluates CTE vs Materialized closures and JSONB vs Mongo queries.</span>
              </li>
            </ul>
          </div>

          <Link
            to="/simulator"
            className="mt-6 flex items-center justify-between px-4 py-2.5 bg-slate-700/60 hover:bg-slate-700 text-sky-400 font-medium text-xs rounded-lg border border-slate-600/50 transition group"
          >
            <span>Launch What-If Dependency Simulator</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

      </div>

      {/* Projects Table */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Monitored Projects</h2>
          <Link to="/projects" className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center space-x-1">
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-xs text-slate-400 uppercase font-semibold border-b border-slate-700/60">
              <tr>
                <th className="px-4 py-3">Project Name</th>
                <th className="px-4 py-3">Ecosystem</th>
                <th className="px-4 py-3">Total Dependencies</th>
                <th className="px-4 py-3">Vulnerabilities</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {projects.map((proj) => {
                const hasVulns = (proj.vulnerabilities_count || 0) > 0;
                return (
                  <tr key={proj.id} className="hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3.5 font-semibold text-white">
                      <Link to={`/projects/${proj.id}`} className="hover:text-sky-400 transition">
                        {proj.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-900 border border-slate-700 text-slate-300">
                        {proj.ecosystem}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">{proj.total_dependencies || 0}</td>
                    <td className="px-4 py-3.5">
                      <span className={`font-semibold ${hasVulns ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {proj.vulnerabilities_count || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {hasVulns ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/60 text-rose-400 border border-rose-800/50">
                          Vulnerable
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                          Secure
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        to={`/projects/${proj.id}`}
                        className="text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline"
                      >
                        Inspect →
                      </Link>
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
