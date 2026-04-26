export interface PredictionResult {
  id: string;
  patient_id: string;
  study_date: string;
  image_url: string; // Internal object URL for display
  severity_score: number;
  zone_scores: {
    L_upper: number;
    L_middle: number;
    L_lower: number;
    R_upper: number;
    R_middle: number;
    R_lower: number;
  };
  statistics: {
    total_lung_pixels: number;
    disease_pixels: number;
    involvement_percentage: number;
  };
  confidence: number;
  processing_time_ms: number;
  model_used: string;
  created_at: string;
  
  // Ensemble specific fields
  uncertainty?: number;
  individual_predictions?: { model: string; score: number }[];
}

export interface ModelSpec {
  id: string;
  name: string;
  mae: number;
  params: string;
  fps: number;
  dsc: number;
  recommended?: boolean;
  isEnsemble?: boolean;
}

export const MODELS: ModelSpec[] = [
  { id: 'ensemble', name: 'Meta-Ensemble (9 Models)', mae: 0.24, params: 'N/A', fps: 1.2, dsc: 0.912, recommended: true, isEnsemble: true },
  { id: 'manet', name: 'MA-Net', mae: 0.30, params: '103.9M', fps: 7.9, dsc: 0.733 },
  { id: 'unet', name: 'U-Net', mae: 0.33, params: '71.3M', fps: 7.9, dsc: 0.894 },
  { id: 'fpn', name: 'FPN', mae: 0.36, params: '5.8M', fps: 10.2, dsc: 0.856 },
  { id: 'pspnet', name: 'PSPNet', mae: 0.38, params: '4.1M', fps: 12.5, dsc: 0.771 },
];
