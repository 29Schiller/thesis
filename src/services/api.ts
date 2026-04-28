import { AnalysisResult, ModelS1, ModelS2, SubsetType, VizMode } from '../types';
import { v4 as uuidv4 } from 'uuid';

const BASE = import.meta.env.VITE_API_URL ?? "";
const NGROK_HEADER = { "ngrok-skip-browser-warning": "true" };

export interface SingleConfig {
  modelS1: ModelS1;
  modelS2: ModelS2;
  subset: SubsetType;
  mode: VizMode;
  threshold: number;
}

export interface EnsembleConfig {
  modelS1: ModelS1;
  subset: SubsetType;
  mode: VizMode;
  threshold: number;
}

export async function checkHealth(): Promise<boolean> {
  if (!BASE) return true; // mock mode
  try {
    const res = await fetch(`${BASE}/`, { headers: NGROK_HEADER });
    return res.ok;
  } catch {
    return false;
  }
}

function generateMockResult(file: File, isEnsemble: boolean, cfg: any): AnalysisResult {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    patientId: `ANON-${Math.floor(10000 + Math.random() * 90000)}`,
    modelS1: cfg.modelS1,
    modelS2: isEnsemble ? "Ensemble" : cfg.modelS2,
    subset: cfg.subset,
    mode: cfg.mode,
    isEnsemble,
    severityScore: isEnsemble ? 4 : 3,
    zoneRatios: [0.1, 0.4, 0.6, 0.2, 0.5, 0.3],
    threshold: cfg.threshold,
    sri: 0.65,
    sriLabel: "MEDIUM",
    sriNote: "Mock data used. Backend API is missing.",
    zoneMeanRef: [0.1, 0.2, 0.2, 0.1, 0.2, 0.1],
    zoneStdRef: [0.2, 0.3, 0.3, 0.2, 0.3, 0.2],
    zoneStd: isEnsemble ? [0.05, 0.1, 0.15, 0.05, 0.1, 0.08] : null,
    perModelScores: isEnsemble ? { MAnet: 4, FPN: 3, Unet: 4 } : null,
    resultImageB64: "", // empty so UI handles gracefully
    lungMaskB64: null,
    diseaseMaskB64: null,
    disagreementMapB64: null,
    lungBbox: [50, 450, 50, 450],
    lungAreaPx: 160000,
    diseaseAreaPx: 50000,
    involvementPct: 31.25,
  };
}

export async function analyzeSingle(file: File, cfg: SingleConfig): Promise<AnalysisResult> {
  if (!BASE) {
    return new Promise(resolve => setTimeout(() => resolve(generateMockResult(file, false, cfg)), 1000));
  }

  const form = new FormData();
  form.append('file', file);
  form.append('model_s1_name', cfg.modelS1);
  form.append('model_s2_name', cfg.modelS2);
  form.append('mode', cfg.mode);
  form.append('subset', cfg.subset);
  form.append('threshold', String(cfg.threshold));

  const res = await fetch(`${BASE}/api/analyze`, {
    method: 'POST',
    headers: NGROK_HEADER,
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }

  const data = await res.json();
  
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    patientId: `ANON-${Math.floor(10000 + Math.random() * 90000)}`,
    modelS1: cfg.modelS1,
    modelS2: cfg.modelS2,
    subset: cfg.subset,
    mode: cfg.mode,
    isEnsemble: false,
    severityScore: data.severity_score,
    zoneRatios: data.zone_ratios,
    threshold: data.threshold,
    sri: data.sri,
    sriLabel: data.sri_label,
    sriNote: data.sri_note,
    zoneMeanRef: data.zone_mean_ref,
    zoneStdRef: data.zone_std_ref,
    zoneStd: null,
    perModelScores: null,
    resultImageB64: data.result_image_b64,
    lungMaskB64: data.lung_mask_b64 ?? null,
    diseaseMaskB64: data.disease_mask_b64 ?? null,
    disagreementMapB64: null,
    lungBbox: data.metrics.lung_bbox,
    lungAreaPx: data.metrics.lung_area_px,
    diseaseAreaPx: data.metrics.disease_area_px,
    involvementPct: data.metrics.involvement_pct,
  };
}

export async function analyzeEnsemble(file: File, cfg: EnsembleConfig): Promise<AnalysisResult> {
  if (!BASE) {
    return new Promise(resolve => setTimeout(() => resolve(generateMockResult(file, true, cfg)), 1500));
  }

  const form = new FormData();
  form.append('file', file);
  form.append('model_s1_name', cfg.modelS1);
  form.append('mode', cfg.mode);
  form.append('subset', cfg.subset);
  form.append('threshold', String(cfg.threshold));

  const res = await fetch(`${BASE}/api/ensemble`, {
    method: 'POST',
    headers: NGROK_HEADER,
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }

  const data = await res.json();
  
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    patientId: `ANON-${Math.floor(10000 + Math.random() * 90000)}`,
    modelS1: cfg.modelS1,
    modelS2: "Ensemble",
    subset: cfg.subset,
    mode: cfg.mode,
    isEnsemble: true,
    severityScore: data.severity_score,
    zoneRatios: data.zone_ratios,
    threshold: data.threshold,
    sri: data.sri,
    sriLabel: data.sri_label,
    sriNote: data.sri_note,
    zoneMeanRef: data.zone_mean_ref,
    zoneStdRef: data.zone_std_ref,
    zoneStd: data.zone_std,
    perModelScores: data.per_model_scores,
    resultImageB64: data.result_image_b64,
    lungMaskB64: data.lung_mask_b64 ?? null,
    diseaseMaskB64: data.disease_mask_b64 ?? null,
    disagreementMapB64: data.disagreement_map_b64 ?? null,
    lungBbox: data.metrics.lung_bbox,
    lungAreaPx: data.metrics.lung_area_px,
    diseaseAreaPx: data.metrics.disease_area_px,
    involvementPct: data.metrics.involvement_pct,
  };
}
