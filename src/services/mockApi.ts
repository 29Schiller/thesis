import { v4 as uuidv4 } from 'uuid';
import type { PredictionResult } from '../types';

// Simulate a delay for the ML processing pipeline
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const STORAGE_KEY = 'covid_predictions_history';

export const mockApi = {
  getHistory: (): PredictionResult[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveToHistory: (record: PredictionResult) => {
    try {
      const history = mockApi.getHistory();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...history]));
    } catch (e) {
      console.error('Failed to save to local storage', e);
    }
  },

  deleteFromHistory: (id: string) => {
    try {
      const history = mockApi.getHistory();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.filter((r) => r.id !== id)));
    } catch (e) {
      console.error('Failed to delete from local storage', e);
    }
  },

  clearHistory: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  processImage: async (file: File, modelId: string): Promise<PredictionResult> => {
    // Simulate real-world inference processing time
    const isEnsemble = modelId === 'ensemble';
    const processingTimeMs = Math.floor(Math.random() * (isEnsemble ? 2500 : 1200)) + (isEnsemble ? 2000 : 800);
    await delay(processingTimeMs);

    const imageUrl = URL.createObjectURL(file);
    
    // Generate realistic-looking mock data
    let severityScore = Number((Math.random() * 6).toFixed(1));
    let confidence = Number((0.75 + Math.random() * 0.23).toFixed(2)); // 0.75 to 0.98
    let uncertainty: number | undefined;
    let individual_predictions: { model: string; score: number }[] | undefined;

    if (isEnsemble) {
      // Simulate ensemble predictions
      confidence = Math.min(0.99, confidence + 0.1); // Ensemble usually more confident
      
      const models = ['MA-Net', 'U-Net', 'FPN', 'DeepLabV3+', 'Linknet', 'PSPNet', 'PAN', 'U-Net++', 'DenseNet'];
      const baseScore = severityScore;
      
      individual_predictions = models.map(m => {
        // Generate a score close to the base score
        let s = baseScore + (Math.random() * 1.5 - 0.75);
        s = Math.max(0, Math.min(6, s));
        return { model: m, score: Number(s.toFixed(1)) };
      });

      // Calculate weighted average (mocking actual weights)
      const weights = [0.28, 0.15, 0.14, 0.12, 0.11, 0.08, 0.05, 0.04, 0.03];
      severityScore = individual_predictions.reduce((acc, curr, idx) => acc + curr.score * weights[idx], 0);
      severityScore = Number(severityScore.toFixed(1));

      // Calculate std deviation
      const diffSq = individual_predictions.map(p => Math.pow(p.score - severityScore, 2));
      const variance = diffSq.reduce((acc, curr) => acc + curr, 0) / individual_predictions.length;
      uncertainty = Number(Math.sqrt(variance).toFixed(2));
    }
    
    // Allocate zone scores based roughly on severity
    let remainingScore = Math.floor(severityScore);
    const zones = [0, 0, 0, 0, 0, 0];

    
    for(let i=0; i<6 && remainingScore > 0; i++) {
        if(Math.random() > 0.3) {
            const add = Math.min(1, remainingScore);
            zones[i] = add;
            remainingScore -= add;
        }
    }
    // shuffle zones slightly
    zones.sort(() => Math.random() - 0.5);

    const totalLungPixels = Math.floor(120000 + Math.random() * 50000);
    const involvementPercentage = Number((severityScore / 6 * 100 * (0.8 + Math.random()*0.4)).toFixed(2));
    const diseasePixels = Math.floor(totalLungPixels * (involvementPercentage / 100));

    const result: PredictionResult = {
      id: uuidv4(),
      patient_id: `ANON-${Math.floor(10000 + Math.random() * 90000)}`,
      study_date: new Date().toISOString().split('T')[0],
      image_url: imageUrl,
      severity_score: severityScore,
      zone_scores: {
        L_upper: zones[0],
        L_middle: zones[1],
        L_lower: zones[2],
        R_upper: zones[3],
        R_middle: zones[4],
        R_lower: zones[5],
      },
      statistics: {
        total_lung_pixels: totalLungPixels,
        disease_pixels: diseasePixels,
        involvement_percentage: Math.min(100, involvementPercentage),
      },
      confidence,
      processing_time_ms: processingTimeMs,
      model_used: modelId,
      created_at: new Date().toISOString(),
      uncertainty,
      individual_predictions,
    };

    mockApi.saveToHistory(result);
    return result;
  }
};
