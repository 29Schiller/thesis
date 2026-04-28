# -*- coding: utf-8 -*-
"""
inference_pipelines/Ensemble_Inference.py

Contributions:
  [A] Spatial Disagreement Map  -- pixel-level variance across N prob maps
  [B] Score Reliability Index   -- mean-based SRI across 6 zones
  [C] Zone Risk Profile         -- mean +/- std of 6 zones across N models

Visualization Modes:
  --mode 1  (Simple)       : Original | Ensemble Segmentation overlay
  --mode 2  (SRI)          : Ensemble Seg + info box | Spatial Disagreement Map
  --mode 3  (Zone Profiler): Ensemble Seg + info box | Disagreement Map | Zone Risk Profile

Usage:
  python inference_pipelines/Ensemble_Inference.py \
      --image_path /path/to/xray.jpg \
      --subset All \
      --mode 2 \
      --save_path /path/to/output.png

Optional args:
  --lung_helper   Stage 1 model (default: DeepLabV3plus)
  --subset        All | Normal | COVID-19  (default: All)
  --mode          1 | 2 | 3  (default: 2)
  --pipeline_json Path to Threshold_pipeline.json
  --threshold     Fallback threshold if pipeline.json missing
  --save_path     Save output image (optional)
"""

import sys
import os
import json
import argparse
import torch
import cv2
import numpy as np
import matplotlib.pyplot as plt

# =========================================================
# 1. PATH SETUP
# =========================================================
current_dir  = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from tools.models          import load_model_by_stage, predict_mask, predict_prob_map
from tools.data_processing import preprocess_single_image
from tools.utils import (
    get_lung_roi,
    map_mask_to_original,
    separate_lungs,
    split_lung_binary_search,
    compute_sri,
)

# =========================================================
# 2. CONSTANTS
# =========================================================
STAGE2_MODELS = [
    # "Unetplusplus", "DeepLabV3",
    # "DeepLabV3plus", "Linknet",
    # "PSPNet", "PAN",
    "MAnet", "FPN", "Unet"
]
ZONE_LABELS = ["L-Upper", "L-Mid", "L-Lower", "R-Upper", "R-Mid", "R-Lower"]


# =========================================================
# 3. ZONE SPLITTING HELPER
# =========================================================
def split_lung_into_segments(lung_mask_clean, disease_mask_full):
    """Split 2 lungs into 6 equal-area zones, return Coverage Ratios + draw info."""
    left_lung, right_lung = separate_lungs(lung_mask_clean)
    ratios, draw_info = [], []

    for single_lung in [left_lung, right_lung]:
        if single_lung is None or np.sum(single_lung) == 0:
            ratios.extend([0.0, 0.0, 0.0])
            draw_info.append(None)
            continue
        y_top, y_bot = split_lung_binary_search(single_lung)
        draw_info.append({'mask': single_lung, 'y_lines': [y_top, y_bot]})
        h, _ = single_lung.shape
        for y0, y1 in [(0, y_top), (y_top, y_bot), (y_bot, h)]:
            seg = np.zeros_like(single_lung)
            seg[y0:y1, :] = single_lung[y0:y1, :]
            area = np.sum(seg)
            if area == 0:
                ratios.append(0.0)
            else:
                inter = np.sum((seg > 0) & (disease_mask_full > 0))
                ratios.append(float(inter) / float(area))

    while len(ratios) < 6:
        ratios.append(0.0)
    return ratios[:6], draw_info


# =========================================================
# 4. LOAD PIPELINE CONFIG
# =========================================================
def load_pipeline_config(pipeline_json_path, subset="All"):
    """
    Load threshold + SRI + Zone Profile from Threshold_pipeline.json.
    For ensemble we average optimal_threshold and best_mae across all models.
    Returns a config dict with keys: optimal_threshold, best_mae, sri_mean,
    sri_std, zone_mean, zone_std  (all averaged across models in the JSON).
    Returns None if the file is missing or unreadable.
    """
    if not os.path.exists(pipeline_json_path):
        print(f"[WARN] pipeline.json not found: {pipeline_json_path} -- using fallback.")
        return None

    with open(pipeline_json_path, 'r', encoding='utf-8') as f:
        registry = json.load(f)

    thresholds, maes, sri_means, sri_stds = [], [], [], []
    zone_means, zone_stds = [], []

    for model_name, subsets in registry.items():
        key = subset if subset in subsets else ("All" if "All" in subsets else None)
        if key is None:
            continue
        entry = subsets[key]
        thresholds.append(entry.get('optimal_threshold', 0.25))
        maes.append(entry.get('best_mae', None))
        sri_means.append(entry.get('sri_mean', None))
        sri_stds.append(entry.get('sri_std', None))
        zm = entry.get('zone_mean')
        zs = entry.get('zone_std')
        if zm is not None:
            zone_means.append(zm)
        if zs is not None:
            zone_stds.append(zs)

    if not thresholds:
        print(f"[WARN] No entries found for subset '{subset}' in pipeline.json.")
        return None

    def safe_mean(lst):
        clean = [v for v in lst if v is not None]
        return round(float(np.mean(clean)), 4) if clean else None

    config = {
        'optimal_threshold': round(float(np.mean(thresholds)), 4),
        'best_mae':          safe_mean(maes),
        'sri_mean':          safe_mean(sri_means),
        'sri_std':           safe_mean(sri_stds),
        'zone_mean': [round(float(v), 4) for v in np.mean(zone_means, axis=0)] if zone_means else None,
        'zone_std':  [round(float(v), 4) for v in np.mean(zone_stds,  axis=0)] if zone_stds  else None,
        'n_models':  len(thresholds),
    }
    print(f"[INFO] Ensemble pipeline config loaded: {config['n_models']} models, "
          f"subset={subset}, avg_threshold={config['optimal_threshold']}")
    return config


# =========================================================
# 5. CONTRIBUTION A -- SPATIAL DISAGREEMENT MAP
# =========================================================
def compute_spatial_disagreement_map(prob_maps):
    """
    Pixel-level variance across N probability maps.
    High variance = models disagree (uncertain).
    Low  variance = models agree    (certain).

    Input : List[np.ndarray float32] shape (H, W) each
    Output: np.ndarray float32 shape (H, W)
    """
    stack = np.stack(prob_maps, axis=0)   # (N, H, W)
    return np.var(stack, axis=0).astype(np.float32)


def compute_ensemble_mask(prob_maps, threshold):
    """Mean probability map thresholded to binary consensus mask."""
    mean_prob = np.mean(np.stack(prob_maps, axis=0), axis=0)
    return (mean_prob >= threshold).astype(np.uint8)


# =========================================================
# 6. CONTRIBUTION C -- ZONE RISK PROFILE (ENSEMBLE VERSION)
# =========================================================
def compute_zone_risk_profile_ensemble(ratios_per_model):
    """
    Stack per-model Coverage Ratio vectors into (N_models, 6) matrix.
    Compute column-wise mean and std.

    zone_mean[i] = average disease burden at zone i across N models
    zone_std[i]  = model disagreement at zone i

    Returns: zone_mean (6,), zone_std (6,), zone_matrix (N, 6)
    """
    models      = list(ratios_per_model.keys())
    zone_matrix = np.array([ratios_per_model[m] for m in models], dtype=np.float64)
    zone_mean   = np.mean(zone_matrix, axis=0)
    zone_std    = np.std(zone_matrix,  axis=0)
    return zone_mean, zone_std, zone_matrix


# =========================================================
# 7. SHARED VISUALIZATION HELPERS
# =========================================================
def _build_ensemble_overlay(original_image, lung_mask_full, ensemble_disease_mask,
                             draw_info):
    """Build BGR overlay: disease=red, lung contour=cyan, zone lines=white."""
    h_orig  = original_image.shape[0]
    res     = original_image.copy()
    overlay = original_image.copy()
    overlay[ensemble_disease_mask > 0] = [0, 0, 255]
    cv2.addWeighted(overlay, 0.55, res, 0.45, 0, res)

    contours, _ = cv2.findContours(
        lung_mask_full, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(res, contours, -1, (255, 255, 0), 2, cv2.LINE_AA)

    for lung in draw_info:
        if lung is None:
            continue
        mask = lung['mask']
        for y_coord in lung['y_lines']:
            for dy in [-1, 0, 1]:
                yy = y_coord + dy
                if 0 <= yy < h_orig:
                    res[yy, mask[yy, :] > 0] = [255, 255, 255]
    return res


def _build_dmap(disagreement_map, lung_mask_full):
    """Normalise disagreement map and apply lung mask."""
    dmap      = disagreement_map.copy()
    dmap_norm = (dmap - dmap.min()) / (dmap.max() - dmap.min() + 1e-8)
    return dmap_norm * lung_mask_full.astype(np.float32)


def _sri_label_color(sri):
    if sri >= 0.70:
        return "HIGH", "#2ca02c"
    elif sri >= 0.40:
        return "MEDIUM", "#ff7f0e"
    else:
        return "LOW", "#d62728"


def _sri_note(sri):
    if sri >= 0.70:
        return "Zones far from boundary -- score is stable"
    elif sri >= 0.40:
        return "Moderate distance from boundary -- use with care"
    else:
        return "Zones near boundary -- score may be fragile"


def _draw_infobox(ax, ratios, total_score, threshold, sri,
                  best_mae, subset, loaded_models):
    """
    Horizontal two-column info box overlaid on ax.
      Left  : Models / Subset / Threshold / Val MAE / Score / SRI / SRI Note
      Right : Region Ratios (6 zones)
    """
    sri_label, _ = _sri_label_color(sri)
    note_str      = _sri_note(sri)
    score_color   = 'red' if total_score >= 4 else ('orange' if total_score >= 2 else 'green')
    mae_str       = f"{best_mae:.4f}" if best_mae is not None else "N/A"
    models_str    = ", ".join(loaded_models)

    left_lines = [
        f"Models    : {models_str}",
        f"Subset    : {subset}",
        f"Threshold : {threshold:.2f}",
        f"Val MAE   : {mae_str}",
        "",
        f"Score     : {total_score}/6",
        f"SRI       : {sri:.4f}  [{sri_label}]",
        f"SRI Note  : {note_str}",
    ]

    # Compute per-zone d_i for uncertainty flagging
    def _di(r, t):
        md = (1.0 - t) if r >= t else t
        return abs(r - t) / md if md > 1e-8 else 1.0

    right_lines = ["Region Ratios:", ""]
    for i, r in enumerate(ratios):
        mark = "[+1]" if r >= threshold else "[ 0]"
        flag = " !" if _di(r, threshold) < 0.10 else "  "
        right_lines.append(f"  {ZONE_LABELS[i]}: {r * 100:5.1f}%  {mark}{flag}")

    box_style = dict(facecolor='black', alpha=0.72, edgecolor='white', pad=6)

    ax.text(0.02, 0.97, "\n".join(left_lines),
            transform=ax.transAxes, color='white',
            fontsize=8.0, fontfamily='monospace',
            verticalalignment='top', bbox=box_style)

    ax.text(0.52, 0.97, "\n".join(right_lines),
            transform=ax.transAxes, color='white',
            fontsize=8.0, fontfamily='monospace',
            verticalalignment='top', bbox=box_style)

    ax.set_title(
        f"Ensemble Segmentation  |  Score: {total_score}/6  |  {len(loaded_models)} Models",
        fontsize=11, fontweight='bold', color=score_color)


def _draw_disagreement(ax, dmap_lung, lung_mask_full):
    """Render disagreement heatmap onto ax (no histogram, no colorbar sidebar)."""
    im = ax.imshow(dmap_lung, cmap='jet', vmin=0.0, vmax=dmap_lung.max())
    plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="Normalised Variance")
    ax.contour(lung_mask_full, levels=[0.5], colors='white', linewidths=1.2)
    ax.set_title("Spatial Disagreement Map\n(Pixel Variance across Models)", fontsize=11)
    ax.axis("off")


def _draw_zone_profile(ax, zone_mean, zone_std, threshold, n_models):
    """Zone Risk Profile bar chart."""
    x      = np.arange(6)
    colors = ['#d62728' if zone_mean[i] >= threshold else '#1f77b4' for i in range(6)]
    ax.bar(x, zone_mean, yerr=zone_std, capsize=5, color=colors, alpha=0.80,
           edgecolor='black', linewidth=0.7,
           error_kw={'elinewidth': 1.5, 'ecolor': 'darkblue', 'capthick': 1.5})
    ax.axhline(y=threshold, color='red', linestyle='--', linewidth=1.5,
               label=f'Threshold = {threshold:.2f}')
    ax.set_xticks(x)
    ax.set_xticklabels(ZONE_LABELS, fontsize=8, rotation=15)
    ax.set_ylim(0, min(1.05, float(np.max(zone_mean + zone_std)) + 0.12))
    ax.set_ylabel('Coverage Ratio', fontsize=9)
    ax.set_title(f'Zone Risk Profile\n(mean +/- std, {n_models} Models)',
                 fontsize=11, fontweight='bold')
    ax.legend(fontsize=8)
    for i, (m, s) in enumerate(zip(zone_mean, zone_std)):
        ax.text(i, m + s + 0.015, f'{m:.2f}',
                ha='center', va='bottom', fontsize=8, fontweight='bold')


# =========================================================
# 8. THREE VISUALIZATION MODES
# =========================================================

def _mode1(original_image, lung_mask_full, ensemble_disease_mask,
           draw_info, total_score, threshold, loaded_models, save_path):
    """
    Mode 1 - Simple
    Left : Original X-Ray
    Right: Ensemble Segmentation overlay, score as title only
    """
    score_color = 'red' if total_score >= 4 else ('orange' if total_score >= 2 else 'green')
    res_viz = _build_ensemble_overlay(
        original_image, lung_mask_full, ensemble_disease_mask, draw_info)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

    ax1.imshow(cv2.cvtColor(original_image, cv2.COLOR_BGR2RGB))
    ax1.set_title("Original X-Ray", fontsize=13)
    ax1.axis("off")

    ax2.imshow(cv2.cvtColor(res_viz, cv2.COLOR_BGR2RGB))
    ax2.set_title(
        f"Ensemble Score: {total_score}/6  |  {len(loaded_models)} Models",
        fontsize=13, fontweight='bold', color=score_color)
    ax2.axis("off")

    plt.tight_layout()
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"[INFO] Saved to: {save_path}")
    plt.show()
    plt.close()


def _mode2(original_image, lung_mask_full, ensemble_disease_mask,
           draw_info, ratios, total_score, threshold,
           sri, best_mae, subset, loaded_models,
           disagreement_map, save_path):
    """
    Mode 2 - SRI
    Left : Ensemble Segmentation + zone lines + horizontal info box
    Right: Spatial Disagreement Map (no histogram)
    """
    sri_label, sri_color = _sri_label_color(sri)
    res_viz  = _build_ensemble_overlay(
        original_image, lung_mask_full, ensemble_disease_mask, draw_info)
    dmap_lung = _build_dmap(disagreement_map, lung_mask_full)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    ax1.imshow(cv2.cvtColor(res_viz, cv2.COLOR_BGR2RGB))
    _draw_infobox(ax1, ratios, total_score, threshold, sri,
                  best_mae, subset, loaded_models)
    ax1.axis("off")

    _draw_disagreement(ax2, dmap_lung, lung_mask_full)

    fig.suptitle(
        f"Ensemble Inference  |  SRI = {sri:.4f}  [{sri_label}]",
        fontsize=13, fontweight='bold', color=sri_color)
    plt.tight_layout()
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"[INFO] Saved to: {save_path}")
    plt.show()
    plt.close()


def _mode3(original_image, lung_mask_full, ensemble_disease_mask,
           draw_info, ratios, total_score, threshold,
           sri, best_mae, subset, loaded_models,
           disagreement_map, zone_mean, zone_std, save_path):
    """
    Mode 3 - Zone Profiler
    Left  : Ensemble Segmentation + zone lines + horizontal info box
    Middle: Spatial Disagreement Map (no histogram)
    Right : Zone Risk Profile chart
    """
    sri_label, sri_color = _sri_label_color(sri)
    res_viz   = _build_ensemble_overlay(
        original_image, lung_mask_full, ensemble_disease_mask, draw_info)
    dmap_lung = _build_dmap(disagreement_map, lung_mask_full)

    fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(22, 7))

    ax1.imshow(cv2.cvtColor(res_viz, cv2.COLOR_BGR2RGB))
    _draw_infobox(ax1, ratios, total_score, threshold, sri,
                  best_mae, subset, loaded_models)
    ax1.axis("off")

    _draw_disagreement(ax2, dmap_lung, lung_mask_full)

    _draw_zone_profile(ax3, zone_mean, zone_std, threshold, len(loaded_models))

    fig.suptitle(
        f"Ensemble Inference  |  SRI = {sri:.4f}  [{sri_label}]",
        fontsize=13, fontweight='bold', color=sri_color)
    plt.tight_layout()
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"[INFO] Saved to: {save_path}")
    plt.show()
    plt.close()


# =========================================================
# 9. DISPATCHER
# =========================================================
def visualize_ensemble_results(
    original_image, lung_mask_full, ensemble_disease_mask,
    disagreement_map, ratios, draw_info, total_score, threshold,
    sri, zone_mean, zone_std, zone_matrix,
    loaded_models, best_mae, subset,
    mode=2, save_path=None,
):
    """
    Dispatch to the correct visualization mode.

    mode 1 - Simple       : Original | Ensemble Seg overlay
    mode 2 - SRI          : Ensemble Seg + info box | Disagreement Map
    mode 3 - Zone Profiler: Ensemble Seg + info box | Disagreement Map | Zone Profile
    """
    if mode == 1:
        _mode1(original_image, lung_mask_full, ensemble_disease_mask,
               draw_info, total_score, threshold, loaded_models, save_path)
    elif mode == 2:
        _mode2(original_image, lung_mask_full, ensemble_disease_mask,
               draw_info, ratios, total_score, threshold,
               sri, best_mae, subset, loaded_models,
               disagreement_map, save_path)
    elif mode == 3:
        _mode3(original_image, lung_mask_full, ensemble_disease_mask,
               draw_info, ratios, total_score, threshold,
               sri, best_mae, subset, loaded_models,
               disagreement_map, zone_mean, zone_std, save_path)
    else:
        print(f"[WARN] Unknown mode {mode} -- defaulting to mode 2.")
        _mode2(original_image, lung_mask_full, ensemble_disease_mask,
               draw_info, ratios, total_score, threshold,
               sri, best_mae, subset, loaded_models,
               disagreement_map, save_path)


# =========================================================
# 10. MAIN PIPELINE
# =========================================================
def main(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Ensemble Inference | Device: {device} | Mode: {args.mode} | Subset: {args.subset}")
    print(f"[*] Models: {STAGE2_MODELS}")

    # Load pipeline config for threshold
    default_json  = os.path.join(project_root, "resources", "Threshold_pipeline.json")
    pipeline_json = args.pipeline_json if args.pipeline_json else default_json
    pipeline_config = load_pipeline_config(pipeline_json, subset=args.subset)

    if pipeline_config:
        threshold = pipeline_config['optimal_threshold']
        best_mae  = pipeline_config.get('best_mae')
        print(f"[INFO] Ensemble avg threshold : {threshold}")
    else:
        threshold = args.threshold
        best_mae  = None
        print(f"[INFO] Fallback threshold: {threshold}")

    if not os.path.exists(args.image_path):
        print(f"[ERROR] Image not found: {args.image_path}")
        return

    original_image = cv2.imread(args.image_path)
    h_orig, w_orig = original_image.shape[:2]

    # Stage 1
    try:
        model_s1, conf_s1 = load_model_by_stage(1, args.lung_helper, device, project_root)
    except Exception as e:
        print(f"[ERROR] Stage 1 load failed: {e}")
        return

    roi_img, bbox, lung_mask_full = get_lung_roi(original_image, model_s1, conf_s1, device)
    if roi_img is None:
        print("[ERROR] Lung not detected.")
        return

    roi_h = bbox[1] - bbox[0] + 1
    roi_w = bbox[3] - bbox[2] + 1

    # Stage 2 loop
    prob_maps_full   = []
    ratios_per_model = {}
    loaded_models    = []

    for model_name in STAGE2_MODELS:
        print(f"  -> {model_name} ...", end=" ", flush=True)
        try:
            model_s2, conf_s2 = load_model_by_stage(2, model_name, device, project_root)
            s2_size    = tuple(conf_s2.get('input_size', [512, 512]))
            tensor_roi = preprocess_single_image(roi_img, target_size=s2_size).to(device)

            # [A] Probability map for disagreement computation
            roi_prob  = predict_prob_map(model_s2, tensor_roi, original_size=(roi_w, roi_h))
            full_prob = np.zeros((h_orig, w_orig), dtype=np.float32)
            full_prob[bbox[0]:bbox[1]+1, bbox[2]:bbox[3]+1] = roi_prob
            prob_maps_full.append(full_prob)

            # [C] Binary mask for per-model zone ratios
            roi_mask  = predict_mask(model_s2, tensor_roi, original_size=(roi_w, roi_h))
            full_mask = map_mask_to_original(roi_mask, bbox, (h_orig, w_orig))
            model_ratios, _ = split_lung_into_segments(lung_mask_full, full_mask)
            ratios_per_model[model_name] = model_ratios

            loaded_models.append(model_name)
            print("OK")
        except Exception as e:
            print(f"SKIP ({e})")

    if len(loaded_models) < 2:
        print(f"[ERROR] Need at least 2 models. Loaded: {len(loaded_models)}.")
        return

    print(f"\n[INFO] {len(loaded_models)}/{len(STAGE2_MODELS)} models loaded.")

    # [A] Spatial Disagreement Map
    disagreement_map  = compute_spatial_disagreement_map(prob_maps_full)

    # Ensemble mask + score
    ensemble_mask     = compute_ensemble_mask(prob_maps_full, threshold=threshold)
    ratios, draw_info = split_lung_into_segments(lung_mask_full, ensemble_mask)
    total_score       = sum(1 for r in ratios if r >= threshold)

    # [B] SRI
    sri               = compute_sri(ratios, threshold)
    sri_label, _      = _sri_label_color(sri)
    sri_note_str      = _sri_note(sri)

    # [C] Zone Risk Profile
    zone_mean, zone_std, zone_matrix = compute_zone_risk_profile_ensemble(ratios_per_model)

    print(f"\n[RESULT] Ensemble Score    : {total_score}/6")
    print(f"[RESULT] Region Ratios     : {[f'{r*100:.1f}%' for r in ratios]}")
    print(f"[RESULT] Threshold         : {threshold:.2f}")
    print(f"[RESULT] SRI               : {sri:.4f}  [{sri_label}]")
    print(f"[RESULT] SRI Note          : {sri_note_str}")
    print(f"[RESULT] Zone Mean         : {[f'{v:.3f}' for v in zone_mean]}")
    print(f"[RESULT] Zone Std          : {[f'{v:.3f}' for v in zone_std]}")
    print(f"[RESULT] Mean Disagreement : "
          f"{disagreement_map[lung_mask_full > 0].mean():.6f}")

    visualize_ensemble_results(
        original_image=original_image,
        lung_mask_full=lung_mask_full,
        ensemble_disease_mask=ensemble_mask,
        disagreement_map=disagreement_map,
        ratios=ratios,
        draw_info=draw_info,
        total_score=total_score,
        threshold=threshold,
        sri=sri,
        zone_mean=zone_mean,
        zone_std=zone_std,
        zone_matrix=zone_matrix,
        loaded_models=loaded_models,
        best_mae=best_mae,
        subset=args.subset,
        mode=args.mode,
        save_path=args.save_path,
    )


# =========================================================
# 11. CLI
# =========================================================
if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Ensemble Inference: Disagreement Map + SRI + Zone Risk Profile")
    parser.add_argument('--image_path',    type=str,   required=True)
    parser.add_argument('--lung_helper',   type=str,   default='DeepLabV3plus')
    parser.add_argument('--subset',        type=str,   default='All',
                        choices=['All', 'Normal', 'COVID-19'])
    parser.add_argument('--mode',          type=int,   default=2,
                        choices=[1, 2, 3],
                        help='1=Simple | 2=SRI | 3=Zone Profiler')
    parser.add_argument('--pipeline_json', type=str,   default=None)
    parser.add_argument('--threshold',     type=float, default=0.25)
    parser.add_argument('--save_path',     type=str,   default=None)
    args = parser.parse_args()
    main(args)
