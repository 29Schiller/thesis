const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const HEADERS = { 'ngrok-skip-browser-warning': 'true' };

// Map frontend model IDs to backend model names
const MODEL_MAP: Record<string, { s1: string; s2: string }> = {
  ensemble:  { s1: 'DeepLabV3plus', s2: 'Unet' },
  manet:     { s1: 'DeepLabV3plus', s2: 'MANet' },
  unet:      { s1: 'DeepLabV3plus', s2: 'Unet' },
  fpn:       { s1: 'DeepLabV3plus', s2: 'FPN' },
  pspnet:    { s1: 'DeepLabV3plus', s2: 'PSPNet' },
};

export async function analyzeImage(file: File, modelId: string) {
  const { s1, s2 } = MODEL_MAP[modelId] ?? MODEL_MAP['unet'];

  const form = new FormData();
  form.append('file', file);
  form.append('model_s1_name', s1);
  form.append('model_s2_name', s2);
  form.append('mode', '1');

  const res = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    headers: HEADERS,
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
  // Returns: { status, severity_score, metrics: { lung_bbox }, result_image_b64 }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/`, { headers: HEADERS });
    return res.ok;
  } catch { return false; }
}