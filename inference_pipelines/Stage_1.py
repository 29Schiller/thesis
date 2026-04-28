# inference_pipelines/Stage_1.py
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

# Import các tiện ích từ tools (Bao gồm get_lung_roi)
from tools.utils import apply_mode_visualization, visualize_stage1_results, get_lung_roi
from tools.models import load_model_by_stage

# =========================================================
# 2. THỰC THI CHÍNH (PIPELINE)
# =========================================================
def main(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Processing Stage 1 using {args.model_name} on {device} | Mode: {args.mode}")

    # 1. Đọc ảnh gốc
    if not os.path.exists(args.image_path):
        print(f"[ERROR] Không tìm thấy ảnh đầu vào tại: {args.image_path}")
        return

    original_image = cv2.imread(args.image_path)

    # 2. Load Model
    try:
        model_s1, config = load_model_by_stage(1, args.model_name, device, project_root)
    except Exception as e:
        print(f"[ERROR] Lỗi nạp mô hình: {e}")
        return

    # 3. Chạy hàm get_lung_roi để lấy Clean Mask (Đã lọc sạch điểm nhiễu)
    # Hàm này tự lo phần tiền xử lý, chạy model, lấy connected components và bóc tách
    roi_img, bbox, clean_mask = get_lung_roi(original_image, model_s1, config, device)
    
    if clean_mask is None:
        print("[ERROR] Không tìm thấy vùng phổi hợp lệ trong ảnh!")
        return

    # 4. Xử lý Visualization dựa trên MODE (Truyền vào clean_mask)
    pred_viz, title_pred = apply_mode_visualization(original_image, clean_mask, args.mode, args.model_name)

    # 5. Hiển thị kết quả bằng Matplotlib
    visualize_stage1_results(original_image, pred_viz, title_pred)

# =========================================================
# 3. KHỞI CHẠY BẰNG ARGPARSE
# =========================================================
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Stage 1 - Lung Segmentation Visualization")
    parser.add_argument('--model_name', type=str, required=True, help="Tên model trong thư mục models_lungs (vd: DeepLabV3plus)")
    parser.add_argument('--image_path', type=str, required=True, help="Đường dẫn đến bức ảnh X-quang gốc")
    parser.add_argument('--mode', type=int, choices=[1, 2], default=1, help="Mode 1: Overlay Cyan. Mode 2: Crop nền đen.")
    
    args = parser.parse_args()
    main(args)