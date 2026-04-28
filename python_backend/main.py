import sys
import os
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)   # ← lên 1 cấp = root_folder

if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Import các hàm từ tools
import base64
import torch
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from tools.utils import *
from tools.models import *
from tools.data_processing import *

app = FastAPI(title="Lung & Disease Segmentation API", version="1.0")

# Cấu hình CORS để Frontend (React/Vite) có thể gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://thesis-gules-theta.vercel.app",  # ← replace with real Vercel URL
        "http://localhost:3000",
    ], # Thay đổi thành URL của frontend trong production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load context device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- KHOẢNG MẠCH LOAD MODEL SẴN LÊN RAM ---
# Ghi chú: Để tối ưu, bạn có thể load model lên RAM/VRAM ngay tại đây 
# thay vì load lại mỗi lần call API.
# Replace the commented-out block near the top with:
lung_model_cache = {}

@app.on_event("startup")
async def startup_event():
    print(f"Loading models on device: {device}")
    print(f"Project root: {project_root}")
    lung_model_cache["s1_DeepLabV3plus"] = load_model_by_stage(1, "DeepLabV3plus", device, project_root)
    for name in ["Unet", "MANet", "FPN", "PSPNet"]:
        lung_model_cache[f"s2_{name}"] = load_model_by_stage(2, name, device, project_root)
    print("Models loaded.")


@app.get("/")
def read_root():
    return {"message": "Welcome to CXR Segmentation API"}

@app.post("/api/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    model_s1_name: str = "DeepLabV3plus",
    model_s2_name: str = "Unet",
    mode: int = 1
):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        original_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if original_image is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        h_orig, w_orig = original_image.shape[:2]

        key_s1 = f"s1_{model_s1_name}"
        key_s2 = f"s2_{model_s2_name}"
        if key_s1 not in lung_model_cache:
            raise HTTPException(status_code=400, detail=f"Model not loaded: {key_s1}")
        if model_s2_name != "Ensemble" and key_s2 not in lung_model_cache:
            raise HTTPException(status_code=400, detail=f"Model not loaded: {key_s2}")

        model_s1, conf_s1 = lung_model_cache[key_s1]
        
        if model_s2_name != "Ensemble":
            model_s2, conf_s2 = lung_model_cache[key_s2]

        # Stage 1
        roi_img, bbox, lung_mask_full = get_lung_roi(original_image, model_s1, conf_s1, device)
        if roi_img is None:
            raise HTTPException(status_code=400, detail="Stage 1: lungs not detected")

        if model_s2_name == "Ensemble":
            # load all 4 models and run ensemble
            s2_names = ["Unet", "MANet", "FPN", "PSPNet"]
            avg_prob_map = None
            
            s2_size = tuple(lung_model_cache["s2_Unet"][1].get('input_size', [512, 512]))
            tensor_roi = preprocess_single_image(roi_img, target_size=s2_size).to(device)
            roi_h = bbox[1] - bbox[0] + 1
            roi_w = bbox[3] - bbox[2] + 1

            for name in s2_names:
                model_s2, conf_s2 = lung_model_cache[f"s2_{name}"]
                prob_map = predict_prob_map(model_s2, tensor_roi, original_size=(roi_w, roi_h))
                if avg_prob_map is None:
                    avg_prob_map = prob_map / len(s2_names)
                else:
                    avg_prob_map += prob_map / len(s2_names)
            
            roi_disease_mask = (avg_prob_map > 0.5).astype(np.uint8)
        else:
            s2_size = tuple(conf_s2.get('input_size', [512, 512]))
            tensor_roi = preprocess_single_image(roi_img, target_size=s2_size).to(device)
            roi_h = bbox[1] - bbox[0] + 1
            roi_w = bbox[3] - bbox[2] + 1
            roi_disease_mask = predict_mask(model_s2, tensor_roi, original_size=(roi_w, roi_h))

        # Map back to full image
        full_disease_mask = map_mask_to_original(roi_disease_mask, bbox, (h_orig, w_orig))

        # Severity
        def calculate_severity(lung_mask, disease_mask, threshold=0.25):
            left_lung, right_lung = separate_lungs(lung_mask)
            ratios = []
            for single_lung in [left_lung, right_lung]:
                if single_lung is None or np.sum(single_lung) == 0:
                    ratios.extend([0.0, 0.0, 0.0]); continue
                y_top, y_bot = split_lung_binary_search(single_lung)
                h = single_lung.shape[0]
                for y0, y1 in [(0, y_top), (y_top, y_bot), (y_bot, h)]:
                    seg = np.zeros_like(single_lung)
                    seg[y0:y1, :] = single_lung[y0:y1, :]
                    area = np.sum(seg)
                    ratios.append(0.0 if area == 0 else float(np.sum((seg > 0) & (disease_mask > 0))) / area)
            ratios = (ratios + [0.0] * 6)[:6]
            return sum(1 for r in ratios if r >= threshold), ratios
        
        severity_score, zone_ratios = calculate_severity(lung_mask_full, full_disease_mask)
        
        # Calculate SRI
        sri = compute_sri(zone_ratios, threshold=0.25)

        # Visualization (matches Inference.py)
        res_viz = original_image.copy()
        overlay = original_image.copy()
        overlay[full_disease_mask > 0] = [0, 0, 255]           # red disease
        cv2.addWeighted(overlay, 0.6, res_viz, 0.4, 0, res_viz)
        contours_lung, _ = cv2.findContours(lung_mask_full, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(res_viz, contours_lung, -1, (255, 255, 0), 2, cv2.LINE_AA)  # cyan lung border

        _, buffer = cv2.imencode('.jpg', res_viz)
        img_b64 = base64.b64encode(buffer).decode('utf-8')

        # Add this helper function before the endpoint:
        def to_python(obj):
            """Recursively convert numpy types to native Python types."""
            import numpy as np
            if isinstance(obj, np.integer):
                return int(obj)
            if isinstance(obj, np.floating):
                return float(obj)
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            if isinstance(obj, (list, tuple)):
                return [to_python(x) for x in obj]
            return obj
        
        return {
            "status": "success",
            "severity_score": int(severity_score),          # numpy.int64 → int
            "metrics": {
                "lung_bbox": to_python(bbox),
                "zone_ratios": zone_ratios,
                "sri": float(sri)
            },
            "result_image_b64": f"data:image/jpeg;base64,{img_b64}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
