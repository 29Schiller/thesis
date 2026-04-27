import sys
import os
import io
import base64
import torch
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Khai báo đường dẫn để import được từ thư mục tools
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = current_dir # Giả sử main.py nằm ở root của project python
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Import các hàm từ tools
try:
    from tools.utils import (
        preprocess_single_image,
        predict_mask,
        get_lung_roi,
        map_mask_to_original,
        apply_mode_visualization,
        calculate_regional_severity
    )
    from tools.models import load_model_by_stage
except ImportError as e:
    print(f"Warning: Could not import tools. Make sure 'tools' folder is in the same directory. Error: {e}")

app = FastAPI(title="Lung & Disease Segmentation API", version="1.0")

# Cấu hình CORS để Frontend (React/Vite) có thể gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Thay đổi thành URL của frontend trong production
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

@app.lifespan("startup")
async def startup_event():
    print(f"Loading models on device: {device}")
    lung_model_cache["s1_DeepLabV3plus"] = load_model_by_stage(1, "DeepLabV3plus", device, project_root)
    lung_model_cache["s2_Unet"] = load_model_by_stage(2, "Unet", device, project_root)
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
        # 1. Đọc file ảnh từ request
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        original_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if original_image is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        h_orig, w_orig = original_image.shape[:2]

        # 2. Load Model (Khuyến cáo: nên đưa ra Global thay vì tạo mỗi request)
        try:
            key_s1 = f"s1_{model_s1_name}"
            key_s2 = f"s2_{model_s2_name}"
            if key_s1 not in lung_model_cache or key_s2 not in lung_model_cache:
                raise HTTPException(status_code=400, detail=f"Model not preloaded: {model_s1_name} / {model_s2_name}")
            model_s1, conf_s1 = lung_model_cache[key_s1]
            model_s2, conf_s2 = lung_model_cache[key_s2]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Model error: {str(e)}")

        # 3. Stage 1: Trích xuất vùng phổi (ROI)
        roi_img, bbox, lung_mask_full = get_lung_roi(original_image, model_s1, conf_s1, device)
        
        if roi_img is None:
            raise HTTPException(status_code=400, detail="Stage 1 failed to detect lungs.")

        # 4. Stage 2: Phân vùng ổ bệnh trên ROI
        s2_input_size = tuple(conf_s2.get('input_size', [512, 512]))
        tensor_roi = preprocess_single_image(roi_img, target_size=s2_input_size).to(device)
        
        # Dự đoán mask bệnh trên vùng ROI
        roi_disease_mask = predict_mask(
            model_s2, 
            tensor_roi, 
            original_size=(bbox[3] - bbox[2] + 1, bbox[1] - bbox[0] + 1)
        )

        # 5. Mapping: Đưa mask bệnh từ ROI về kích thước ảnh gốc
        full_disease_mask = map_mask_to_original(roi_disease_mask, bbox, (h_orig, w_orig))

        # 6. Tính toán điểm severity
        severity_score, _ = calculate_regional_severity(lung_mask_full, full_disease_mask)

        # 7. Visualization: Áp dụng Mode hiển thị
        res_viz, _ = apply_mode_visualization(
            original_image, 
            full_disease_mask, 
            mode, 
            f"Stage 2 ({model_s2_name})"
        )
        
        # [Tùy chỉnh riêng cho Stage 2] - Vẽ thêm viền phổi xanh lá nếu là Mode 1
        if mode == 1:
             contours_lung, _ = cv2.findContours(lung_mask_full, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
             cv2.drawContours(res_viz, contours_lung, -1, (0, 255, 0), 2, cv2.LINE_AA)

        # 8. Encode kết quả ra dạng Base64 để trả về cho Frontend
        _, buffer = cv2.imencode('.jpg', res_viz)
        img_base64 = base64.b64encode(buffer).decode('utf-8')

        return {
            "status": "success",
            "severity_score": severity_score,
            "metrics": {
                "lung_bbox": bbox,
                # có thể bổ sung các matrix khác
            },
            "result_image_b64": f"data:image/jpeg;base64,{img_base64}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
