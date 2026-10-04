import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Upload, Folder, ShieldAlert, CheckCircle2, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { Project } from '../types';

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Project Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  // Upload Lockfile Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const loadProjects = () => {
    setLoading(true);
    api.getProjects()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      await api.createProject({ name: newProjectName, description: newProjectDesc });
      setNewProjectName('');
      setNewProjectDesc('');
      setShowCreateModal(false);
      loadProjects();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create project');
    }
  };

  const handleUploadLockfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedFile) return;
    setUploading(true);
    setUploadError('');

    try {
      await api.scanProjectWithFile(selectedProjectId, selectedFile);
      setShowUploadModal(false);
      setSelectedFile(null);
      loadProjects();
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to upload and scan package-lock.json');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete project "${name}"?`)) return;
    try {
      await api.deleteProject(id);
      loadProjects();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete project');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Project Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage projects and upload npm <code className="text-sky-300 font-mono">package-lock.json</code> dependency manifests.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-sm rounded-lg transition"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Lockfile</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((proj) => {
          const hasVulns = (proj.vulnerabilities_count || 0) > 0;
          return (
            <div
              key={proj.id}
              className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-600 transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-slate-700/60 rounded-lg text-sky-400">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white leading-snug">
                        <Link to={`/projects/${proj.id}`} className="hover:text-sky-400 transition">
                          {proj.name}
                        </Link>
                      </h3>
                      <span className="text-xs font-mono text-slate-400">{proj.ecosystem}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteProject(proj.id, proj.name)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-300 mt-3 line-clamp-2">
                  {proj.description || 'No description provided.'}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-slate-700/50">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">Dependencies</span>
                    <p className="text-lg font-bold text-white mt-0.5">{proj.total_dependencies || 0}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">Vulnerabilities</span>
                    <p className={`text-lg font-bold mt-0.5 ${hasVulns ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {proj.vulnerabilities_count || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-700/50">
                {hasVulns ? (
                  <span className="inline-flex items-center space-x-1.5 text-xs font-medium text-rose-400">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Advisories Detected</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 text-xs font-medium text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>No Advisories</span>
                  </span>
                )}

                <Link
                  to={`/projects/${proj.id}`}
                  className="text-xs font-medium text-sky-400 hover:text-sky-300 transition"
                >
                  Inspect Details →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Create New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Payment Microservice"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Optional project description..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg text-sm"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Lockfile Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">Upload package-lock.json</h2>
            <p className="text-xs text-slate-400 mb-4">
              Select a project and upload a lockfile to parse dependencies and run a vulnerability scan.
            </p>

            {uploadError && (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800/60 rounded-lg text-xs text-rose-300">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadLockfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Target Project</label>
                <select
                  required
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  package-lock.json File
                </label>
                <input
                  type="file"
                  accept=".json"
                  required
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg text-sm disabled:opacity-50"
                >
                  {uploading ? 'Processing & Scanning...' : 'Upload & Scan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
