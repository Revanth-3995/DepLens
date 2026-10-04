import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert, Layers, GitCompare, Database, CheckCircle2 } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: Layers },
    { label: 'Projects', path: '/projects', icon: ShieldAlert },
    { label: 'What-If Simulator', path: '/simulator', icon: GitCompare },
    { label: 'Database Research', path: '/research', icon: Database },
  ];

  return (
    <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo & Brand */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400 group-hover:bg-sky-500/20 transition">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">DepLens</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                DBMS Core
              </span>
            </div>
          </Link>

          {/* Nav Items */}
          <nav className="flex space-x-1 sm:space-x-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition ${
                    isActive
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Mode Badge */}
          <div className="flex items-center space-x-2">
            <span className="flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Demo Mode: Local Advisories</span>
            </span>
          </div>

        </div>
      </div>
    </header>
  );
};
