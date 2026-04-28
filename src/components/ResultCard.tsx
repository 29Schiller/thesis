import React from 'react';
import { AnalysisResult } from '../types';
import { format } from 'date-fns';
import { Layers, Activity, Maximize, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ResultCard: React.FC<{ result: AnalysisResult }> = ({ result }) => {
  const { setCurrentView, setActiveResult } = useApp();

  const handleOpen = () => {
    setActiveResult(result);
    setCurrentView('dashboard');
  };

  return (
    <div 
      onClick={handleOpen}
      className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-indigo-500 cursor-pointer transition-colors shadow-lg flex flex-col sm:flex-row relative group"
    >
      <div className="w-full sm:w-32 h-32 sm:h-auto bg-black flex-shrink-0 relative">
        <img 
          src={`data:image/jpeg;base64,${result.resultImageB64}`} 
          alt="Result thumbnail" 
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
          <Maximize className="text-white w-6 h-6" />
        </div>
      </div>
      
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-white text-lg truncate pr-2">{result.patientId}</h3>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap
              ${result.severityScore >= 4 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                result.severityScore >= 2 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                'bg-green-500/20 text-green-400 border border-green-500/30'}`}
            >
              Severity: {result.severityScore}
            </span>
          </div>
          
          <div className="text-xs text-gray-400 mb-3 space-y-1">
            <p className="flex items-center"><Activity className="w-3 h-3 mr-1.5" /> Date: {format(new Date(result.timestamp), 'MMM d, yyyy HH:mm')}</p>
            <p className="flex items-center"><Layers className="w-3 h-3 mr-1.5" /> Models: {result.modelS1} + {result.modelS2}</p>
          </div>
        </div>

        <div className="flex justify-between items-end mt-2">
          {result.sriLabel === 'LOW' ? (
             <div className="flex items-center text-xs text-red-400 font-medium">
               <AlertTriangle className="w-3 h-3 mr-1" /> Low Reliability ({result.sri.toFixed(2)})
             </div>
          ) : (
            <div className={`text-xs font-medium ${result.sriLabel === 'HIGH' ? 'text-green-400' : 'text-amber-400'}`}>
              SRI: {result.sriLabel} ({result.sri.toFixed(2)})
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            {result.isEnsemble ? 'Ensemble Mode' : 'Single Model'}
          </div>
        </div>
      </div>
    </div>
  );
}
