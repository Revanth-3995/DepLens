import axios from 'axios';
import { Project, Scan, MatchedVulnerability, ScanDependency, SimulationResult, BenchmarkMetrics } from '../types';

const API_BASE = '/api';

export const api = {
  getHealth: async () => {
    const res = await axios.get(`${API_BASE}/health`);
    return res.data;
  },

  getProjects: async (): Promise<Project[]> => {
    const res = await axios.get(`${API_BASE}/projects`);
    return res.data.projects;
  },

  createProject: async (data: { name: string; description?: string }): Promise<Project> => {
    const res = await axios.post(`${API_BASE}/projects`, data);
    return res.data.project;
  },

  getProject: async (id: string): Promise<{ project: Project; scans: Scan[] }> => {
    const res = await axios.get(`${API_BASE}/projects/${id}`);
    return res.data;
  },

  deleteProject: async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE}/projects/${id}`);
  },

  scanProjectWithFile: async (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/projects/${projectId}/scan`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getScanDetails: async (
    scanId: string
  ): Promise<{
    scan: Scan;
    dependencies: ScanDependency[];
    vulnerabilities: MatchedVulnerability[];
    dataSources: string[];
  }> => {
    const res = await axios.get(`${API_BASE}/scans/${scanId}`);
    return res.data;
  },

  getAdvisory: async (id: string) => {
    const res = await axios.get(`${API_BASE}/vulnerabilities/${id}`);
    return res.data.advisory;
  },

  getAdvisoryProjectImpact: async (id: string) => {
    const res = await axios.get(`${API_BASE}/vulnerabilities/${id}/projects`);
    return res.data;
  },

  getAdvisoryPaths: async (scanId: string, packageName: string, installedVersion?: string) => {
    const res = await axios.get(`${API_BASE}/vulnerabilities/paths`, {
      params: { scanId, packageName, installedVersion },
    });
    return res.data;
  },

  simulateUpgrade: async (projectId: string, targetPackage: string, proposedVersion: string): Promise<SimulationResult> => {
    const res = await axios.post(`${API_BASE}/simulations/upgrade`, { projectId, targetPackage, proposedVersion });
    return res.data.simulation;
  },

  simulateRemove: async (projectId: string, targetPackage: string): Promise<SimulationResult> => {
    const res = await axios.post(`${API_BASE}/simulations/remove`, { projectId, targetPackage });
    return res.data.simulation;
  },

  getBenchmarks: async (): Promise<BenchmarkMetrics> => {
    const res = await axios.get(`${API_BASE}/research/benchmarks`);
    return res.data.results;
  },

  runBenchmarks: async (): Promise<BenchmarkMetrics> => {
    const res = await axios.post(`${API_BASE}/research/benchmarks/run`);
    return res.data.results;
  },
};
