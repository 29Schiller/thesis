import { useState } from 'react';
import { Trash2, Search, Calendar, ChevronRight, Activity } from 'lucide-react';
import type { PredictionResult } from '../types';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

interface HistoryViewProps {
  history: PredictionResult[];
  onSelect: (record: PredictionResult) => void;
  onDelete: (id: string) => void;
}

export function HistoryView({ history, onSelect, onDelete }: HistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = history.filter(h => 
    h.patient_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    h.created_at.includes(searchTerm)
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Patient History</h2>
          <p className="text-slate-400 mt-1 text-sm">Review past clinical severity scorings.</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search Patient ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 w-full md:w-64 text-slate-200 placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center">
             <Activity className="opacity-20 mb-4" size={48} />
             <p className="font-medium text-slate-300">No records found</p>
             <p className="text-sm mt-1">Generate a new analysis to see it here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-900/80 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Patient ID</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-center">Score</th>
                  <th className="px-6 py-4">Model</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredHistory.map((record) => (
                  <tr 
                    key={record.id} 
                    className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                    onClick={() => onSelect(record)}
                  >
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {record.patient_id}
                    </td>
                    <td className="px-6 py-4 text-slate-400 flex items-center gap-2">
                       <Calendar size={14} className="text-slate-500" />
                       {format(parseISO(record.created_at), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className={cn(
                          "px-2.5 py-1 rounded text-xs font-bold inline-flex w-12 justify-center border",
                          record.severity_score < 2 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                          record.severity_score < 4 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                       )}>
                         {record.severity_score.toFixed(1)}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="uppercase text-[10px] font-bold tracking-wider bg-slate-800 border border-slate-700 px-2 py-1 rounded text-slate-400">
                        {record.model_used}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2 text-slate-500">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
                            className="p-2 hover:bg-rose-500/10 hover:text-rose-400 rounded transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 size={16} />
                          </button>
                          <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0 duration-200" />
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
