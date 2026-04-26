import { useState, useRef } from 'react';
import { Download, AlertCircle, Clock, CheckCircle2, ChevronLeft, Map, ActivitySquare } from 'lucide-react';
import type { PredictionResult } from '../types';
import { cn } from '../lib/utils';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface ResultViewProps {
  result: PredictionResult;
  onBack: () => void;
}

export function ResultView({ result, onBack }: ResultViewProps) {
  const [opacity, setOpacity] = useState(0.6);
  const [activeTab, setActiveTab] = useState<'overlay' | 'heat' | 'original'>('overlay');
  const reportRef = useRef<HTMLDivElement>(null);
  
  const totalScore = result.severity_score;
  const severityLabel = totalScore < 2 ? 'MILD' : totalScore < 4 ? 'MODERATE' : 'SEVERE';
  const severityColor = totalScore < 2 ? 'text-emerald-400' : totalScore < 4 ? 'text-amber-400' : 'text-rose-400';
  const severityBg = totalScore < 2 ? 'bg-emerald-500/10 border-emerald-500/20' : totalScore < 4 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20';

  const generatePDF = () => {
    if (reportRef.current) {
      const opt = {
        margin: 1,
        filename: `covid_report_${result.patient_id}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as 'portrait' | 'landscape' }
      };
      html2pdf().set(opt).from(reportRef.current).save();
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-slate-200"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Active Patient ID</span>
              <span className="text-sm font-mono text-slate-200">{result.patient_id}</span>
            </div>
            <div className="h-8 w-[1px] bg-slate-800"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Processing Stage</span>
              <span className="text-sm text-emerald-400 flex items-center gap-2">
                <CheckCircle2 size={14} /> Inference Complete
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generatePDF}
            className="px-4 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-xs rounded transition-colors flex items-center gap-2 font-medium"
          >
            <Download size={14} />
            Export PDF
          </button>
          <button className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-xs rounded transition-colors font-semibold">
            Push to PACS
          </button>
        </div>
      </header>

      <div className="flex gap-6 lg:gap-8 flex-1" ref={reportRef}>
        {/* Main Vis Column */}
        <div className="flex-1 flex flex-col space-y-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden relative group flex-1">
            {/* Toolbar */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex bg-slate-950/80 backdrop-blur-md p-1 rounded border border-slate-800">
                {(['original', 'overlay', 'heat'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold rounded-sm transition-colors",
                      activeTab === tab ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {activeTab === 'overlay' && (
                <div className="bg-slate-950/80 border border-slate-800 backdrop-blur-md px-3 py-2 rounded flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Opacity</span>
                  <input 
                    type="range" 
                    min="0" max="1" step="0.1" 
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-24 accent-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Visualization Canvas area (Mocked) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle,_#334155_0%,_#0f172a_100%)] flex items-center justify-center overflow-hidden">
               {/* Original Image */}
               <img src={result.image_url} alt="Original CXR" className="absolute w-full h-full object-contain mix-blend-screen opacity-80" />
               
               {/* Modifiers based on tab */}
               {activeTab === 'overlay' && (
                 <div 
                  className="absolute inset-x-0 bottom-1/4 h-1/2 bg-rose-500 mix-blend-screen pointer-events-none blur-3xl rounded-full scale-150"
                  style={{ opacity: opacity }}
                 />
               )}

               {activeTab === 'heat' && (
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/40 via-transparent to-rose-900/60 mix-blend-color pointer-events-none" />
               )}
            </div>
            
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-900 to-transparent flex justify-between text-slate-400 text-[10px] uppercase tracking-widest font-semibold">
               <div className="flex gap-4">
                 <span className="flex items-center gap-1.5"><Map size={12} /> Stage 1: Lung Seg</span>
                 <span className="flex items-center gap-1.5"><ActivitySquare size={12} /> Stage 2: Disease Seg</span>
               </div>
               <span>AI-assisted visualization. Check clinically.</span>
            </div>
          </div>
        </div>

        {/* Stats Column */}
        <div className="w-80 flex flex-col gap-6 shrink-0">
          {/* Main Score Card */}
          <div className={cn("rounded-xl p-6 text-center border relative", severityBg)}>
            <span className="text-[10px] uppercase tracking-widest font-bold opacity-80" >Severity Score</span>
            <div className="text-6xl font-black my-2 tracking-tighter" style={{ color: "var(--color-emerald-400)" }}>
               <span className={severityColor}>{totalScore.toFixed(1)}</span><span className="text-xl font-normal opacity-50">/6.0</span>
            </div>
            {result.uncertainty !== undefined && (
              <p className="text-[10px] text-slate-400 font-mono mb-2">Uncertainty: ±{result.uncertainty} (Std Dev)</p>
            )}
            <p className="text-xs text-slate-400">Classification: <span className={cn("font-semibold", severityColor)}>{severityLabel} COVID-19</span></p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Lung Involv.</span>
              <span className="text-xl font-mono text-slate-200">{result.statistics.involvement_percentage}%</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
              <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Confidence</span>
              <span className="text-xl font-mono text-emerald-400">{(result.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
          
          {/* Ensemble Individual Predictions */}
          {result.individual_predictions && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg flex-1 overflow-y-auto">
              <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4 border-b border-slate-800 pb-3 text-slate-400">Ensemble Contributors</h3>
              <div className="space-y-2">
                {result.individual_predictions.map((pred, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">{pred.model}</span>
                    <span className="font-mono text-slate-200">{pred.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!result.individual_predictions && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg flex-1">
              <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4 border-b border-slate-800 pb-3 text-slate-400">Quantitative & Zonal</h3>
              
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Lung px²</p>
                      <p className="font-mono text-xs mt-1 text-slate-300">{result.statistics.total_lung_pixels.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Disease px²</p>
                      <p className="font-mono text-xs mt-1 text-slate-300">{result.statistics.disease_pixels.toLocaleString()}</p>
                    </div>
                 </div>

                 <div className="pt-4 border-t border-slate-800">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div className="space-y-2">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 flex justify-between">Right <span>{result.zone_scores.R_upper + result.zone_scores.R_middle + result.zone_scores.R_lower}</span></div>
                        <ZoneItem name="Upper" score={result.zone_scores.R_upper} />
                        <ZoneItem name="Middle" score={result.zone_scores.R_middle} />
                        <ZoneItem name="Lower" score={result.zone_scores.R_lower} />
                      </div>
                      <div className="space-y-2">
                         <div className="text-[10px] font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 flex justify-between">Left <span>{result.zone_scores.L_upper + result.zone_scores.L_middle + result.zone_scores.L_lower}</span></div>
                        <ZoneItem name="Upper" score={result.zone_scores.L_upper} />
                        <ZoneItem name="Middle" score={result.zone_scores.L_middle} />
                        <ZoneItem name="Lower" score={result.zone_scores.L_lower} />
                      </div>
                    </div>
                 </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-800">
                <p className="text-[10px] text-slate-500 italic uppercase">Model: {result.model_used.toUpperCase()}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ZoneItem({ name, score }: { name: string; score: number }) {
  return (
    <div className="flex justify-between items-center group cursor-default">
      <span className="text-[10px] font-medium text-slate-400">{name}</span>
      <span className={cn(
        "w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold font-mono transition-colors",
        score > 0 ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-slate-950 text-slate-600 border border-slate-800"
      )}>
        {score}
      </span>
    </div>
  )
}
