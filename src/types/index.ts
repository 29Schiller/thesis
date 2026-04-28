export type ModelS1 = "DeepLabV3plus"|"DeepLabV3"|"Unet"|"MAnet"|"FPN"|"PSPNet"|"Linknet"|"Unetplusplus";
export type ModelS2 = "Unet"|"MAnet"|"FPN"|"PSPNet";
export type SubsetType = "All"|"Normal"|"COVID-19";
export type VizMode = "1"|"2"|"3";
export type SRILabel = "HIGH"|"MEDIUM"|"LOW";
export type AppView = "upload"|"dashboard"|"lung"|"disease"|"severity"|"history"|"annotation"|"reliability";

export interface AnalysisResult {
  id: string;
  timestamp: string;
  patientId: string;
  modelS1: ModelS1;
  modelS2: ModelS2 | "Ensemble";
  subset: SubsetType;
  mode: VizMode;
  isEnsemble: boolean;
  // Scoring
  severityScore: number;
  zoneRatios: number[];           // length 6
  threshold: number;
  // Contribution B — SRI
  sri: number;
  sriLabel: SRILabel;
  sriNote: string;
  // Contribution C — Zone Risk Profile reference
  zoneMeanRef: number[]|null;
  zoneStdRef: number[]|null;
  zoneStd: number[]|null;         // ensemble: std across models
  perModelScores: Record<string,number>|null;
  // Images (base64)
  resultImageB64: string;
  lungMaskB64: string|null;
  diseaseMaskB64: string|null;
  disagreementMapB64: string|null; // Contribution A — ensemble only
  // Metrics
  lungBbox: [number,number,number,number];
  lungAreaPx: number;
  diseaseAreaPx: number;
  involvementPct: number;
}

export interface XAIVisibility {
  disagreementMap: boolean;   // Contribution A toggle
  sri: boolean;               // Contribution B toggle
  zoneRiskProfile: boolean;   // Contribution C toggle
}
