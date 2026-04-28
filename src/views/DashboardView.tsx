import { useApp } from '../context/AppContext';
import { SRIGauge } from '../components/SRIGauge';
import { ZoneHeatmap } from '../components/ZoneHeatmap';
import { ZoneRiskChart } from '../components/ZoneRiskChart';
import { DisagreementMap } from '../components/DisagreementMap';
import { Shield, Target, AlertTriangle } from 'lucide-react';

export function DashboardView() {
  const { activeResult, xaiVisibility } = useApp();

  if (!activeResult) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-3 flex items-center">
          <Shield className="w-6 h-6 mr-2 text-indigo-400" /> Executive Summary
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="bg-gray-900 rounded-lg p-5 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Severity Score</h3>
              <div className="flex items-end mb-4">
                <span className={`text-6xl font-bold leading-none ${activeResult.severityScore >= 4 ? 'text-red-500' : activeResult.severityScore >= 2 ? 'text-amber-500' : 'text-green-500'}`}>
                  {activeResult.severityScore}
                </span>
                <span className="text-xl text-gray-500 ml-2 mb-1">/ 6</span>
              </div>
              
              <div className="space-y-3 pt-3 border-t border-gray-800">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Total Involvement</span>
                  <span className="text-white font-mono">{activeResult.involvementPct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Lung Area</span>
                  <span className="text-white font-mono">{Math.round(activeResult.lungAreaPx).toLocaleString()} px²</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Disease Area</span>
                  <span className="text-white font-mono">{Math.round(activeResult.diseaseAreaPx).toLocaleString()} px²</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col justify-center">
            {xaiVisibility.sri ? (
              <div className="bg-gray-900 rounded-lg border border-gray-700 p-5 w-full h-full flex flex-col justify-center">
                <SRIGauge sri={activeResult.sri} label={activeResult.sriLabel} note={activeResult.sriNote} />
              </div>
            ) : (
              <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-5 flex items-center justify-center h-full text-gray-500 text-sm">
                SRI Visualization Disabled
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2 text-indigo-400" /> Regional Distribution
          </h3>
          <ZoneHeatmap zoneRatios={activeResult.zoneRatios} threshold={activeResult.threshold} />
        </div>

        {xaiVisibility.zoneRiskProfile && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-indigo-400" /> Zone Risk Profile
            </h3>
            <div className="flex-1 min-h-[300px]">
              <ZoneRiskChart 
                zoneRatios={activeResult.zoneRatios}
                zoneMeanRef={activeResult.zoneMeanRef}
                zoneStdRef={activeResult.zoneStdRef}
                zoneStd={activeResult.zoneStd}
                threshold={activeResult.threshold}
              />
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">
              Comparing patient metrics against `{activeResult.subset}` population baseline.
            </p>
          </div>
        )}
      </div>

      {activeResult.isEnsemble && xaiVisibility.disagreementMap && activeResult.disagreementMapB64 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Spatial Disagreement Map</h3>
          <p className="text-sm text-gray-400 mb-4">Highlighting areas where models in the ensemble disagree, indicating potential uncertainty.</p>
          <DisagreementMap base64={activeResult.disagreementMapB64} />
        </div>
      )}
    </div>
  );
}
