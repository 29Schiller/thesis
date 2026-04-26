import { Activity, UploadCloud, History, Settings, FileBox, Lightbulb, BarChart2, Edit3, Users } from 'lucide-react';
import { cn } from '../lib/utils';

export type ViewType = 'upload' | 'result' | 'history' | 'settings' | 'explain' | 'benchmark' | 'annotation' | 'reliability';

interface SidebarProps {
  currentView: ViewType;
  onChangeView: (view: ViewType) => void;
}

export function Sidebar({ currentView, onChangeView }: SidebarProps) {
  const navItems = [
    { id: 'upload', label: 'New Analysis', icon: UploadCloud },
    { id: 'result', label: 'Current Result', icon: Activity },
    { id: 'history', label: 'Patient History', icon: History },
    { id: 'annotation', label: 'DB Annotation Tool', icon: Edit3 },
    { id: 'explain', label: 'Explainability Labs', icon: Lightbulb },
    { id: 'benchmark', label: 'Model Benchmarks', icon: BarChart2 },
    { id: 'reliability', label: 'Inter-rater Reliability', icon: Users },
  ] as const;

  return (
    <div className="flex flex-col w-64 bg-slate-900/50 h-screen hidden md:flex border-r border-slate-800">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center font-bold text-slate-900">
            C19
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">
            COV-SCORER <span className="text-[10px] bg-slate-800 px-1 rounded text-emerald-400 align-top font-mono">v1.0</span>
          </h1>
        </div>
        
        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium",
                currentView === item.id 
                  ? "bg-emerald-500/10 text-emerald-400" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      
      <div className="mt-auto p-6 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-slate-300 border border-slate-600 text-xs font-medium">
            NM
          </div>
          <div>
            <p className="text-xs text-slate-100 font-semibold">Dr. Nguyen Minh</p>
            <p className="text-slate-500 text-[10px] uppercase">HCMIU Radiologist</p>
          </div>
        </div>
      </div>
    </div>
  );
}
