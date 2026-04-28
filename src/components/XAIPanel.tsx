import { ShieldAlert, BarChart3, Map } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function XAIPanel() {
  const { xaiVisibility, toggleXAI, activeResult } = useApp();

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sticky top-4">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">XAI Controls</h3>
      
      <div className="space-y-3">
        {activeResult?.isEnsemble && (
          <label className="flex items-center justify-between p-3 rounded-lg border border-gray-700 hover:bg-gray-750 cursor-pointer transition-colors">
            <div className="flex items-center">
              <Map className={`w-5 h-5 mr-3 ${xaiVisibility.disagreementMap ? 'text-indigo-400' : 'text-gray-500'}`} />
              <div>
                <p className="text-sm font-medium text-white">Disagreement Map</p>
                <p className="text-xs text-gray-500">Spatial model divergence</p>
              </div>
            </div>
            <div className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${xaiVisibility.disagreementMap ? 'bg-indigo-500' : 'bg-gray-600'}`}>
              <input type="checkbox" className="sr-only" checked={xaiVisibility.disagreementMap} onChange={() => toggleXAI('disagreementMap')} />
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${xaiVisibility.disagreementMap ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </label>
        )}

        <label className="flex items-center justify-between p-3 rounded-lg border border-gray-700 hover:bg-gray-750 cursor-pointer transition-colors">
          <div className="flex items-center">
            <ShieldAlert className={`w-5 h-5 mr-3 ${xaiVisibility.sri ? 'text-indigo-400' : 'text-gray-500'}`} />
            <div>
              <p className="text-sm font-medium text-white">Reliability Index (SRI)</p>
              <p className="text-xs text-gray-500">Prediction confidence</p>
            </div>
          </div>
          <div className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${xaiVisibility.sri ? 'bg-indigo-500' : 'bg-gray-600'}`}>
            <input type="checkbox" className="sr-only" checked={xaiVisibility.sri} onChange={() => toggleXAI('sri')} />
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${xaiVisibility.sri ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
        </label>

        <label className="flex items-center justify-between p-3 rounded-lg border border-gray-700 hover:bg-gray-750 cursor-pointer transition-colors">
          <div className="flex items-center">
            <BarChart3 className={`w-5 h-5 mr-3 ${xaiVisibility.zoneRiskProfile ? 'text-indigo-400' : 'text-gray-500'}`} />
            <div>
              <p className="text-sm font-medium text-white">Zone Risk Profile</p>
              <p className="text-xs text-gray-500">Population comparison</p>
            </div>
          </div>
          <div className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${xaiVisibility.zoneRiskProfile ? 'bg-indigo-500' : 'bg-gray-600'}`}>
            <input type="checkbox" className="sr-only" checked={xaiVisibility.zoneRiskProfile} onChange={() => toggleXAI('zoneRiskProfile')} />
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${xaiVisibility.zoneRiskProfile ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
        </label>
      </div>
      
      <div className="mt-6 pt-6 border-t border-gray-700">
        <h4 className="text-xs font-semibold text-gray-400 mb-2">Model Configuration</h4>
        <div className="text-sm text-gray-300 space-y-1">
          <p className="flex justify-between"><span>Stage 1:</span> <span className="text-indigo-300 font-mono">{activeResult?.modelS1}</span></p>
          <p className="flex justify-between"><span>Stage 2:</span> <span className="text-indigo-300 font-mono">{activeResult?.modelS2}</span></p>
          <p className="flex justify-between"><span>Subset:</span> <span className="text-indigo-300 font-mono">{activeResult?.subset}</span></p>
          <p className="flex justify-between"><span>Threshold:</span> <span className="text-indigo-300 font-mono">{activeResult?.threshold.toFixed(2)}</span></p>
        </div>
      </div>
    </div>
  );
}
