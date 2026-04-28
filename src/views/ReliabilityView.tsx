import { useState, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart, Users } from 'lucide-react';

// Generates simulated live DB data for rater agreement
function generateSimulatedRaterData() {
  const data = [];
  for (let i = 0; i < 150; i++) {
    // Generate scores 0-6
    const trueScore = Math.floor(Math.random() * 7);
    const drA_error = (Math.random() - 0.5) * 1.5; // slight noise
    const drB_error = (Math.random() - 0.5) * 2.0; // more noise
    
    let drA = Math.max(0, Math.min(6, Math.round(trueScore + drA_error)));
    let drB = Math.max(0, Math.min(6, Math.round(trueScore + drB_error)));
    
    // Add jitter for visualization spread
    const jitterA = drA + (Math.random() * 0.4 - 0.2);
    const jitterB = drB + (Math.random() * 0.4 - 0.2);

    data.push({
      id: `REC-${i.toString().padStart(4, '0')}`,
      drA: drA,
      drB: drB,
      plotA: jitterA,
      plotB: jitterB,
      exactMatch: drA === drB
    });
  }
  return data;
}

// Calculate Cohen's Kappa exactly mapped to mathematical formula
function calculateCohensKappa(data: { drA: number; drB: number }[]) {
  const n = data.length;
  if (n === 0) return 0;

  // Compute Observed Agreement (Po)
  let exactMatches = 0;
  const countA: Record<number, number> = {};
  const countB: Record<number, number> = {};

  data.forEach(d => {
    if (d.drA === d.drB) exactMatches++;
    countA[d.drA] = (countA[d.drA] || 0) + 1;
    countB[d.drB] = (countB[d.drB] || 0) + 1;
  });

  const p_o = exactMatches / n;

  // Compute Expected Agreement (Pe)
  let p_e = 0;
  for (let k = 0; k <= 6; k++) {
    const pA = (countA[k] || 0) / n;
    const pB = (countB[k] || 0) / n;
    p_e += pA * pB;
  }

  // Kappa
  const kappa = (p_o - p_e) / (1 - p_e);
  return kappa;
}

export function ReliabilityView() {
  const [data] = useState(() => generateSimulatedRaterData());
  
  const kappa = useMemo(() => calculateCohensKappa(data), [data]);
  
  // Interpretation
  let interpretation = '';
  let kappaColor = '';
  if (kappa > 0.8) { interpretation = 'Almost Perfect Agreement'; kappaColor = 'text-green-400'; }
  else if (kappa > 0.6) { interpretation = 'Substantial Agreement'; kappaColor = 'text-emerald-400'; }
  else if (kappa > 0.4) { interpretation = 'Moderate Agreement'; kappaColor = 'text-amber-400'; }
  else if (kappa > 0.2) { interpretation = 'Fair Agreement'; kappaColor = 'text-orange-400'; }
  else { interpretation = 'Slight/Poor Agreement'; kappaColor = 'text-red-400'; }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center mb-8">
        <BarChart className="w-8 h-8 text-indigo-500 mr-3" />
        <div>
          <h2 className="text-2xl font-bold text-white">Inter-rater Reliability Analysis</h2>
          <p className="text-gray-400 text-sm mt-1">Cohen's Kappa & Scatter Plot for Rater Agreement</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-lg flex flex-col justify-center">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Cohen's Kappa (κ)</h3>
          <p className={`text-5xl font-mono font-bold ${kappaColor}`}>
            {kappa.toFixed(3)}
          </p>
          <p className={`text-sm mt-2 font-medium ${kappaColor}`}>{interpretation}</p>
        </div>
        
        <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-lg">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Sample Data (N = {data.length})</h3>
          <div className="flex items-center space-x-4">
            <div className="flex flex-col items-center justify-center p-3 bg-gray-900 rounded-lg border border-gray-700 flex-1">
              <Users className="w-5 h-5 text-indigo-400 mb-2" />
              <span className="text-xs text-gray-400">Doctor A</span>
            </div>
            <span className="text-gray-600 font-bold">vs</span>
            <div className="flex flex-col items-center justify-center p-3 bg-gray-900 rounded-lg border border-gray-700 flex-1">
              <Users className="w-5 h-5 text-indigo-400 mb-2" />
              <span className="text-xs text-gray-400">Doctor B</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">Data automatically grouped by Record ID.</p>
        </div>
        
        <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-lg flex flex-col justify-center">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Agreement Rate</h3>
          <p className="text-4xl font-mono text-white font-bold">
            {((data.filter(d => d.exactMatch).length / data.length) * 100).toFixed(1)}%
          </p>
          <p className="text-sm text-gray-400 mt-2">Exact matching severity scores</p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6 text-center">Score Correlation: Doctor A vs Doctor B</h3>
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                type="number" 
                dataKey="plotA" 
                name="Doctor A Score" 
                unit=""
                domain={[-0.5, 6.5]} 
                ticks={[0,1,2,3,4,5,6]}
                stroke="#9ca3af"
                label={{ value: "Doctor A Severity Score (0-6)", position: "insideBottom", offset: -10, fill: "#9ca3af" }}
              />
              <YAxis 
                type="number" 
                dataKey="plotB" 
                name="Doctor B Score" 
                unit=""
                domain={[-0.5, 6.5]} 
                ticks={[0,1,2,3,4,5,6]}
                stroke="#9ca3af"
                label={{ value: "Doctor B Severity Score (0-6)", angle: -90, position: "insideLeft", fill: "#9ca3af" }}
              />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3', stroke: '#6b7280' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl">
                        <p className="text-indigo-400 font-mono mb-1">{data.id}</p>
                        <p className="text-white text-sm">Doctor A: <span className="font-bold">{data.drA}</span></p>
                        <p className="text-white text-sm">Doctor B: <span className="font-bold">{data.drB}</span></p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              
              {/* x=y diagonal reference line denoting perfect agreement */}
              <line x1="10%" y1="90%" x2="90%" y2="10%" stroke="#4b5563" strokeDasharray="3 3" />
              
              <Scatter name="Cases" data={data}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.exactMatch ? '#818cf8' : '#ef4444'} opacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center mt-4 space-x-6 text-sm text-gray-400">
          <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#818cf8] mr-2 opacity-70"></div> Exact Match</div>
          <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#ef4444] mr-2 opacity-70"></div> Disagreement</div>
        </div>
      </div>
    </div>
  );
}
