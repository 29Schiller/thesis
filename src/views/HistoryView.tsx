import { useApp } from '../context/AppContext';
import { ResultCard } from '../components/ResultCard';

export function HistoryView() {
  const { history, clearHistory } = useApp();

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Analysis History</h2>
          <p className="text-gray-400 text-sm mt-1">Review previously processed cases</p>
        </div>
        {history.length > 0 && (
          <button 
            onClick={clearHistory}
            className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-sm font-medium transition-colors"
          >
            Clear History
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20 bg-gray-800/50 rounded-xl border border-gray-700">
          <p className="text-gray-400">No history available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {history.map(result => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}
