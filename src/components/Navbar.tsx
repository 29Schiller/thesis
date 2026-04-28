import { Activity, Beaker, FileImage, LayoutDashboard, History, Stethoscope, FileSearch, Edit3, BarChart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppView } from '../types';

export function Navbar() {
  const { currentView, setCurrentView, activeResult, backendAlive } = useApp();

  const navItems: { id: AppView; label: string; icon: any; requiresResult: boolean }[] = [
    { id: 'upload', label: 'Upload', icon: FileImage, requiresResult: false },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresResult: true },
    { id: 'lung', label: 'Lung Seg', icon: FileSearch, requiresResult: true },
    { id: 'disease', label: 'Disease Seg', icon: Beaker, requiresResult: true },
    { id: 'severity', label: 'Severity', icon: Activity, requiresResult: true },
    { id: 'annotation', label: 'Annotation', icon: Edit3, requiresResult: true },
    { id: 'reliability', label: 'Reliability', icon: BarChart, requiresResult: false },
    { id: 'history', label: 'History', icon: History, requiresResult: false },
  ];

  return (
    <nav className="bg-gray-900 border-b border-gray-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Stethoscope className="h-8 w-8 text-indigo-500 mr-2" />
            <span className="font-bold text-lg hidden sm:block truncate">TTMDSS</span>
          </div>

          <div className="flex overflow-x-auto items-center justify-center flex-1 mx-4 space-x-1 sm:space-x-4 hide-scrollbar">
            {navItems.map(item => {
              const disabled = item.requiresResult && !activeResult;
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => !disabled && setCurrentView(item.id)}
                  disabled={disabled}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors
                    ${active ? 'bg-gray-800 text-indigo-400 border-b-2 border-indigo-500 rounded-b-none' : ''}
                    ${!active && !disabled ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : ''}
                    ${disabled ? 'text-gray-600 cursor-not-allowed' : ''}
                  `}
                >
                  <item.icon className="w-4 h-4 mr-1.5" />
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center">
            {activeResult?.isEnsemble && (
              <span className="mr-4 px-2 py-1 text-xs font-semibold bg-indigo-900 text-indigo-200 rounded-full border border-indigo-700 hidden sm:block">
                Ensemble Active
              </span>
            )}
            <div className="flex items-center space-x-2 bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700">
              <span className="text-xs text-gray-300 hidden sm:block">Backend</span>
              <div className={`w-2.5 h-2.5 rounded-full ${backendAlive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
