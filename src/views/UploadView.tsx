import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileImage, Settings, AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { analyzeSingle, analyzeEnsemble, SingleConfig, EnsembleConfig } from '../services/api';
import { ModelS1, ModelS2, SubsetType, VizMode } from '../types';

export function UploadView() {
  const { addHistory, setActiveResult, setCurrentView, setIsLoading, setBatchProgress, backendAlive } = useApp();
  
  const [files, setFiles] = useState<File[]>([]);
  const [isEnsemble, setIsEnsemble] = useState(true);
  
  // Single config
  const [modelS1, setModelS1] = useState<ModelS1>("Unetplusplus");
  const [modelS2, setModelS2] = useState<ModelS2>("Unet");
  
  // Shared
  const [subset, setSubset] = useState<SubsetType>("All");
  const [mode, setMode] = useState<VizMode>("3"); // Default to highest detail
  const [threshold, setThreshold] = useState(0.5);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.bmp', '.tiff'],
      'application/x-zip-compressed': ['.zip'],
      'application/octet-stream': ['.zip']
    }
  } as any);

  const handleProcess = async () => {
    if (files.length === 0) return;
    
    setIsLoading(true);
    setBatchProgress(files.length > 1 ? { current: 0, total: files.length } : null);
    
    try {
      const results = [];
      const cfgBase = { modelS1, subset, mode, threshold };
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let result;
        
        if (isEnsemble) {
          result = await analyzeEnsemble(file, cfgBase as EnsembleConfig);
        } else {
          result = await analyzeSingle(file, { ...cfgBase, modelS2 } as SingleConfig);
        }
        
        results.push(result);
        addHistory(result);
        if (files.length > 1) {
          setBatchProgress({ current: i + 1, total: files.length });
        }
      }
      
      // Set the first result as active and go to dashboard
      if (results.length > 0) {
        setActiveResult(results[0]);
        setCurrentView('dashboard');
      }
    } catch (error: any) {
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setIsLoading(false);
      setBatchProgress(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">CXR Analysis Portal</h1>
        <p className="text-gray-400">Upload chest X-rays or archives for AI-powered segmentation and severity scoring.</p>
      </div>

      {!backendAlive && (
        <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4 mb-6 flex items-start">
          <AlertCircle className="text-amber-500 w-5 h-5 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-amber-400 font-medium font-sans">Backend Unavailable</h4>
            <p className="text-amber-200/70 text-sm mt-1">
              Cannot connect to the FastAPI backend. You can still use the interface in Mock Mode to view demo data, but actual AI inference will not run.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200
              ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-600 bg-gray-800 hover:border-gray-500 hover:bg-gray-750'}
            `}
          >
            <input {...getInputProps()} />
            <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-indigo-400' : 'text-gray-400'}`} />
            <p className="text-lg font-medium text-gray-200 mb-1">
              {isDragActive ? "Drop files here..." : "Drag & drop files here"}
            </p>
            <p className="text-sm text-gray-500">
              Supports JPEG, PNG, TIFF, or ZIP archives containing multiple X-rays
            </p>
          </div>

          {files.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium text-gray-200">Selected Files ({files.length})</h3>
                <button onClick={() => setFiles([])} className="text-xs text-red-400 hover:text-red-300">Clear All</button>
              </div>
              <ul className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center text-sm text-gray-400 bg-gray-900 rounded p-2">
                    <FileImage className="w-4 h-4 mr-2 text-indigo-400 flex-shrink-0" />
                    <span className="truncate">{f.name}</span>
                    <span className="ml-auto text-xs text-gray-500">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={files.length === 0}
            className={`w-full py-3.5 rounded-lg font-medium text-lg flex justify-center items-center transition-all shadow-lg
              ${files.length > 0
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}
            `}
          >
            Process {files.length > 0 ? files.length : ''} {files.length === 1 ? 'Image' : 'Images'}
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <div className="flex items-center mb-4 text-gray-200 font-medium">
            <Settings className="w-5 h-5 mr-2 text-indigo-400" /> Options
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Inference Strategy</label>
              <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                <button 
                  onClick={() => setIsEnsemble(false)} 
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${!isEnsemble ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Single Model
                </button>
                <button 
                  onClick={() => setIsEnsemble(true)} 
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${isEnsemble ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Ensemble
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Stage 1 Model (Lung)</label>
              <select 
                value={modelS1} 
                onChange={e => setModelS1(e.target.value as ModelS1)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="Unetplusplus">UNet++</option>
                <option value="DeepLabV3plus">DeepLabV3+</option>
                <option value="Unet">UNet</option>
                <option value="MAnet">MANet</option>
                <option value="FPN">FPN</option>
              </select>
            </div>

            {!isEnsemble && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Stage 2 Model (Disease)</label>
                <select 
                  value={modelS2} 
                  onChange={e => setModelS2(e.target.value as ModelS2)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="Unet">UNet</option>
                  <option value="MAnet">MANet</option>
                  <option value="FPN">FPN</option>
                  <option value="PSPNet">PSPNet</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Data Subset Context</label>
              <select 
                value={subset} 
                onChange={e => setSubset(e.target.value as SubsetType)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="All">All Populations</option>
                <option value="Normal">Normal Bias</option>
                <option value="COVID-19">COVID-19 Bias</option>
              </select>
            </div>
            
            <div>
              <label className="flex justify-between items-center text-sm font-medium text-gray-400 mb-1.5">
                <span>Threshold</span>
                <span className="text-indigo-400">{threshold.toFixed(2)}</span>
              </label>
              <input 
                type="range" 
                min="0.1" max="0.9" step="0.05" 
                value={threshold} 
                onChange={e => setThreshold(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
