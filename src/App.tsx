import { useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { XAIPanel } from './components/XAIPanel';
import { StageViewer } from './components/StageViewer';
import { UploadView } from './views/UploadView';
import { DashboardView } from './views/DashboardView';
import { HistoryView } from './views/HistoryView';
import { AnnotationView } from './views/AnnotationView';
import { ReliabilityView } from './views/ReliabilityView';
import { useApp } from './context/AppContext';
import { checkHealth } from './services/api';
import { Loader2 } from 'lucide-react';

export default function App() {
  const { currentView, activeResult, isLoading, batchProgress, setBackendAlive } = useApp();

  useEffect(() => {
    // Check backend health periodically
    const doCheck = async () => {
      const alive = await checkHealth();
      setBackendAlive(alive);
    };
    doCheck();
    const interval = setInterval(doCheck, 30000);
    return () => clearInterval(interval);
  }, [setBackendAlive]);

  const renderContent = () => {
    switch (currentView) {
      case 'upload':
        return <UploadView />;
      case 'history':
        return <HistoryView />;
      case 'dashboard':
        return <DashboardView />;
      case 'annotation':
        return <AnnotationView />;
      case 'reliability':
        return <ReliabilityView />;
      case 'lung':
        return activeResult ? (
          <div className="max-w-4xl mx-auto p-4">
            <h2 className="text-2xl font-bold text-white mb-6">Stage 1: Lung Segmentation</h2>
            <StageViewer originalB64={activeResult.resultImageB64} maskB64={activeResult.lungMaskB64} stageName="Lung" />
          </div>
        ) : null;
      case 'disease':
        return activeResult ? (
          <div className="max-w-4xl mx-auto p-4">
            <h2 className="text-2xl font-bold text-white mb-6">Stage 2: Disease Segmentation</h2>
            <StageViewer originalB64={activeResult.resultImageB64} maskB64={activeResult.diseaseMaskB64} stageName="Disease" />
          </div>
        ) : null;
      case 'severity':
        return activeResult ? (
          <div className="max-w-4xl mx-auto p-4">
            <h2 className="text-2xl font-bold text-white mb-6">Severity & Overlay</h2>
            <StageViewer originalB64={activeResult.resultImageB64} maskB64={activeResult.diseaseMaskB64} stageName="Overlay" />
          </div>
        ) : null;
      default:
        return <UploadView />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 font-sans text-gray-200 selection:bg-indigo-500/30">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            <h2 className="text-xl font-medium text-white mb-2">Analyzing Imaging Data...</h2>
            {batchProgress ? (
              <p className="text-gray-400">Processing file {batchProgress.current} of {batchProgress.total}</p>
            ) : (
              <p className="text-gray-400">Running AI models, this may take a moment.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 w-full overflow-hidden">
              {renderContent()}
            </div>
            
            {/* Show Side panel only when a result is active and we are not in upload/history */}
            {activeResult && !['upload', 'history'].includes(currentView) && (
              <div className="w-full lg:w-80 flex-shrink-0">
                <XAIPanel />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
