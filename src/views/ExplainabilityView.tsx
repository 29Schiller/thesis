import { useState, useMemo } from 'react';
import { Lightbulb, Info, FileImage, BarChart4, ChevronDown, Layers } from 'lucide-react';
import type { PredictionResult } from '../types';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';

interface ExplainabilityViewProps {
  history: PredictionResult[];
}

export function ExplainabilityView({ history }: ExplainabilityViewProps) {
  const [selectedRecordId, setSelectedRecordId] = useState<string>(history[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'lime' | 'shap'>('lime');

  const selectedRecord = useMemo(() => 
    history.find(h => h.id === selectedRecordId) || null
  , [history, selectedRecordId]);

  if (history.length === 0) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20 flex flex-col items-center">
        <Lightbulb className="opacity-20 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-300">No Patient Records</h2>
        <p className="text-slate-500 mt-2 max-w-md">
          Run an analysis first to explore model explainability (LIME and SHAP visualizations).
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
             <Lightbulb className="text-amber-400" size={24} /> Explainability Labs
          </h2>
          <p className="text-slate-400 mt-1 text-sm">Understand model predictions through Local Interpretable Model-agnostic Explanations (LIME) and SHapley Additive exPlanations (SHAP).</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
             <select 
               value={selectedRecordId}
               onChange={e => setSelectedRecordId(e.target.value)}
               className="appearance-none bg-slate-900 border border-slate-800 rounded-md py-2 pl-4 pr-10 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[240px]"
             >
                {history.map(record => (
                  <option key={record.id} value={record.id}>
                    {record.patient_id} ({format(parseISO(record.created_at), 'MMM dd, HH:mm')})
                  </option>
                ))}
             </select>
             <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {!selectedRecord ? (
         <div className="p-8 text-center text-slate-500">Please select a record.</div>
      ) : (
         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 flex flex-col gap-2">
               <button 
                 onClick={() => setActiveTab('lime')}
                 className={cn("text-left p-4 rounded-lg border transition-all duration-200", 
                   activeTab === 'lime' ? "bg-slate-800/80 border-slate-700" : "bg-slate-900/40 border-slate-800/50 hover:bg-slate-800/50 hover:border-slate-700/50"
                 )}
               >
                 <div className="flex items-center gap-2 font-semibold text-slate-200 mb-1">
                   <Layers size={16} className={activeTab === 'lime' ? "text-emerald-400" : "text-slate-500"}/> 
                   LIME Analysis
                 </div>
                 <p className="text-[10px] text-slate-400">Highlights superpixels driving the severity prediction.</p>
               </button>
               
               <button 
                 onClick={() => setActiveTab('shap')}
                 className={cn("text-left p-4 rounded-lg border transition-all duration-200", 
                   activeTab === 'shap' ? "bg-slate-800/80 border-slate-700" : "bg-slate-900/40 border-slate-800/50 hover:bg-slate-800/50 hover:border-slate-700/50"
                 )}
               >
                 <div className="flex items-center gap-2 font-semibold text-slate-200 mb-1">
                   <BarChart4 size={16} className={activeTab === 'shap' ? "text-emerald-400" : "text-slate-500"}/> 
                   SHAP Values
                 </div>
                 <p className="text-[10px] text-slate-400">Force plot of feature contributions to the final score.</p>
               </button>

               <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mt-4">
                 <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-3 border-b border-slate-800 pb-2">Record Info</h4>
                 <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between"><span className="text-slate-500">Patient:</span> <span className="font-mono">{selectedRecord.patient_id}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Model:</span> <span>{selectedRecord.model_used}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Score:</span> <span className="font-bold text-emerald-400">{selectedRecord.severity_score.toFixed(1)} / 6.0</span></div>
                 </div>
               </div>
            </div>

            <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-lg p-6 min-h-[500px]">
               {activeTab === 'lime' ? (
                 <LimeExplanation record={selectedRecord} />
               ) : (
                 <ShapExplanation record={selectedRecord} />
               )}
            </div>
         </div>
      )}
    </div>
  );
}

function LimeExplanation({ record }: { record: PredictionResult }) {
  // Mock simulation for LIME.
  // In a real python integration, the backend sends a base64 encoded image mask or boundaries.
  return (
    <div className="h-full flex flex-col">
       <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-slate-200">Local Interpretable Explanations</h3>
          <div className="flex gap-4 text-[10px] uppercase tracking-wider font-bold">
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Supports</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /> Contradicts</span>
          </div>
       </div>
       
       <div className="flex-1 flex gap-6 items-center justify-center p-4">
          {/* Original */}
          <div className="flex-1 max-w-sm">
             <p className="text-xs text-slate-500 mb-2 font-medium text-center">Original Input</p>
             <div className="aspect-[3/4] bg-black rounded border border-slate-800 overflow-hidden relative">
               <img src={record.image_url} alt="Original CXR" className="absolute inset-0 w-full h-full object-contain opacity-80 mix-blend-screen" />
             </div>
          </div>
          
          {/* LIME Mask Overlay Simulation */}
          <div className="flex-1 max-w-sm">
             <p className="text-xs text-slate-500 mb-2 font-medium text-center">LIME Superpixels</p>
             <div className="aspect-[3/4] bg-black rounded border border-slate-800 overflow-hidden relative">
               <img src={record.image_url} alt="LIME Mask" className="absolute inset-0 w-full h-full object-contain opacity-70 mix-blend-screen grayscale" />
               {/* Simulating green/red superpixels with absolute divs & blur. The backend would produce a real mask. */}
               <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="absolute top-1/4 left-1/4 w-1/3 h-1/4 bg-emerald-500/30 mix-blend-color blur-xl rounded-full" />
                  <div className="absolute top-1/3 right-1/4 w-1/4 h-1/5 bg-emerald-500/30 mix-blend-color blur-xl rounded-full" />
                  <div className="absolute bottom-1/4 right-1/3 w-1/5 h-1/5 bg-rose-500/20 mix-blend-color blur-lg rounded-full animate-pulse" />
               </div>
               {/* Superpixel boundaries simulation */}
               <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none z-20">
                 <defs>
                   <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                     <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-emerald-500/50"/>
                   </pattern>
                 </defs>
                 <rect width="100%" height="100%" fill="url(#grid)" />
               </svg>
             </div>
          </div>
       </div>
       <div className="bg-slate-800/50 p-4 rounded text-xs text-slate-400 mt-4 leading-relaxed">
         <Info size={14} className="inline mr-2 -mt-0.5" />
         The LIME model segments the image into superpixels and perturbs them to see the effect on the prediction. Green regions strongly contribute to the predicted COVID-19 severity score, while red regions reduce the likelihood of that score.
       </div>
    </div>
  );
}

function ShapExplanation({ record }: { record: PredictionResult }) {
  // Mock simulation for SHAP force plot.
  const baseValue = 1.5;
  const z = record.zone_scores;
  
  // Create mock impact features derived from zone scores
  const features = [
    { name: "Right Lower Density", val: z.R_lower, impact: z.R_lower > 0 ? z.R_lower * 0.4 : -0.1 },
    { name: "Right Upper Density", val: z.R_upper, impact: z.R_upper > 0 ? z.R_upper * 0.3 : -0.05 },
    { name: "Left Lower Density", val: z.L_lower, impact: z.L_lower > 0 ? z.L_lower * 0.4 : -0.2 },
    { name: "Left Upper Density", val: z.L_upper, impact: z.L_upper > 0 ? z.L_upper * 0.3 : -0.05 },
    { name: "Right Middle Density", val: z.R_middle, impact: z.R_middle > 0 ? z.R_middle * 0.2 : 0 },
    { name: "Left Middle Density", val: z.L_middle, impact: z.L_middle > 0 ? z.L_middle * 0.2 : 0 },
    { name: "Background/Noise", val: 0, impact: -0.15 }, // Example negative impact
  ].sort((a,b) => Math.abs(b.impact) - Math.abs(a.impact));

  return (
    <div className="h-full flex flex-col">
       <div className="flex justify-between items-center mb-8">
          <h3 className="text-lg font-semibold text-slate-200">SHAP Feature Importances</h3>
          <div className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-300">
             f(x) = {record.severity_score.toFixed(2)}
          </div>
       </div>

       <div className="flex-1 relative">
         {/* Simple Waterfall / Bar Chart visualization */}
         <div className="space-y-4 max-w-2xl mx-auto">
            <div className="flex text-[10px] uppercase font-bold text-slate-500 mb-2 border-b border-slate-800 pb-2">
              <div className="w-48">Feature</div>
              <div className="w-20 text-right">Value</div>
              <div className="flex-1 text-center">SHAP Value (impact on model output)</div>
            </div>
            
            <div className="relative">
              {/* Center Line for Impact */}
              <div className="absolute top-0 bottom-0 left-[22rem] w-px bg-slate-700 z-0" />
              
              {features.map((f, i) => (
                <div key={i} className="flex items-center text-xs relative z-10 py-1">
                   <div className="w-48 text-slate-300 truncate pr-4" title={f.name}>{f.name}</div>
                   <div className="w-20 text-right font-mono text-slate-500 pr-8">{f.val}</div>
                   <div className="flex-1 relative h-6">
                      {f.impact > 0 ? (
                        <div className="absolute left-1/2 h-full bg-rose-500/80 rounded-r flex items-center pr-2 text-[10px] font-bold text-white shadow" style={{ width: `${f.impact * 80}px` }}>
                           <span className="ml-full pl-1 absolute left-full text-rose-400">+{f.impact.toFixed(2)}</span>
                        </div>
                      ) : f.impact < 0 ? (
                        <div className="absolute right-1/2 h-full bg-blue-500/80 rounded-l flex items-center justify-end pl-2 text-[10px] font-bold text-white shadow" style={{ width: `${Math.abs(f.impact) * 80}px` }}>
                           <span className="mr-full pr-1 absolute right-full text-blue-400">{f.impact.toFixed(2)}</span>
                        </div>
                      ) : null}
                   </div>
                </div>
              ))}
            </div>
         </div>
       </div>
       
       <div className="bg-slate-800/50 p-4 rounded text-xs text-slate-400 mt-6 leading-relaxed">
         <Info size={14} className="inline mr-2 -mt-0.5" />
         SHAP values show how much each region's density contributed to pushing the final score away from the base value ({baseValue}). Red indicates pushing the score higher (more severe), while blue indicates pushing lower.
       </div>
    </div>
  );
}
