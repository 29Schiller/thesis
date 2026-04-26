import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { Sidebar, type ViewType } from '../components/Sidebar';
import { UploadView } from './UploadView';
import { ResultView } from './ResultView';
import { HistoryView } from './HistoryView';
import { ExplainabilityView } from './ExplainabilityView';
import { BenchmarkView } from './BenchmarkView';
import { AnnotationView } from './AnnotationView';
import { ReliabilityView } from './ReliabilityView';
import { mockApi } from '../services/mockApi';
import type { PredictionResult } from '../types';

export function DashboardView() {
  const [currentView, setCurrentView] = useState<ViewType>('upload');
  const [history, setHistory] = useState<PredictionResult[]>([]);
  const [activeResult, setActiveResult] = useState<PredictionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    setHistory(mockApi.getHistory());
  }, []);

  const handleProcessImage = async (files: File[], modelId: string) => {
    setIsProcessing(true);
    let imagesToProcess: File[] = [];

    try {
      // Check for ZIP file
      if (files.length === 1 && (files[0].name.endsWith('.zip') || files[0].type === 'application/zip' || files[0].type === 'application/x-zip-compressed')) {
         const zip = new JSZip();
         const loadedZip = await zip.loadAsync(files[0]);
         
         const imagePromises = Object.keys(loadedZip.files).map(async (filename) => {
            const fileData = loadedZip.files[filename];
            if (!fileData.dir && filename.match(/\.(png|jpg|jpeg|dcm)$/i)) {
               const blob = await fileData.async('blob');
               return new File([blob], filename, { type: blob.type });
            }
            return null;
         });
         
         const extractedFiles = (await Promise.all(imagePromises)).filter(Boolean) as File[];
         imagesToProcess = extractedFiles;
      } else {
         imagesToProcess = files;
      }

      if (imagesToProcess.length === 0) {
         throw new Error("No valid images found to process.");
      }

      setBatchProgress({ current: 0, total: imagesToProcess.length });
      const results: PredictionResult[] = [];

      for (let i = 0; i < imagesToProcess.length; i++) {
         const result = await mockApi.processImage(imagesToProcess[i], modelId);
         results.push(result);
         setBatchProgress({ current: i + 1, total: imagesToProcess.length });
      }

      setHistory(mockApi.getHistory());
      
      if (results.length === 1) {
         setActiveResult(results[0]);
         setCurrentView('result');
      } else {
         // Export CSV for batch
         exportToCSV(results);
         setCurrentView('history');
      }

    } catch (error) {
      console.error("Processing failed", error);
      alert("Failed to process files. Please try again.");
    } finally {
      setIsProcessing(false);
      setBatchProgress(null);
    }
  };

  const exportToCSV = (results: PredictionResult[]) => {
     const headers = ['Patient ID', 'Model', 'Severity Score', 'Confidence', 'Involvement %', 'Date'];
     const rows = results.map(r => [
        r.patient_id,
        r.model_used,
        r.severity_score,
        r.confidence,
        r.statistics.involvement_percentage,
        new Date(r.created_at).toISOString()
     ]);

     const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
     
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `batch_results_${new Date().getTime()}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  const handleDeleteHistory = (id: string) => {
    mockApi.deleteFromHistory(id);
    setHistory(mockApi.getHistory());
    if (activeResult?.id === id) {
      setActiveResult(null);
      setCurrentView('upload');
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'upload':
        return <UploadView onProcess={handleProcessImage} isProcessing={isProcessing} batchProgress={batchProgress} />;
      case 'result':
        if (!activeResult) {
           setCurrentView('upload');
           return null;
        }
        return <ResultView result={activeResult} onBack={() => setCurrentView('upload')} />;
      case 'history':
        return (
          <HistoryView 
            history={history} 
            onSelect={(record) => {
              setActiveResult(record);
              setCurrentView('result');
            }}
            onDelete={handleDeleteHistory}
          />
        );
      case 'explain':
        return <ExplainabilityView history={history} />;
      case 'benchmark':
        return <BenchmarkView />;
      case 'annotation':
        return <AnnotationView history={history} />;
      case 'reliability':
        return <ReliabilityView />;
      default:
        return <div>View not implemented yet</div>;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      
      <main className="flex-1 overflow-y-auto" id="main-content">
        <div className="p-8 lg:p-12 min-h-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
