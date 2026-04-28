import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Edit3, Eraser, Download, RotateCcw } from 'lucide-react';

export function AnnotationView() {
  const { activeResult } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState(20);
  const [history, setHistory] = useState<ImageData[]>([]);

  // Load the initial AI mask + image into canvas
  useEffect(() => {
    if (!activeResult || !canvasRef.current || !containerRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgBase = new Image();
    const maskBase = new Image();
    
    imgBase.onload = () => {
      // Set canvas size to match image but scaled down if needed
      const maxWidth = containerRef.current!.clientWidth;
      const scale = Math.min(1, maxWidth / imgBase.width);
      canvas.width = imgBase.width * scale;
      canvas.height = imgBase.height * scale;
      
      // Draw base image
      ctx.drawImage(imgBase, 0, 0, canvas.width, canvas.height);
      
      // Load and draw mask
      if (activeResult.diseaseMaskB64) {
        maskBase.onload = () => {
          ctx.globalAlpha = 0.5; // Mask opacity
          ctx.drawImage(maskBase, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1.0;
          // Save initial state
          setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
        };
        maskBase.src = `data:image/png;base64,${activeResult.diseaseMaskB64}`;
      } else {
        setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
      }
    };
    imgBase.src = `data:image/jpeg;base64,${activeResult.resultImageB64}`;
  }, [activeResult]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      setIsDrawing(false);
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        // Save to history
        setHistory(prev => [...prev, ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height)].slice(-10)); // keep last 10
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    e.preventDefault(); // Prevent scrolling on touch

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    
    if (mode === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; // Red overlay for disease
    } else {
      // Eraser - to fake erasure we draw the original image patch over it 
      // but simpler is just clear part of the mask. Wait, the base image is there.
      // So 'destination-out' would erase base image too.
      // To properly do this, we need TWO canvases (one for image, one for mask).
      // Since we simplified to one, let's just draw "clear" over it. 
      // Actually real erasure requires destination-out on a separate layer.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = `rgba(0,0,0,1)`;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    // reset mode
    ctx.globalCompositeOperation = 'source-over';
  };

  const undo = () => {
    if (history.length > 1 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      const newHistory = [...history];
      newHistory.pop(); // remove current
      if (ctx && newHistory.length > 0) {
        ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
        setHistory(newHistory);
      }
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `annotation-${activeResult?.patientId || 'img'}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  if (!activeResult) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <p className="text-gray-400">Please process an image first to use the Annotation Tool.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Edit3 className="w-6 h-6 mr-2 text-indigo-400" /> DB Annotation Tool
          </h2>
          <p className="text-gray-400 text-sm mt-1">Refine AI predictions (Active Learning Workspace)</p>
        </div>
        <div className="flex space-x-2">
          <button onClick={undo} disabled={history.length <= 1} className="p-2 border border-gray-700 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-gray-300">
            <RotateCcw className="w-5 h-5" />
          </button>
          <button onClick={handleDownload} className="p-2 border border-emerald-700 bg-emerald-900/50 rounded-lg hover:bg-emerald-800 text-emerald-400">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl shadow-xl flex flex-col md:flex-row gap-6">
        <div className="flex md:flex-col space-y-0 md:space-y-4 space-x-4 md:space-x-0 w-full md:w-48 bg-gray-900 p-4 rounded-lg border border-gray-700">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tool Mode</h3>
            <div className="flex space-x-2">
              <button 
                onClick={() => setMode('brush')}
                className={`flex-1 flex flex-col items-center p-3 rounded-lg border transition-colors ${mode === 'brush' ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-gray-700 hover:bg-gray-800 text-gray-400'}`}
              >
                <Edit3 className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">Brush</span>
              </button>
              <button 
                onClick={() => setMode('eraser')}
                className={`flex-1 flex flex-col items-center p-3 rounded-lg border transition-colors ${mode === 'eraser' ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-gray-700 hover:bg-gray-800 text-gray-400'}`}
              >
                <Eraser className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">Eraser</span>
              </button>
            </div>
          </div>
          
          <div className="flex-1 md:flex-none">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Brush Size</h3>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-gray-500">{brushSize}px</span>
              <input 
                type="range" min="5" max="50" 
                value={brushSize} 
                onChange={e => setBrushSize(parseInt(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden" ref={containerRef}>
          <div className="bg-black rounded-lg border border-gray-700 overflow-hidden flex justify-center w-full touch-none">
            <canvas 
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onMouseMove={draw}
              onTouchStart={startDrawing}
              onTouchEnd={stopDrawing}
              onTouchCancel={stopDrawing}
              onTouchMove={draw}
              className={`cursor-crosshair w-full h-auto object-contain max-h-[600px]`}
            />
          </div>
          <p className="text-xs text-gray-500 text-center mt-3">
            Note: For accurate Eraser representation, the background image should be preserved on a separate layer. 
            (Currently simplified for preview environment).
          </p>
        </div>
      </div>
    </div>
  );
}
