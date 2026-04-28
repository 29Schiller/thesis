import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppView, AnalysisResult, XAIVisibility } from '../types';

interface AppState {
  currentView: AppView;
  activeResult: AnalysisResult | null;
  history: AnalysisResult[];
  xaiVisibility: XAIVisibility;
  isLoading: boolean;
  backendAlive: boolean;
  batchProgress: { current: number; total: number } | null;
}

interface AppContextType extends AppState {
  setCurrentView: (view: AppView) => void;
  setActiveResult: (result: AnalysisResult | null) => void;
  addHistory: (result: AnalysisResult) => void;
  clearHistory: () => void;
  toggleXAI: (key: keyof XAIVisibility) => void;
  setIsLoading: (loading: boolean) => void;
  setBackendAlive: (alive: boolean) => void;
  setBatchProgress: (progress: { current: number; total: number } | null) => void;
}

const defaultXAIVisibility: XAIVisibility = {
  disagreementMap: true,
  sri: true,
  zoneRiskProfile: true,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<AppView>('upload');
  const [activeResult, setActiveResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [xaiVisibility, setXAIVisibility] = useState<XAIVisibility>(defaultXAIVisibility);
  const [isLoading, setIsLoading] = useState(false);
  const [backendAlive, setBackendAlive] = useState(true); // default to true, health check updates this
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cxr_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Sync history to localStorage when changed
  useEffect(() => {
    localStorage.setItem('cxr_history', JSON.stringify(history));
  }, [history]);

  const addHistory = (result: AnalysisResult) => {
    setHistory(prev => [result, ...prev]);
  };

  const clearHistory = () => {
    setHistory([]);
    if (activeResult) {
      setActiveResult(null);
      setCurrentView('upload');
    }
  };

  const toggleXAI = (key: keyof XAIVisibility) => {
    setXAIVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <AppContext.Provider value={{
      currentView, setCurrentView,
      activeResult, setActiveResult,
      history, addHistory, clearHistory,
      xaiVisibility, toggleXAI,
      isLoading, setIsLoading,
      backendAlive, setBackendAlive,
      batchProgress, setBatchProgress
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
