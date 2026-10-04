import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { VulnerabilityDetail } from './pages/VulnerabilityDetail';
import { WhatIfSimulator } from './pages/WhatIfSimulator';
import { ResearchDashboard } from './pages/ResearchDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/vulnerabilities/:id" element={<VulnerabilityDetail />} />
            <Route path="/simulator" element={<WhatIfSimulator />} />
            <Route path="/research" element={<ResearchDashboard />} />
          </Routes>
        </main>
        <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
          <p>DepLens — Software Dependency Vulnerability Impact & What-If Analysis System</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}
