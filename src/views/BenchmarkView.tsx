import { BarChart2, ShieldCheck, Zap, Activity } from 'lucide-react';
import { MODELS } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { cn } from '../lib/utils';

export function BenchmarkView() {
  // Sort models by DSC for the bar chart
  const sortedByDsc = [...MODELS].sort((a, b) => b.dsc - a.dsc);
  
  // Format data for Recharts
  const chartData = sortedByDsc.map(m => ({
    name: m.name,
    dsc: Number((m.dsc * 100).toFixed(1)), // percentage
    mae: Number(m.mae.toFixed(3)),
    fps: m.fps,
    params: parseFloat(m.params) || 0,
    isEnsemble: m.isEnsemble || false
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
             <BarChart2 className="text-blue-400" size={24} /> Model Benchmarks
          </h2>
          <p className="text-slate-400 mt-1 text-sm">Compare performance metrics across all available segmentation models.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric Cards */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
           <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <ShieldCheck size={18} />
              <h3 className="font-semibold text-sm">Top Performer (DSC)</h3>
           </div>
           <p className="text-2xl font-bold text-slate-100">{sortedByDsc[0].name}</p>
           <p className="text-slate-400 text-xs mt-1">Dice Similarity: <span className="text-emerald-400 font-mono">{(sortedByDsc[0].dsc * 100).toFixed(1)}%</span></p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
           <div className="flex items-center gap-2 text-rose-400 mb-2">
              <Activity size={18} />
              <h3 className="font-semibold text-sm">Lowest Error (MAE)</h3>
           </div>
           <p className="text-2xl font-bold text-slate-100">{[...MODELS].sort((a,b) => a.mae - b.mae)[0].name}</p>
           <p className="text-slate-400 text-xs mt-1">Mean Absolute Error: <span className="text-rose-400 font-mono">{[...MODELS].sort((a,b) => a.mae - b.mae)[0].mae.toFixed(3)}</span></p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
           <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Zap size={18} />
              <h3 className="font-semibold text-sm">Fastest Inference</h3>
           </div>
           <p className="text-2xl font-bold text-slate-100">{[...MODELS].sort((a,b) => b.fps - a.fps)[0].name}</p>
           <p className="text-slate-400 text-xs mt-1">Speed: <span className="text-blue-400 font-mono">{[...MODELS].sort((a,b) => b.fps - a.fps)[0].fps} FPS</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DSC Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 min-h-[400px] flex flex-col">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 text-center">Dice Similarity Coefficient (%)</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${val}%`} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={100} />
                <Tooltip 
                  cursor={{fill: '#1e293b'}}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '12px' }}
                />
                <Bar dataKey="dsc" name="DSC (%)" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isEnsemble ? '#34d399' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-xs text-slate-500 mt-4">Higher is better. Ensemble models are highlighted in green.</p>
        </div>

        {/* Efficiency Chart: Params vs FPS */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 min-h-[400px] flex flex-col">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 text-center">Speed vs Size</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  type="number" 
                  dataKey="params" 
                  name="Parameters (M)" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  label={{ value: "Params (Millions)", position: 'bottom', fill: '#94a3b8', fontSize: 12 }} 
                />
                <YAxis 
                  type="number" 
                  dataKey="fps" 
                  name="Speed (FPS)" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  label={{ value: "Frames per Second", angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
                />
                <ZAxis type="category" dataKey="name" name="Model" />
                <Tooltip 
                  cursor={{strokeDasharray: '3 3'}}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', fontSize: '12px' }}
                />
                <Scatter data={chartData.filter(d => !d.isEnsemble)} fill="#8b5cf6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-xs text-slate-500 mt-4">Top-left is optimal (Fast & Small). Ensemble omitted.</p>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Detailed Metrics Table</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium">Model Arch</th>
                <th className="px-6 py-4 font-medium text-right">MAE ↓</th>
                <th className="px-6 py-4 font-medium text-right">DSC ↑</th>
                <th className="px-6 py-4 font-medium text-right">Parameters</th>
                <th className="px-6 py-4 font-medium text-right">Speed (FPS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sortedByDsc.map((model) => (
                <tr key={model.id} className={cn("hover:bg-slate-800/30 transition-colors", model.isEnsemble && "bg-emerald-900/10")}>
                  <td className="px-6 py-4 font-medium text-slate-200 flex items-center gap-2">
                    {model.name}
                    {model.isEnsemble && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase">Ensemble</span>}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-rose-400">{model.mae.toFixed(3)}</td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-400">{(model.dsc * 100).toFixed(1)}%</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-400">{model.params}</td>
                  <td className="px-6 py-4 text-right font-mono text-blue-400">{model.fps.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
