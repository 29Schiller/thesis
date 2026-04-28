import { useState, useMemo, useRef, useEffect, MouseEvent } from 'react';
import { Edit3, Eraser, Save, RotateCcw, PenTool, CheckCircle } from 'lucide-react';
import type { PredictionResult } from '../types';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';

interface AnnotationViewProps {
  history: PredictionResult[];
}

export function AnnotationView({ history }: AnnotationViewProps) {
  const [selectedRecordId, setSelectedRecordId] = useState<string>(history[0]?.id || '');
  const [mode, setMode] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState<number>(10);
  const [isSaved, setIsSaved] = useState(false);
  const [doctor, setDoctor] = useState<'Dr. A' | 'Dr. B' | 'Dr. C'>('Dr. A');

  const selectedRecord = useMemo(() => 
    history.find(h => h.id === selectedRecordId) || null
  , [history, selectedRecordId]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Initialize canvas with mock AI mask
  useEffect(() => {
    if (!selectedRecord || !canvasRef.current || !imageRef.current) return;
    setIsSaved(false);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    
    // Once image is loaded, set canvas size and draw initial dummy mask
    const initCanvas = () => {
      canvas.width = img.width || 400;
      canvas.height = img.height || 500;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw a dummy AI red mask
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; // Red overlay
      ctx.beginPath();
      // create random infection blobs based on record id string to make it somewhat deterministic
      const num1 = selectedRecord.id.charCodeAt(0) % 5 + 1;
      const num2 = selectedRecord.id.charCodeAt(selectedRecord.id.length - 1) % 5 + 1;
      
      ctx.arc(canvas.width * 0.3 * (num1/5), canvas.height * 0.4, 50, 0, Math.PI * 2);
      ctx.arc(canvas.width * 0.7, canvas.height * 0.6 * (num2/5), 70, 0, Math.PI * 2);
      ctx.fill();
    };

    if (img.complete) {
      initCanvas();
    } else {
      img.onload = initCanvas;
    }
  }, [selectedRecord]);

  const startDrawing = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (!canvasRef.current) return;
    setIsDrawing(false);
    const ctx = canvasRef.current.getContext('2d');
    ctx?.beginPath(); // reset path so next click doesn't connect
  };

  const draw = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';

    if (mode === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; // Red with some opacity
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      // to make it look like an area fill rather than just a line, we can draw arcs
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      // Eraser
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  if (history.length === 0) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20 flex flex-col items-center">
        <Edit3 className="opacity-20 mb-4" size={48} />
        <h2 className="text-xl font-bold text-slate-300">No Patient Records</h2>
        <p className="text-slate-500 mt-2 max-w-md">
          Run an analysis first to use the Annotation Tool.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
             <PenTool className="text-rose-400" size={24} /> DB Annotation Tool
          </h2>
          <p className="text-slate-400 mt-1 text-sm">Active learning workspace for doctors to correct AI-predicted disease masks.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={doctor}
            onChange={e => setDoctor(e.target.value as any)}
            className="appearance-none bg-slate-900 border border-slate-700 rounded-md py-2 px-4 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
          >
            <option value="Dr. A">Doctor A</option>
            <option value="Dr. B">Doctor B</option>
            <option value="Dr. C">Doctor C</option>
          </select>

          <select 
            value={selectedRecordId}
            onChange={e => setSelectedRecordId(e.target.value)}
            className="appearance-none bg-slate-900 border border-slate-800 rounded-md py-2 px-4 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500 min-w-[240px]"
          >
            {history.map(record => (
              <option key={record.id} value={record.id}>
                {record.patient_id} ({format(parseISO(record.created_at), 'MMM dd')})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedRecord ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
           {/* Tools Sidebar */}
           <div className="lg:col-span-1 flex flex-col gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                 <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Tools</h3>
                 
                 <div className="grid grid-cols-2 gap-2 mb-6">
                    <button 
                      onClick={() => setMode('brush')}
                      className={cn("flex flex-col items-center justify-center p-4 rounded-lg border transition-all",
                        mode === 'brush' ? "bg-rose-500/20 border-rose-500/50 text-rose-400" : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      )}
                    >
                       <Edit3 size={24} className="mb-2" />
                       <span className="text-xs font-semibold">Brush</span>
                    </button>
                    <button 
                      onClick={() => setMode('eraser')}
                      className={cn("flex flex-col items-center justify-center p-4 rounded-lg border transition-all",
                        mode === 'eraser' ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      )}
                    >
                       <Eraser size={24} className="mb-2" />
                       <span className="text-xs font-semibold">Eraser</span>
                    </button>
                 </div>

                 <div className="space-y-4">
                   <div>
                     <label className="flex justify-between text-xs text-slate-400 font-medium mb-2">
                       Stroke Size <span className="text-slate-200">{brushSize}px</span>
                     </label>
                     <input 
                       type="range" 
                       min="5" max="50" 
                       value={brushSize}
                       onChange={e => setBrushSize(parseInt(e.target.value))}
                       className="w-full accent-rose-500"
                     />
                   </div>
                 </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
                 <button 
                   onClick={() => {
                     const canvas = canvasRef.current;
                     const ctx = canvas?.getContext('2d');
                     if (canvas && ctx) {
                       ctx.clearRect(0, 0, canvas.width, canvas.height);
                     }
                   }}
                   className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-medium"
                 >
                    <RotateCcw size={16} /> Clear All
                 </button>

                 <button 
                   onClick={() => {
                     // In real app, save canvas.toDataURL() back to DB
                     setIsSaved(true);
                     setTimeout(() => setIsSaved(false), 2000);
                   }}
                   className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors text-sm font-medium shadow-lg shadow-emerald-900/20"
                 >
                    {isSaved ? <CheckCircle size={16} /> : <Save size={16} />} 
                    {isSaved ? "Saved to DB!" : "Save Annotation"}
                 </button>
              </div>

              <div className="bg-amber-900/10 border border-amber-900/30 p-4 rounded-lg">
                 <p className="text-xs text-amber-500/80 leading-relaxed">
                   <strong>Active Learning:</strong> Modifications saved here will be fed back into the next training loop to improve the model's performance on edge cases.
                 </p>
              </div>
           </div>

           {/* Canvas Workspace */}
           <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-lg p-6 flex flex-col items-center justify-center min-h-[600px] overflow-hidden">
              <div className="relative inline-block border border-slate-700 rounded-md overflow-hidden bg-black shadow-2xl">
                 <img 
                   ref={imageRef}
                   src={selectedRecord.image_url} 
                   alt="X-ray" 
                   className="block max-w-full max-h-[700px] pointer-events-none"
                   crossOrigin="anonymous"
                 />
                 <canvas
                   ref={canvasRef}
                   onMouseDown={startDrawing}
                   onMouseMove={draw}
                   onMouseUp={stopDrawing}
                   onMouseLeave={stopDrawing}
                   className={cn(
                     "absolute top-0 left-0 w-full h-full",
                     mode === 'eraser' ? "cursor-crosshair" : "cursor-crosshair"
                   )}
                   style={{
                     touchAction: 'none' // Prevent scrolling while drawing on touch devices
                   }}
                 />
                 
                 {/* Brush cursor preview */}
                 <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
                    <span className="px-2 py-1 bg-black/60 rounded text-[10px] text-white backdrop-blur-sm border border-slate-700 uppercase font-bold tracking-wider">
                       {doctor} Workspace
                    </span>
                 </div>
              </div>
              <p className="text-xs text-slate-500 mt-4 text-center">
                 Draw directly on the image to correct the AI's predictions. The red overlay indicates the detected infection areas.
              </p>
           </div>
        </div>
      )}
    </div>
  );
}
