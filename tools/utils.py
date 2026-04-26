import os
import json
import cv2
import numpy as np
import matplotlib.pyplot as plt
import torch

from .models import predict_mask
from .data_processing import preprocess_single_image

# =====================================================================
# 1. HỆ THỐNG VÀ CẤU HÌNH (SYSTEM & CONFIG)
# =====================================================================
def create_dir_if_not_exists(directory_path):
    if not os.path.exists(directory_path):
        os.makedirs(directory_path)
        print(f"[INFO] Created directory: {directory_path}")

def load_json_config(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"[ERROR] Configuration file not found at: {file_path}")
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json_config(data, file_path):
    parent_dir = os.path.dirname(file_path)
    if parent_dir:
        create_dir_if_not_exists(parent_dir)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print(f"[INFO] Successfully saved JSON data to: {file_path}")

def get_project_root():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(current_dir)

# =====================================================================
# 2. XỬ LÝ HÌNH HỌC VÀ CHỈ SỐ (GEOMETRY & METRICS)
# =====================================================================
def separate_lungs(lung_mask):
    """Tách phổi trái và phải bằng Connected Components."""
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(lung_mask, connectivity=8)
    areas = [(i, stats[i, cv2.CC_STAT_AREA]) for i in range(1, num_labels)]
    areas.sort(key=lambda x: x[1], reverse=True)
    
    if len(areas) == 0: 
        return None, None
    elif len(areas) == 1:
        return (labels == areas[0][0]).astype(np.uint8), np.zeros_like(lung_mask)
        
    idx_1, idx_2 = areas[0][0], areas[1][0]
    mask1 = (labels == idx_1).astype(np.uint8)
    mask2 = (labels == idx_2).astype(np.uint8)
    
    M1 = cv2.moments(mask1); cx1 = int(M1["m10"] / (M1["m00"] + 1e-5))
    M2 = cv2.moments(mask2); cx2 = int(M2["m10"] / (M2["m00"] + 1e-5))
    
    if cx1 < cx2:
        return mask1, mask2 # mask1 bên trái
    return mask2, mask1 # mask2 bên trái

def split_lung_binary_search(lung_mask_single):
    """Thuật toán B2: Chia một lá phổi thành 3 vùng bằng Binary Search."""
    h, w = lung_mask_single.shape
    S_total = np.sum(lung_mask_single)
    if S_total == 0: return 0, 0
        
    S_top_target = S_total / 3.0
    S_bot_target = 2.0 * S_total / 3.0
    
    def find_y_coordinate(target_area):
        y_low, y_top, y_best = 0, h, 0
        min_diff = float('inf')
        while y_low <= y_top:
            y_mid = (y_low + y_top) // 2
            A = np.sum(lung_mask_single[:y_mid, :])
            diff = abs(A - target_area)
            if diff < min_diff:
                min_diff = diff
                y_best = y_mid
            if A <= target_area: y_low = y_mid + 1
            else: y_top = y_mid - 1
        return y_best

    y_top_coord = find_y_coordinate(S_top_target)
    y_bot_coord = find_y_coordinate(S_bot_target)
    return y_top_coord, y_bot_coord

def extract_6_segments_ratios(lung_mask, disease_mask):
    """Chia phổi thành 6 vùng và trả về tỷ lệ bệnh trên từng vùng."""
    left_lung, right_lung = separate_lungs(lung_mask)
    ratios = []
    for single_lung in [left_lung, right_lung]:
        if single_lung is None or np.sum(single_lung) == 0:
            ratios.extend([0.0, 0.0, 0.0])
            continue
        y_top, y_bot = split_lung_binary_search(single_lung)
        seg1 = np.zeros_like(single_lung); seg1[:y_top, :] = single_lung[:y_top, :]
        seg2 = np.zeros_like(single_lung); seg2[y_top:y_bot, :] = single_lung[y_top:y_bot, :]
        seg3 = np.zeros_like(single_lung); seg3[y_bot:, :] = single_lung[y_bot:, :]
        
        for seg in [seg1, seg2, seg3]:
            seg_area = np.sum(seg)
            if seg_area == 0:
                ratios.append(0.0)
            else:
                intersection = np.sum((seg > 0) & (disease_mask > 0))
                ratios.append(float(intersection) / float(seg_area))
                
    while len(ratios) < 6: ratios.append(0.0)
    return ratios[:6]

def get_lung_roi(img_bgr, model_s1, config_s1, device):
    """Sử dụng Stage 1 để lấy tọa độ vùng phổi (ROI) sau khi đã LỌC NHIỄU"""
    h, w = img_bgr.shape[:2]
    input_size = tuple(config_s1.get('input_size', [512, 512]))
    tensor_img = preprocess_single_image(img_bgr, target_size=input_size).to(device)
    
    # 1. Lấy mask thô từ model
    raw_mask = predict_mask(model_s1, tensor_img, original_size=(w, h))
    
    # 2. Áp dụng Block-Based Connected Components để xóa điểm ảnh rác (Theo đúng lý thuyết)
    left_lung, right_lung = separate_lungs(raw_mask)
    
    if left_lung is None or right_lung is None: 
        return None, None, None
        
    # Gộp 2 lá phổi lớn nhất thành Clean Mask
    clean_mask = cv2.bitwise_or(left_lung, right_lung)
    
    # 3. Tìm Bounding Box trên Clean Mask (Khung cắt giờ đây cực kỳ ôm sát 2 lá phổi)
    coords = np.argwhere(clean_mask > 0)
    if len(coords) == 0: 
        return None, None, None
        
    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)
    
    # 4. Cắt ảnh
    cropped_img = img_bgr[y_min:y_max+1, x_min:x_max+1]
    cropped_mask_s1 = clean_mask[y_min:y_max+1, x_min:x_max+1]
    roi_input = cv2.bitwise_and(cropped_img, cropped_img, mask=cropped_mask_s1)
    
    # Trả về clean_mask thay vì raw_mask
    return roi_input, (y_min, y_max, x_min, x_max), clean_mask

def map_mask_to_original(cropped_mask, crop_coords, original_shape):
    """Ánh xạ mask từ vùng đã cắt (ROI) về kích thước ảnh gốc."""
    y_min, y_max, x_min, x_max = crop_coords
    full_mask = np.zeros(original_shape, dtype=np.uint8)
    full_mask[y_min:y_max+1, x_min:x_max+1] = cropped_mask
    return full_mask

# =====================================================================
# 3. TRỰC QUAN HÓA (VISUALIZATION)
# =====================================================================
def visualize_stage1_results(original_image, pred_viz, title_pred):
    """Vẽ đồ thị 2 cột (Ảnh gốc & Ảnh phân tích)"""
    plt.figure(figsize=(12, 6))
    plt.subplot(1, 2, 1)
    plt.title("Original X-Ray", fontsize=14)
    plt.imshow(cv2.cvtColor(original_image, cv2.COLOR_BGR2RGB))
    plt.axis("off")

    plt.subplot(1, 2, 2)
    plt.title(title_pred, fontsize=14, fontweight='bold', color='blue')
    plt.imshow(cv2.cvtColor(pred_viz, cv2.COLOR_BGR2RGB))
    plt.axis("off")
    plt.tight_layout()
    plt.show()

def apply_mode_visualization(original_image, mask_resized, mode, model_name):
    """Áp dụng màu Overlay (Mode 1) hoặc Cắt nền đen (Mode 2)"""
    mask_bin = (mask_resized > 0).astype(np.uint8)
    if mode == 1:
        pred_viz = original_image.copy()
        overlay_pred = original_image.copy()
        overlay_pred[mask_bin == 1] = [255, 255, 0] # Cyan
        cv2.addWeighted(overlay_pred, 0.6, pred_viz, 0.4, 0, pred_viz)
        contours_pred, _ = cv2.findContours(mask_bin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(pred_viz, contours_pred, -1, (0, 255, 0), 2, cv2.LINE_AA)
        title_pred = f"Predicted Overlay ({model_name})"
    elif mode == 2:
        coords_pred = np.argwhere(mask_bin > 0)
        if len(coords_pred) > 0:
            y_min, x_min = coords_pred.min(axis=0)
            y_max, x_max = coords_pred.max(axis=0)
            crop_img = original_image[y_min:y_max+1, x_min:x_max+1]
            crop_mask = mask_bin[y_min:y_max+1, x_min:x_max+1]
            pred_viz = cv2.bitwise_and(crop_img, crop_img, mask=crop_mask)
        else:
            print("[WARNING] Không tìm thấy vùng phổi trong ảnh dự đoán!")
            pred_viz = np.zeros_like(original_image)
        title_pred = f"Predicted Crop ({model_name})"
    else:
        raise ValueError(f"Mode {mode} không được hỗ trợ.")
    return pred_viz, title_pred