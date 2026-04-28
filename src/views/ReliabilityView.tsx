import { useMemo } from 'react';
import { Users, AlertCircle } from 'lucide-react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, ReferenceLine
} from 'recharts';

export function ReliabilityView() {
  // Generate clustered dummy data for Doctor A vs Doctor B
  // Scores are from 0 to 6
  // Bubble size will represent the count of records that got that specific (Doc A, Doc B) combination.
  const chartData = useMemo(() => {
    // Generate a correlation matrix (agreement)
    const points: { x: number, y: number }[] = [];
    
    // Simulate 200 records with high agreement
    for (let i = 0; i < 200; i++) {
       const trueScore = Math.random() * 6;
       // doc A and doc B have small deviations
       let docA = Math.round(trueScore + (Math.random() - 0.5) * 1.5);
       let docB = Math.round(trueScore + (Math.random() - 0.5) * 1.5);
       
       // Clamp between 0 and 6
       docA = Math.max(0, Math.min(6, docA));
       docB = Math.max(0, Math.min(6, docB));
       
       points.push({ x: docA, y: docB });
    }

    // Aggregate into bubble chart format: { x (DocA), y (DocB), z (Count) }
    const agg: Record<string, {x: number, y: number, z: number}> = {};
    points.forEach(p => {
       const key = `${p.x}_${p.y}`;
       if (!agg[key]) agg[key] = { x: p.x, y: p.y, z: 0 };
       agg[key].z += 1;
    });

    return Object.values(agg);
  }, []);

  // Calculate generic Cohen's Kappa for the generated data
  const { kappa, pObserved, pExpected } = useMemo(() => {
     let total = 0;
     let agree = 0;
     const rowCounts = Array(7).fill(0);
     const colCounts = Array(7).fill(0);

     chartData.forEach(d => {
        total += d.z;
        if (d.x === d.y) agree += d.z;
        rowCounts[d.x] += d.z;
        colCounts[d.y] += d.z;
     });

     const p0 = agree / total;
     let pe = 0;
     for (let i = 0; i <= 6; i++) {
        pe += (rowCounts[i] / total) * (colCounts[i] / total);
     }

     const k = (p0 - pe) / (1 - pe);
     return { kappa: k, pObserved: p0, pExpected: pe };
  }, [chartData]);


  // Custom Tooltip for Bubbles
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs">
          <p className="font-bold text-slate-200 mb-1 border-b border-slate-800 pb-1">Agreement Node</p>
          <div className="flex flex-col gap-1 text-slate-400">
            <p>Doctor A Score: <span className="text-amber-400 font-mono">{data.x}</span></p>
            <p>Doctor B Score: <span className="text-blue-400 font-mono">{data.y}</span></p>
            <p>Frequency: <span className="text-emerald-400 font-bold">{data.z} cases</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
             <Users className="text-indigo-400" size={24} /> Inter-rater Reliability
          </h2>
          <p className="text-slate-400 mt-1 text-sm">Quantifies the agreement between medical professionals on disease severity scores against the Gold Standard.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         {/* Metrics Column */}
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-5">
                 <Users size={64} />
               </div>
               <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Cohen's Kappa (κ)</h3>
               <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-indigo-400 font-mono">{kappa.toFixed(3)}</span>
               </div>
               
               <div className="mt-4 pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Based on standard interpretation, a value of <strong>{kappa > 0.8 ? "Almost Perfect" : kappa > 0.6 ? "Substantial" : "Moderate"}</strong> agreement is observed between Doctor A and Doctor B.
                  </p>

                  <div className="space-y-2 text-xs">
                     <div className="flex justify-between items-center text-slate-300">
                       <span>Observed Agreement</span>
                       <span className="font-mono text-emerald-400">{(pObserved * 100).toFixed(1)}%</span>
                     </div>
                     <div className="flex justify-between items-center text-slate-500">
                       <span>Expected by Chance</span>
                       <span className="font-mono">{(pExpected * 100).toFixed(1)}%</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
               <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Gold Standard Logic</h3>
               <div className="space-y-4 text-xs text-slate-400 leading-relaxed">
                  <div className="flex gap-3">
                     <div className="mt-0.5 text-emerald-500"><AlertCircle size={14} /></div>
                     <p>Coordinates lying on the diagonal line (X=Y) represent perfect consensus.</p>
                  </div>
                  <div className="flex gap-3">
                     <div className="mt-0.5 text-emerald-500"><AlertCircle size={14} /></div>
                     <p>Nodes further away from the diagonal represent high discrepancies that may require a tie-breaker (e.g. Doctor C).</p>
                  </div>
                  <div className="flex gap-3">
                     <div className="mt-0.5 text-emerald-500"><AlertCircle size={14} /></div>
                     <p>These grouped annotations form the <strong>Gold Standard</strong> target for training the deep learning model.</p>
                  </div>
               </div>
            </div>
         </div>

         {/* Scatter Plot */}
         <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-lg p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-blend-overlay">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300 mb-2 border-b border-slate-800 pb-4 text-center">
              Severity Score Agreement Density
            </h3>
            
            <div className="h-[500px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 40, bottom: 40, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <ReferenceLine 
                    segment={[{ x: 0, y: 0 }, { x: 6, y: 6 }]} 
                    stroke="#34d399" 
                    strokeDasharray="5 5" 
                    label={{ value: 'Perfect Agreement', fill: '#34d399', fontSize: 12, position: 'insideTopLeft' }}
                  />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="Doctor A" 
                    domain={[0, 6.5]} 
                    ticks={[0,1,2,3,4,5,6]} 
                    stroke="#94a3b8"
                    label={{ value: "Doctor A Score", position: 'bottom', fill: '#94a3b8', offset: 10 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Doctor B" 
                    domain={[0, 6.5]} 
                    ticks={[0,1,2,3,4,5,6]} 
                    stroke="#94a3b8"
                    label={{ value: "Doctor B Score", angle: -90, position: 'insideLeft', fill: '#94a3b8', offset: -10 }}
                  />
                  <ZAxis type="number" dataKey="z" range={[50, 2000]} name="Count" />
                  <Tooltip content={<CustomTooltip />} cursor={{strokeDasharray: '3 3'}} />
                  <Scatter 
                    name="Agreement Data" 
                    data={chartData} 
                    fill="#818cf8" 
                    fillOpacity={0.6}
                    stroke="#6366f1"
                    strokeWidth={2}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-[10px] text-slate-500 mt-2 uppercase tracking-wide">
              Bubble Size = Frequency of Case Occurrence
            </p>
         </div>
      </div>
    </div>
  );
}
