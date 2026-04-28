# -*- coding: utf-8 -*-
"""
inference_pipelines/Threshold_static.py  —  KAGGLE OFFLINE EVALUATION SCRIPT

Purpose:
  For each of 9 Stage 2 models × 3 subsets (All / COVID-19 / Normal):
  1. Grid search optimal threshold on ALL data (Train + Val + Test)
     minimising MAE between pred_score and gt_score
  2. [CONTRIBUTION B] Score Reliability Index (SRI) — mean ± std per subset
  3. [CONTRIBUTION C] Zone-level Risk Profile — mean ± std of 6 Coverage
     Ratios per subset, visualised as bar charts with ±1 std error bars
  4. Export Threshold_pipeline.json

Run on Kaggle:
  - Upload CLAUDECODE folder as a Kaggle Dataset
  - Upload CXR images + Metadata.xlsx as another Kaggle Dataset
  - Accelerator: GPU T4 x2 or P100
  - Run: main()  (or !python inference_pipelines/Threshold_static.py)
"""

import os
import sys
import json
import pickle
import numpy as np
import pandas as pd
import cv2
import torch
import torch.nn as nn
import segmentation_models_pytorch as smp
from torchvision import transforms
from tqdm import tqdm
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# =========================================================
# 0. SUPPRESS WARNINGS
# =========================================================
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

# =========================================================
# 1. CONFIGURATION
# =========================================================
torch.backends.cudnn.benchmark = True

BASE_DIR        = "/kaggle/input/datasets/schillerrodrigruez/thesis/datasets_kaggle"
STAGE2_DATA_DIR = os.path.join(BASE_DIR, "Stage 2 - Disease Segmentation")
METADATA_PATH   = "/kaggle/input/datasets/schillerrodrigruez/metadata2/Metadata.xlsx"
MODELS_BASE_DIR = "/kaggle/input/models/schillerrodrigruez/lungdiseasesegmentation/pytorch/default/1/models"
MODELS_ROOT_S1  = os.path.join(MODELS_BASE_DIR, "models_lungs")
MODELS_ROOT_S2  = os.path.join(MODELS_BASE_DIR, "models_covids")

OUTPUT_DIR      = "/kaggle/working/evaluations_scoring_performance"
OUTPUT_JSON     = os.path.join(OUTPUT_DIR, "Threshold_pipeline.json")
RAW_DATA_PICKLE = os.path.join(OUTPUT_DIR, "raw_data_cache.pkl")
PLOT_DIR        = os.path.join(OUTPUT_DIR, "zone_profiles")

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(PLOT_DIR,   exist_ok=True)

STAGE2_MODELS      = ["Unet", "Unetplusplus", "DeepLabV3",
                       "DeepLabV3plus", "FPN", "Linknet",
                       "PSPNet", "PAN", "MAnet"]
STAGE2_CROP_HELPER = "DeepLabV3plus"

# Subset definitions:
#   "All"      → entire dataset regardless of label (COVID-19 + Normal)
#   "COVID-19" → only rows where Label == 'COVID-19'
#   "Normal"   → only rows where Label == 'Normal'
SUBSETS     = ["All", "COVID-19", "Normal"]
GRID_STEP   = 106   # threshold 0.00 → 1.05, step 0.01
ZONE_LABELS = ["L-Upper", "L-Mid", "L-Lower", "R-Upper", "R-Mid", "R-Lower"]

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[*] Device: {DEVICE}")


# =========================================================
# 2. MODEL BUILDER  (self-contained, no tools.models)
# =========================================================
def build_model(arch, encoder='resnet34', in_channels=3, classes=1, activation='sigmoid'):
    architectures = {
        'unet':          smp.Unet,
        'unet++':        smp.UnetPlusPlus,
        'unetplusplus':  smp.UnetPlusPlus,
        'deeplabv3':     smp.DeepLabV3,
        'deeplabv3plus': smp.DeepLabV3Plus,
        'deeplabv3+':    smp.DeepLabV3Plus,
        'fpn':           smp.FPN,
        'pan':           smp.PAN,
        'linknet':       smp.Linknet,
        'pspnet':        smp.PSPNet,
        'manet':         smp.MAnet,
    }
    key = arch.lower().replace(" ", "")
    if key not in architectures:
        raise ValueError(f"Architecture '{arch}' not supported.")
    return architectures[key](
        encoder_name=encoder,
        encoder_weights=None,
        in_channels=in_channels,
        classes=classes,
        activation=activation
    )


def load_model(model_root, model_name, device):
    model_dir    = os.path.join(model_root, model_name)
    config_path  = os.path.join(model_dir, f"{model_name}_config.json")
    weights_path = os.path.join(model_dir, "weights.pth")
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Config not found: {config_path}")
    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Weights not found: {weights_path}")
    with open(config_path, 'r') as f:
        cfg = json.load(f)["parameters"]
    model = build_model(
        arch        = cfg['model_name'],
        encoder     = cfg['encoder_name'],
        in_channels = cfg.get('input_channels', 3),
        classes     = cfg.get('num_classes', 1),
        activation  = cfg.get('activation', 'sigmoid')
    )
    model.load_state_dict(torch.load(weights_path, map_location=device), strict=False)
    model.to(device).eval()
    return model, cfg


# =========================================================
# 3. IMAGE PREPROCESSING  (self-contained)
# =========================================================
_transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std =[0.229, 0.224, 0.225])
])


def preprocess(image_bgr, target_size=(512, 512)):
    img_rgb     = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, target_size)
    return _transform(img_resized).unsqueeze(0)


def predict_mask(model, tensor_img, original_size, device):
    with torch.no_grad():
        pred = model(tensor_img.to(device))
        if isinstance(pred, tuple):
            pred = pred[0]
        if pred.max() > 1.0 or pred.min() < 0.0:
            pred = torch.sigmoid(pred)
        mask = (pred > 0.5).squeeze().cpu().numpy().astype(np.uint8)
    return cv2.resize(mask, original_size, interpolation=cv2.INTER_NEAREST)


# =========================================================
# 4. LUNG GEOMETRY UTILITIES  (self-contained)
# =========================================================
def separate_lungs(lung_mask):
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        lung_mask, connectivity=8)
    areas = [(i, stats[i, cv2.CC_STAT_AREA]) for i in range(1, num_labels)]
    areas.sort(key=lambda x: x[1], reverse=True)
    if len(areas) == 0:
        return None, None
    if len(areas) == 1:
        return (labels == areas[0][0]).astype(np.uint8), np.zeros_like(lung_mask)
    m1  = (labels == areas[0][0]).astype(np.uint8)
    m2  = (labels == areas[1][0]).astype(np.uint8)
    cx1 = int(cv2.moments(m1)["m10"] / (cv2.moments(m1)["m00"] + 1e-5))
    cx2 = int(cv2.moments(m2)["m10"] / (cv2.moments(m2)["m00"] + 1e-5))
    return (m1, m2) if cx1 < cx2 else (m2, m1)


def split_lung_binary_search(lung_mask_single):
    h, _ = lung_mask_single.shape
    S    = np.sum(lung_mask_single)
    if S == 0:
        return 0, 0

    def find_y(target):
        lo, hi, best, best_diff = 0, h, 0, float('inf')
        while lo <= hi:
            mid  = (lo + hi) // 2
            area = np.sum(lung_mask_single[:mid, :])
            diff = abs(area - target)
            if diff < best_diff:
                best_diff, best = diff, mid
            if area <= target:
                lo = mid + 1
            else:
                hi = mid - 1
        return best

    return find_y(S / 3.0), find_y(2.0 * S / 3.0)


def get_lung_roi(img_bgr, model_s1, cfg_s1, device):
    h, w   = img_bgr.shape[:2]
    size   = tuple(cfg_s1.get('input_size', [512, 512]))
    tensor = preprocess(img_bgr, target_size=size).to(device)
    raw    = predict_mask(model_s1, tensor, (w, h), device)
    left, right = separate_lungs(raw)
    if left is None or right is None:
        return None, None, None
    clean  = cv2.bitwise_or(left, right)
    coords = np.argwhere(clean > 0)
    if len(coords) == 0:
        return None, None, None
    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)
    crop_img  = img_bgr[y_min:y_max+1, x_min:x_max+1]
    crop_mask = clean[y_min:y_max+1, x_min:x_max+1]
    roi_input = cv2.bitwise_and(crop_img, crop_img, mask=crop_mask)
    return roi_input, (y_min, y_max, x_min, x_max), clean


def extract_ratios(img_bgr, model_s1, cfg_s1, model_s2, cfg_s2, device):
    """
    Full pipeline S1→S2 on one image.
    Returns List[6 float] of Coverage Ratios, or None if lung not detected.
    """
    h, w = img_bgr.shape[:2]
    roi_img, bbox, lung_mask = get_lung_roi(img_bgr, model_s1, cfg_s1, device)
    if roi_img is None:
        return None

    roi_h = bbox[1] - bbox[0] + 1
    roi_w = bbox[3] - bbox[2] + 1

    s2_sz        = tuple(cfg_s2.get('input_size', [512, 512]))
    tensor_roi   = preprocess(roi_img, target_size=s2_sz).to(device)
    roi_dis_mask = predict_mask(model_s2, tensor_roi, (roi_w, roi_h), device)

    full_dis_mask = np.zeros((h, w), dtype=np.uint8)
    full_dis_mask[bbox[0]:bbox[1]+1, bbox[2]:bbox[3]+1] = roi_dis_mask

    left, right = separate_lungs(lung_mask)
    ratios = []
    for single in [left, right]:
        if single is None or np.sum(single) == 0:
            ratios.extend([0.0, 0.0, 0.0])
            continue
        y_top, y_bot = split_lung_binary_search(single)
        lh, _        = single.shape
        for y0, y1 in [(0, y_top), (y_top, y_bot), (y_bot, lh)]:
            seg  = np.zeros_like(single)
            seg[y0:y1, :] = single[y0:y1, :]
            area = np.sum(seg)
            if area == 0:
                ratios.append(0.0)
            else:
                inter = np.sum((seg > 0) & (full_dis_mask > 0))
                ratios.append(float(inter) / float(area))

    while len(ratios) < 6:
        ratios.append(0.0)
    return ratios[:6]


# =========================================================
# 5. METADATA LOADER  — loads ALL splits, no filter
# =========================================================
def load_metadata(metadata_path, stage2_data_dir):
    df = pd.read_excel(metadata_path)
    df = df.rename(columns={
        'Consensus score': 'gt_score',
        'Label':           'subset',   # COVID-19 / Normal
        'Subset':          'split',    # Training / Validation / Testing
        'Filename':        'filename',
        'Dataset':         'dataset'
    })
    required = {'filename', 'gt_score', 'subset', 'split', 'dataset'}
    missing  = required - set(df.columns)
    assert not missing, f"Metadata missing columns: {missing}"

    df = df.dropna(subset=['filename', 'gt_score', 'subset', 'split', 'dataset'])
    df['gt_score'] = df['gt_score'].round().astype(int).clip(0, 6)

    # ── NO SPLIT FILTER — keep Training / Validation / Testing ──
    print(f"[*] Total rows (all splits): {len(df)}")
    print(f"    Split  counts : {df['split'].value_counts().to_dict()}")
    print(f"    Subset counts : {df['subset'].value_counts().to_dict()}")

    def resolve_path(row):
        fname   = str(row['filename'])
        dataset = str(row['dataset'])
        p = os.path.join(stage2_data_dir, dataset, 'img', fname)
        if os.path.exists(p):
            return p
        stem = os.path.splitext(fname)[0]
        for ext in ['.png', '.jpg', '.jpeg', '.bmp']:
            p2 = os.path.join(stage2_data_dir, dataset, 'img', stem + ext)
            if os.path.exists(p2):
                return p2
        return None

    df['image_path'] = df.apply(resolve_path, axis=1)
    n_missing = df['image_path'].isna().sum()
    if n_missing > 0:
        print(f"[WARN] {n_missing} images not found on disk — skipped.")
        print(df[df['image_path'].isna()][['dataset', 'filename']].head(5).to_string())

    df = df.dropna(subset=['image_path']).reset_index(drop=True)
    print(f"[*] Metadata loaded: {len(df)} rows with valid image paths")
    print(f"    Split  counts : {df['split'].value_counts().to_dict()}")
    print(f"    Subset counts : {df['subset'].value_counts().to_dict()}")
    print(f"    Score range   : {df['gt_score'].min()} – {df['gt_score'].max()}")
    return df


# =========================================================
# 6. CACHE VALIDATION
# =========================================================
def load_and_validate_cache(pickle_path):
    """
    Load cache and verify every record has keys: 'gt', 'ratios', 'subset', 'split'.
    If any model's records are missing 'split', delete cache and return {}.
    This prevents silent 0-record bugs from stale caches written before 'split'
    was added to the record schema.
    """
    if not os.path.exists(pickle_path):
        return {}

    print(f"[*] Cache found: {pickle_path} — validating...")
    with open(pickle_path, 'rb') as f:
        raw_data = pickle.load(f)

    required_keys = {'gt', 'ratios', 'subset', 'split'}
    stale_models  = []
    for model_name, records in raw_data.items():
        if len(records) == 0:
            stale_models.append(model_name)
            continue
        if not required_keys.issubset(records[0].keys()):
            stale_models.append(model_name)

    if stale_models:
        print(f"[WARN] Stale cache detected for: {stale_models}")
        print(f"[WARN] Records missing required keys — deleting cache and rebuilding.")
        os.remove(pickle_path)
        return {}

    print(f"[*] Cache valid — models: {list(raw_data.keys())}")
    for m, recs in raw_data.items():
        splits_in_cache   = set(r['split']  for r in recs)
        subsets_in_cache  = set(r['subset'] for r in recs)
        print(f"    {m}: {len(recs)} records | "
              f"splits={splits_in_cache} | subsets={subsets_in_cache}")
    return raw_data


# =========================================================
# 7. GRID SEARCH OPTIMAL THRESHOLD
# =========================================================
def grid_search_threshold(data_list):
    """
    Grid search threshold from 0.00 to 1.05 (step 0.01).
    Minimises MAE between pred_score and gt_score.
    Runs on ALL data passed in (Train + Val + Test for the given subset).

    Returns:
        optimal_threshold (float), best_mae (float)
    """
    gts      = np.array([d['gt'] for d in data_list], dtype=np.float32)
    best_mae = float('inf')
    best_t   = 0.0

    for t_int in range(GRID_STEP):
        t     = t_int / 100.0
        preds = np.array(
            [sum(1 for r in d['ratios'] if r >= t) for d in data_list],
            dtype=np.float32
        )
        mae = float(np.mean(np.abs(preds - gts)))
        if mae < best_mae:
            best_mae, best_t = mae, t

    return round(best_t, 2), round(best_mae, 4)


# =========================================================
# 8. CONTRIBUTION B — SCORE RELIABILITY INDEX (SRI)
# =========================================================
def compute_sri(ratios, threshold):
    """
    [CONTRIBUTION B — Score Reliability Index]

    Đo lường mức độ "chắc chắn" của toàn bộ quyết định scoring dựa trên
    khoảng cách trung bình từ mỗi zone đến ranh giới quyết định (threshold).

    SRI ∈ [0.0, 1.0]:
        0.0 → tất cả các zones nằm đúng trên ngưỡng (tối đa bất định)
        1.0 → tất cả các zones ở cực trị 0.0 hoặc 1.0 (tối đa chắc chắn)

    Công thức (cho mỗi zone i):
        max_dist_i = (1 - threshold)  nếu ratio[i] >= threshold
                   = threshold        nếu ratio[i] <  threshold
        d_i = |ratio[i] - threshold| / max_dist_i   ∈ [0.0, 1.0]

        SRI = mean(d_i) trên 6 zones

    Args:
        ratios    : List[float] — 6 Coverage Ratios ∈ [0.0, 1.0]
        threshold : float       — decision boundary ∈ (0.0, 1.0)

    Returns:
        float : SRI ∈ [0.0, 1.0], 4 decimal places
    """
    distances = []
    for r in ratios:
        max_dist = (1.0 - threshold) if r >= threshold else threshold
        if max_dist < 1e-8:
            distances.append(1.0)
        else:
            distances.append(abs(r - threshold) / max_dist)
    return round(float(np.mean(distances)), 4)


def compute_subset_sri_stats(data_list, threshold):
    """
    Compute SRI for every sample in data_list, then return population statistics.

    Returns:
        mean_sri  (float)       — population mean SRI
        std_sri   (float)       — population std  SRI
        sri_list  (List[float]) — per-sample SRI values
    """
    sri_list = [compute_sri(item['ratios'], threshold) for item in data_list]
    arr      = np.array(sri_list, dtype=np.float64)
    return round(float(arr.mean()), 4), round(float(arr.std()), 4), sri_list


# =========================================================
# 9. CONTRIBUTION C — ZONE-LEVEL RISK PROFILE
# =========================================================
def compute_zone_risk_profile(data_list):
    """
    [CONTRIBUTION C — Zone-level Risk Profile]

    Stack all Coverage Ratio vectors into a matrix of shape (N, 6), then
    compute column-wise mean and std.

    Interpretation:
        zone_mean[i]  — average disease burden at zone i across the subset
        zone_std[i]   — inter-patient variability at zone i

    Returns:
        zone_mean : List[6 float]
        zone_std  : List[6 float]
    """
    ratio_matrix = np.array([item['ratios'] for item in data_list], dtype=np.float64)
    # shape: (N_samples, 6)
    zone_mean = np.mean(ratio_matrix, axis=0)  # (6,)
    zone_std  = np.std(ratio_matrix,  axis=0)  # (6,)
    return (
        [round(float(v), 4) for v in zone_mean],
        [round(float(v), 4) for v in zone_std]
    )


# =========================================================
# 10. VISUALIZATION — ZONE RISK PROFILE BAR CHART
# =========================================================
def plot_zone_risk_profile(zone_mean, zone_std, model_name, subset, threshold, save_dir):
    """
    Bar chart: Mean Coverage Ratio ± 1 std per zone.
    Bars whose mean >= threshold are coloured red (disease-positive zones).
    Red dashed horizontal line = optimal threshold.
    """
    x   = np.arange(6)
    fig, ax = plt.subplots(figsize=(8, 5))

    bars = ax.bar(x, zone_mean, yerr=zone_std, capsize=5,
                  color='steelblue', alpha=0.80, edgecolor='navy',
                  error_kw={'elinewidth': 1.5, 'ecolor': 'darkblue', 'capthick': 1.5})

    for i, (m, bar) in enumerate(zip(zone_mean, bars)):
        if m >= threshold:
            bar.set_facecolor('#d62728')
            bar.set_alpha(0.75)

    ax.axhline(y=threshold, color='red', linestyle='--', linewidth=1.5,
               label=f'Threshold = {threshold:.2f}')
    ax.set_xticks(x)
    ax.set_xticklabels(ZONE_LABELS, fontsize=11)
    ax.set_ylim(0, min(1.0, max(zone_mean) + max(zone_std) + 0.10))
    ax.set_ylabel('Mean Coverage Ratio +/- Std', fontsize=12)
    ax.set_title(f'Zone Risk Profile\n{model_name} | Subset: {subset}',
                 fontsize=13, fontweight='bold')
    ax.legend(fontsize=10)

    for i, (m, s) in enumerate(zip(zone_mean, zone_std)):
        ax.text(i, m + s + 0.01, f'{m:.2f}',
                ha='center', va='bottom', fontsize=9, fontweight='bold')

    plt.tight_layout()
    os.makedirs(save_dir, exist_ok=True)
    safe_subset = subset.replace('-', '').replace(' ', '')
    fname = os.path.join(save_dir, f"zone_profile_{model_name}_{safe_subset}.png")
    plt.savefig(fname, dpi=120, bbox_inches='tight')
    plt.close()
    print(f"  [PLOT] Saved Zone Profile: {fname}")


# =========================================================
# 11. MAIN
# =========================================================
def main():
    print(f"[*] Output dir   : {OUTPUT_DIR}")
    print(f"[*] Pipeline JSON: {OUTPUT_JSON}")

    # ── Load metadata (ALL splits — Training + Validation + Testing) ──
    df = load_metadata(METADATA_PATH, STAGE2_DATA_DIR)

    # ── Load Stage 1 model once ────────────────────────────────────────
    print(f"\n[*] Loading Stage 1 model: {STAGE2_CROP_HELPER}")
    model_s1, cfg_s1 = load_model(MODELS_ROOT_S1, STAGE2_CROP_HELPER, DEVICE)

    # ── Load + validate cache ──────────────────────────────────────────
    raw_data = load_and_validate_cache(RAW_DATA_PICKLE)

    pipeline_registry = {}

    # ══════════════════════════════════════════════════════════
    # MAIN LOOP: per Stage 2 model
    # Record schema: {'gt': int, 'ratios': List[6], 'subset': str, 'split': str}
    # ══════════════════════════════════════════════════════════
    for model_name in STAGE2_MODELS:
        print(f"\n{'='*60}")
        print(f"  MODEL: {model_name}")
        print(f"{'='*60}")

        # ── (A) Run inference or load from cache ───────────────
        if model_name not in raw_data:
            print(f"  [*] Running inference on {len(df)} images...")
            try:
                model_s2, cfg_s2 = load_model(MODELS_ROOT_S2, model_name, DEVICE)
            except Exception as e:
                print(f"  [SKIP] {e}")
                continue

            records = []
            for _, row in tqdm(df.iterrows(), total=len(df), desc=f"  {model_name}"):
                img = cv2.imread(str(row['image_path']))
                if img is None:
                    continue
                ratios = extract_ratios(img, model_s1, cfg_s1, model_s2, cfg_s2, DEVICE)
                if ratios is None:
                    continue
                records.append({
                    'gt':     int(row['gt_score']),
                    'ratios': ratios,
                    'subset': str(row['subset']),   # 'COVID-19' or 'Normal'
                    'split':  str(row['split'])     # 'Training' / 'Validation' / 'Testing'
                })

            raw_data[model_name] = records
            with open(RAW_DATA_PICKLE, 'wb') as f:
                pickle.dump(raw_data, f)
            splits_found  = set(r['split']  for r in records)
            subsets_found = set(r['subset'] for r in records)
            print(f"  [CACHE] {len(records)} records saved.")
            print(f"  [INFO]  splits={splits_found} | subsets={subsets_found}")
        else:
            records = raw_data[model_name]
            print(f"  [CACHE] {len(records)} records loaded from cache.")

        # ── (B) Per-subset evaluation ──────────────────────────
        pipeline_registry[model_name] = {}

        for subset in SUBSETS:
            print(f"\n  {'─'*50}")
            print(f"  Subset: [{subset}]")

            # Filter by disease label; "All" uses the full record list
            if subset == "All":
                all_data = records
            else:
                all_data = [r for r in records if r['subset'] == subset]

            if len(all_data) == 0:
                print(f"  [SKIP] No records for subset '{subset}'.")
                continue

            n = len(all_data)
            print(f"    Total records (grid search basis) : {n}")

            # ── Grid search on ALL data for this subset ────────
            # (Train + Val + Test combined → most stable threshold)
            opt_t, best_mae = grid_search_threshold(all_data)
            print(f"    Optimal Threshold : {opt_t:.2f}")
            print(f"    Best MAE (all)    : {best_mae:.4f}")

            # ── [CONTRIBUTION B] Score Reliability Index ───────
            mean_sri, std_sri, sri_list = compute_subset_sri_stats(all_data, opt_t)
            print(f"    SRI mean          : {mean_sri:.4f}")
            print(f"    SRI std           : {std_sri:.4f}")
            print(f"    SRI range         : [{min(sri_list):.4f}, {max(sri_list):.4f}]")

            # ── [CONTRIBUTION C] Zone Risk Profile ────────────
            zone_mean, zone_std = compute_zone_risk_profile(all_data)
            print(f"    Zone Mean         : {[f'{v:.3f}' for v in zone_mean]}")
            print(f"    Zone Std          : {[f'{v:.3f}' for v in zone_std]}")

            # ── Plot Zone Risk Profile bar chart ───────────────
            plot_zone_risk_profile(zone_mean, zone_std, model_name, subset, opt_t, PLOT_DIR)

            # ── Store in registry ──────────────────────────────
            pipeline_registry[model_name][subset] = {
                # Core threshold metrics
                "optimal_threshold":  opt_t,
                "best_mae":           best_mae,
                "n_samples":          n,
                # Contribution B — SRI population statistics
                "sri_mean":           mean_sri,
                "sri_std":            std_sri,
                "sri_min":            round(float(min(sri_list)), 4),
                "sri_max":            round(float(max(sri_list)), 4),
                # Contribution C — Zone Risk Profile
                "zone_mean":          zone_mean,   # List[6 float]
                "zone_std":           zone_std,    # List[6 float]
                "zone_labels":        ZONE_LABELS
            }

    # ── Export Threshold_pipeline.json ────────────────────────
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(pipeline_registry, f, indent=4, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"[DONE] Threshold_pipeline.json → {OUTPUT_JSON}")
    print(f"       Zone Profile plots      → {PLOT_DIR}")
    print(f"{'='*60}")

    # ── Summary table ─────────────────────────────────────────
    print(f"\n[SUMMARY TABLE]")
    print(f"{'Model':<18} {'Subset':<12} {'Thresh':>8} {'MAE':>8} "
          f"{'SRI_mean':>10} {'SRI_std':>9} {'N':>7}")
    print("-" * 80)
    for m, subs in pipeline_registry.items():
        for s, v in subs.items():
            print(f"{m:<18} {s:<12} "
                  f"{v['optimal_threshold']:>8.2f} "
                  f"{v['best_mae']:>8.4f} "
                  f"{v['sri_mean']:>10.4f} "
                  f"{v['sri_std']:>9.4f} "
                  f"{v['n_samples']:>7}")


# ── Entry point ───────────────────────────────────────────
main()


# =========================================================
# SCHEMA OF Threshold_pipeline.json
# =========================================================
#
# {
#   "MAnet": {
#     "All": {
#       "optimal_threshold": 0.25,       ← minimises MAE on All data
#       "best_mae":          0.3012,      ← MAE at optimal_threshold
#       "n_samples":         1200,        ← total records (Train+Val+Test)
#
#       "sri_mean":  0.6841,              ← [CONTRIBUTION B] population mean SRI
#       "sri_std":   0.1423,             ← [CONTRIBUTION B] population std  SRI
#       "sri_min":   0.1250,
#       "sri_max":   0.9750,
#
#       "zone_mean": [0.12, 0.34, 0.28, 0.11, 0.31, 0.25],  ← [CONTRIBUTION C]
#       "zone_std":  [0.08, 0.15, 0.13, 0.07, 0.14, 0.11],  ← [CONTRIBUTION C]
#       "zone_labels": ["L-Upper","L-Mid","L-Lower","R-Upper","R-Mid","R-Lower"]
#     },
#     "COVID-19": { ... },   ← same schema, filtered to COVID-19 rows only
#     "Normal":   { ... }    ← same schema, filtered to Normal rows only
#   },
#   "Unet": { ... },
#   ...
# }
ntweight='bold')

    plt.tight_layout()
    os.makedirs(save_dir, exist_ok=True)
    safe_subset = subset.replace('-', '').replace(' ', '')
    fname = os.path.join(save_dir, f"zone_profile_{model_name}_{safe_subset}.png")
    plt.savefig(fname, dpi=120, bbox_inches='tight')
    plt.close()
    print(f"  [PLOT] Saved Zone Profile: {fname}")
