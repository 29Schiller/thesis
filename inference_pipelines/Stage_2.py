import sys
import os
import argparse
import torch
import cv2

# =========================================================
# 1. SETUP ĐƯỜNG DẪN HỆ THỐNG
# =========================================================
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

# Import từ bộ công cụ tools (Facade Pattern)
from tools.utils import (
    preprocess_single_image,
    predict_mask,
    get_lung_roi,
    map_mask_to_original,
    apply_mode_visualization,
    visualize_stage1_results # Tái sử dụng hàm hiển thị 2 cột
)
from tools.models import load_model_by_stage

# =========================================================
# 2. THỰC THI CHÍNH (PIPELINE STAGE 2)
# =========================================================
def main(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Starting Stage 2 Pipeline | Model: {args.model_name} | Mode: {args.mode}")

    if not os.path.exists(args.image_path):
        print(f"[ERROR] Image not found: {args.image_path}")
        return

    # 1. Load Original Image
    original_image = cv2.imread(args.image_path)
    h_orig, w_orig = original_image.shape[:2]

    # 2. Load Models (Stage 1 Helper & Stage 2 Target)
    try:
        model_s1, conf_s1 = load_model_by_stage(1, args.lung_helper, device, project_root)
        model_s2, conf_s2 = load_model_by_stage(2, args.model_name, device, project_root)
    except Exception as e:
        print(e)
        return

    # 3. Stage 1: Trích xuất vùng phổi (ROI)
    roi_img, bbox, lung_mask_full = get_lung_roi(original_image, model_s1, conf_s1, device)
    
    if roi_img is None:
        print("[ERROR] Stage 1 failed to detect lungs. Cannot proceed to Stage 2.")
        return

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

    # 6. Visualization: Áp dụng Mode hiển thị (Sử dụng hàm chung)
    # Lưu ý: Hàm apply_mode_visualization của bạn có thể cần chỉnh sửa để nhận thêm lung_mask_full 
    # nếu bạn muốn vẽ viền xanh lá (phổi) kèm màu Cyan (bệnh) ở Mode 1.
    res_viz, title_pred = apply_mode_visualization(
        original_image, 
        full_disease_mask, 
        args.mode, 
        f"Stage 2 ({args.model_name})"
    )
    
    # [Tùy chỉnh riêng cho Stage 2] - Vẽ thêm viền phổi xanh lá nếu là Mode 1
    if args.mode == 1:
         contours, _ = cv2.findContours(lung_mask_full, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
         cv2.drawContours(res_viz, contours, -1, (0, 255, 0), 2, cv2.LINE_AA)

    # 7. Hiển thị kết quả bằng Matplotlib
    visualize_stage1_results(original_image, res_viz, title_pred)

# =========================================================
# 3. CLI ARGUMENTS
# =========================================================
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Stage 2 - Disease Segmentation Pipeline")
    parser.add_argument('--model_name', type=str, required=True, help="Tên model Stage 2 trong models_covids (vd: Unet)")
    parser.add_argument('--image_path', type=str, required=True, help="Đường dẫn đến ảnh X-quang gốc")
    parser.add_argument('--mode', type=int, choices=[1, 2], default=1, help="1: Full Overlay, 2: Cropped ROI")
    parser.add_argument('--lung_helper', type=str, default='DeepLabV3plus', help="Model Stage 1 dùng để cắt phổi")
    
    args = parser.parse_args()
    main(args)