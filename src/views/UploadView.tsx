import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileImage, Settings, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface UploadViewProps {
  onProcess: (files: File[], stage1: string, stage2: string, mode: number) => Promise<void>;
  isProcessing: boolean;
  batchProgress: { current: number; total: number } | null;
}

export function UploadView({ onProcess, isProcessing, batchProgress }: UploadViewProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [stage1Model, setStage1Model] = useState<string>('DeepLabV3plus');
  const [stage2Model, setStage2Model] = useState<string>('Unet');
  const [mode, setMode] = useState<number>(1);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFiles(acceptedFiles);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.dcm'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/octet-stream': ['.zip']
    },
    disabled: isProcessing
  } as unknown as import('react-dropzone').DropzoneOptions);

  const handleProcess = () => {
    if (files.length > 0 && !isProcessing) {
      onProcess(files, stage1Model, stage2Model, mode);
    }
  };

  const stage1Options = [
    { id: 'DeepLabV3plus', name: 'DeepLabV3+' }
  ];

  const stage2Options = [
    { id: 'Unet', name: 'U-Net' },
    { id: 'MANet', name: 'MA-Net' },
    { id: 'FPN', name: 'FPN' },
    { id: 'PSPNet', name: 'PSPNet' },
    { id: 'Ensemble', name: 'Meta-Ensemble (9 Models)' }
  ];

  const modeOptions = [
    { id: 1, name: 'Normal Visualization' },
    { id: 2, name: 'SRI (Score-cam)' },
    { id: 3, name: 'Zone Profiler' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-100">New Analysis</h2>
        <p className="text-slate-400 mt-1">Upload a chest X-ray image for AI-assisted COVID-19 severity scoring.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div 
            {...getRootProps()} 
            className={cn(
              "border border-dashed rounded-2xl p-12 transition-all duration-200 ease-in-out cursor-pointer flex flex-col items-center justify-center text-center bg-slate-900/50 min-h-[320px]",
              isDragActive ? "border-emerald-500 bg-emerald-500/5" : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/50",
              isProcessing && "opacity-50 cursor-not-allowed",
              files.length > 0 && "border-emerald-500/50 bg-slate-900"
            )}
          >
            <input {...getInputProps()} />
            
            {files.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                  <FileImage size={32} />
                </div>
                <p className="font-semibold text-slate-100">
                  {files.length === 1 ? files[0].name : `${files.length} files selected`}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {files.length === 1 
                    ? (files[0].size / 1024 / 1024).toFixed(2) + " MB"
                    : "Batch Analysis"
                  }
                </p>
                {!isProcessing && (
                  <p className="text-xs text-emerald-400 mt-4 font-medium uppercase tracking-wider">Click or drag to change</p>
                )}
                {isProcessing && batchProgress && batchProgress.total > 1 && (
                  <div className="w-full max-w-xs mt-6">
                     <div className="flex justify-between text-xs text-slate-400 mb-2">
                       <span>Processing...</span>
                       <span>{batchProgress.current} / {batchProgress.total}</span>
                     </div>
                     <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                       <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
                     </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-800 shadow-sm border border-slate-700 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
                  <UploadCloud size={32} />
                </div>
                <p className="font-medium text-slate-300">Drag & drop CXR images or a ZIP file here</p>
                <p className="text-sm text-slate-500 mt-2 max-w-sm">Supports PNG, JPG, JPEG, DICOM, or ZIP folder. Minimum resolution 512x512 recommended for Stage 2 inference.</p>
                <div className="mt-8 px-6 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium shadow-sm hover:bg-slate-700 transition-colors">
                  Browse Files
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleProcess}
              disabled={files.length === 0 || isProcessing}
              className={cn(
                "px-8 py-3 rounded-md font-semibold md:text-sm text-slate-100 flex items-center gap-2 transition-all shadow-sm",
                files.length === 0 || isProcessing 
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                  : "bg-emerald-600 hover:bg-emerald-500 hover:shadow shadow-emerald-500/20 active:scale-[0.98]"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Processing Image...
                </>
              ) : (
                'Run Analysis'
              )}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-800">
              <Settings size={18} className="text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">Model Selection</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Stage 1 (Lung Seg)</label>
                <select 
                  value={stage1Model}
                  onChange={(e) => setStage1Model(e.target.value)}
                  disabled={isProcessing}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                >
                  {stage1Options.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Stage 2 (Disease Seg)</label>
                <select 
                  value={stage2Model}
                  onChange={(e) => setStage2Model(e.target.value)}
                  disabled={isProcessing}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                >
                  {stage2Options.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">Analysis Mode</label>
                <select 
                  value={mode}
                  onChange={(e) => setMode(Number(e.target.value))}
                  disabled={isProcessing}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                >
                  {modeOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
