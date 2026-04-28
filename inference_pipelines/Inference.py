# -*- coding: utf-8 -*-
"""
inference_pipelines/Inference.py  --  SINGLE-IMAGE INFERENCE PIPELINE

Contributions integrated:
  [CONTRIBUTION B] Score Reliability Index (SRI)
  [CONTRIBUTION C] Zone Risk Profile Reference

Visualization Modes:
  --mode 1  (Simple)       : Original | Severity Score overlay
  --mode 2  (SRI)          : Original | Segmentation + SRI info box (horizontal)
  --mode 3  (Zone Profiler): Segmentation + SRI info box | Zone Risk Profile chart

Usage:
  python inference_pipelines/Inference.py \
      --image_path /path/to/xray.jpg \
      --model_name MAnet \
      --subset All \
      --mode 2

Optional args:
  --lung_helper     Stage 1 model (default: DeepLabV3plus)
  --subset          All | Normal | COVID-19  (default: All)
  --mode            1 | 2 | 3  (default: 2)
  --pipeline_json   Path to Threshold_pipeline.json
  --threshold       Fallback threshold if pipeline.json missing
  --save_path       Save output image (optional)
"""

import sys
import os
import argparse
import json
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

from tools.models          import load_model_by_stage, predict_mask
from tools.data_processing import preprocess_single_image
from tools.utils import (
    get_lung_roi,
    map_mask_to_original,
    separate_lungs,
    split_lung_binary_search,
    compute_sri,
)

ZONE_LABELS = ["L-Upper", "L-Mid", "L-Lower", "R-Upper", "R-Mid", "R-Lower"]


# =========================================================
# 2. ZONE SPLITTING HELPER
# =========================================================
def split_lung_into_segments(lung_mask_clean, disease_mask_full):
    """Split 2 lungs into 6 equal-area zones, return Coverage Ratios."""
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
# 3. LOAD PIPELINE CONFIG
# =========================================================
def load_pipeline_config(pipeline_json_path, model_name, subset="All"):
    """Load precomputed threshold + SRI + Zone Profile from Threshold_pipeline.json."""
    if not os.path.exists(pipeline_json_path):
        print(f"[WARN] pipeline.json not found: {pipeline_json_path} -- using fallback.")
        return None

    with open(pipeline_json_path, 'r', encoding='utf-8') as f:
        registry = json.load(f)

    if model_name not in registry:
        print(f"[WARN] Model '{model_name}' not in pipeline.json -- fallback.")
        return None

    entry = registry[model_name]
    if subset in entry:
        print(f"[INFO] Config loaded: model={model_name}, subset={subset}")
        return entry[subset]
    elif "All" in entry:
        print(f"[INFO] Subset '{subset}' missing -- fallback to 'All'.")
        return entry["All"]
    return None


# =========================================================
# 4. SHARED VISUALIZATION HELPERS
# =========================================================
def build_segmentation_panel(original_image, lung_mask_full, full_disease_mask,
                              draw_info, threshold):
    """Build BGR overlay: disease=red, lung contour=cyan, zone lines=white."""
    h_orig  = original_image.shape[0]
    res     = original_image.copy()
    overlay = original_image.copy()
    overlay[full_disease_mask > 0] = [0, 0, 255]
    cv2.addWeighted(overlay, 0.60, res, 0.40, 0, res)

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


def plot_zone_comparison(ax, ratios, zone_mean_ref, zone_std_ref, threshold, subset):
    """[CONTRIBUTION C] Bar chart: patient ratios vs population zone_mean +/- zone_std."""
    x, width = np.arange(6), 0.38

    colors = ['#d62728' if r >= threshold else '#1f77b4' for r in ratios]
    ax.bar(x - width / 2, ratios, width, color=colors, alpha=0.85,
           edgecolor='black', linewidth=0.7, label='This Patient')

    if zone_mean_ref is not None:
        z_mean = np.array(zone_mean_ref)
        z_std  = np.array(zone_std_ref) if zone_std_ref is not None else np.zeros(6)
        ax.bar(x + width / 2, z_mean, width, yerr=z_std, capsize=4,
               color='#aec7e8', alpha=0.70, edgecolor='steelblue', linewidth=0.7,
               error_kw={'elinewidth': 1.2, 'ecolor': 'navy'},
               label=f'Population ({subset})')

    ax.axhline(y=threshold, color='red', linestyle='--', linewidth=1.5,
               label=f'Threshold = {threshold:.2f}')
    ax.set_xticks(x)
    ax.set_xticklabels(ZONE_LABELS, fontsize=9)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel('Coverage Ratio', fontsize=10)
    ax.set_title('Zone Risk Profile\n(Patient vs Population)',
                 fontsize=11, fontweight='bold')
    ax.legend(fontsize=8, loc='upper right')


def _sri_label_color(sri):
    """Return (label_str, hex_color) for a given SRI value."""
    if sri >= 0.70:
        return "HIGH", "#2ca02c"
    elif sri >= 0.40:
        return "MEDIUM", "#ff7f0e"
    else:
        return "LOW", "#d62728"


def _sri_note(sri):
    """Return short clinical note for SRI tier."""
    if sri >= 0.70:
        return "Zones far from boundary -- score is stable"
    elif sri >= 0.40:
        return "Moderate distance from boundary -- use with care"
    else:
        return "Zones near boundary -- score may be fragile"


def _draw_infobox(ax, ratios, total_score, threshold, sri, best_mae, subset, model_name):
    """
    Overlay a HORIZONTAL two-column info box onto ax.
      Left  column : Model / Subset / Threshold / Val MAE / Score / SRI / SRI Note
      Right column : Region Ratios (6 zones)
    """
    sri_label, _ = _sri_label_color(sri)
    note_str      = _sri_note(sri)
    score_color   = 'red' if total_score >= 4 else ('orange' if total_score >= 2 else 'green')
    mae_str       = f"{best_mae:.4f}" if best_mae is not None else "N/A"

    left_lines = [
        f"Model     : {model_name}",
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
            fontsize=8.5, fontfamily='monospace',
            verticalalignment='top', bbox=box_style)

    ax.text(0.52, 0.97, "\n".join(right_lines),
            transform=ax.transAxes, color='white',
            fontsize=8.5, fontfamily='monospace',
            verticalalignment='top', bbox=box_style)

    ax.set_title(f"Severity Score: {total_score}/6  |  Model: {model_name}",
                 fontsize=12, fontweight='bold', color=score_color)


# =========================================================
# 5. THREE VISUALIZATION MODES
# =========================================================

def _mode1(original_image, lung_mask_full, full_disease_mask,
           draw_info, total_score, threshold, model_name, save_path):
    """
    Mode 1 - Simple
    Left : Original X-Ray
    Right: Segmentation overlay, Severity Score as title only
    """
    score_color = 'red' if total_score >= 4 else ('orange' if total_score >= 2 else 'green')
    res_viz = build_segmentation_panel(
        original_image, lung_mask_full, full_disease_mask, draw_info, threshold)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

    ax1.imshow(cv2.cvtColor(original_image, cv2.COLOR_BGR2RGB))
    ax1.set_title("Original X-Ray", fontsize=13)
    ax1.axis("off")

    ax2.imshow(cv2.cvtColor(res_viz, cv2.COLOR_BGR2RGB))
    ax2.set_title(f"Severity Score: {total_score}/6  |  Model: {model_name}",
                  fontsize=13, fontweight='bold', color=score_color)
    ax2.axis("off")

    plt.tight_layout()
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"[INFO] Saved to: {save_path}")
    plt.show()
    plt.close()


def _mode2(original_image, lung_mask_full, full_disease_mask,
           draw_info, ratios, total_score, threshold,
           sri, best_mae, model_name, subset, save_path):
    """
    Mode 2 - SRI
    Left : Original X-Ray
    Right: Segmentation + zone lines + horizontal SRI info box
    """
    sri_label, sri_color = _sri_label_color(sri)
    res_viz = build_segmentation_panel(
        original_image, lung_mask_full, full_disease_mask, draw_info, threshold)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    ax1.imshow(cv2.cvtColor(original_image, cv2.COLOR_BGR2RGB))
    ax1.set_title("Original X-Ray", fontsize=13)
    ax1.axis("off")

    ax2.imshow(cv2.cvtColor(res_viz, cv2.COLOR_BGR2RGB))
    _draw_infobox(ax2, ratios, total_score, threshold, sri, best_mae, subset, model_name)
    ax2.axis("off")

    fig.suptitle(
        f"CXR Severity Pipeline  |  SRI = {sri:.4f}  [{sri_label}]",
        fontsize=13, fontweight='bold', color=sri_color)
    plt.tight_layout()
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"[INFO] Saved to: {save_path}")
    plt.show()
    plt.close()


def _mode3(original_image, lung_mask_full, full_disease_mask,
           draw_info, ratios, total_score, threshold,
           sri, best_mae, model_name, subset,
           zone_mean_ref, zone_std_ref, save_path):
    """
    Mode 3 - Zone Profiler
    Left : Segmentation + zone lines + horizontal SRI info box
    Right: Zone Risk Profile bar chart (patient vs population)
    """
    sri_label, sri_color = _sri_label_color(sri)
    res_viz = build_segmentation_panel(
        original_image, lung_mask_full, full_disease_mask, draw_info, threshold)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    ax1.imshow(cv2.cvtColor(res_viz, cv2.COLOR_BGR2RGB))
    _draw_infobox(ax1, ratios, total_score, threshold, sri, best_mae, subset, model_name)
    ax1.axis("off")

    plot_zone_comparison(ax2, ratios, zone_mean_ref, zone_std_ref, threshold, subset)

    fig.suptitle(
        f"CXR Severity Pipeline  |  SRI = {sri:.4f}  [{sri_label}]",
        fontsize=13, fontweight='bold', color=sri_color)
    plt.tight_layout()
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"[INFO] Saved to: {save_path}")
    plt.show()
    plt.close()


# =========================================================
# 6. DISPATCHER
# =========================================================
def visualize_results(original_image, lung_mask_full, full_disease_mask,
                      draw_info, ratios, total_score, threshold,
                      sri, pipeline_config, model_name, subset,
                      mode=2, save_path=None):
    """
    Dispatch to the correct visualization mode.

    mode 1 - Simple       : Original | Severity Score overlay
    mode 2 - SRI          : Original | Segmentation + horizontal SRI info box
    mode 3 - Zone Profiler: Segmentation + SRI info box | Zone Risk Profile chart
    """
    best_mae      = pipeline_config.get('best_mae')  if pipeline_config else None
    zone_mean_ref = pipeline_config.get('zone_mean') if pipeline_config else None
    zone_std_ref  = pipeline_config.get('zone_std')  if pipeline_config else None

    if mode == 1:
        _mode1(original_image, lung_mask_full, full_disease_mask,
               draw_info, total_score, threshold, model_name, save_path)
    elif mode == 2:
        _mode2(original_image, lung_mask_full, full_disease_mask,
               draw_info, ratios, total_score, threshold,
               sri, best_mae, model_name, subset, save_path)
    elif mode == 3:
        _mode3(original_image, lung_mask_full, full_disease_mask,
               draw_info, ratios, total_score, threshold,
               sri, best_mae, model_name, subset,
               zone_mean_ref, zone_std_ref, save_path)
    else:
        print(f"[WARN] Unknown mode {mode} -- defaulting to mode 2.")
        _mode2(original_image, lung_mask_full, full_disease_mask,
               draw_info, ratios, total_score, threshold,
               sri, best_mae, model_name, subset, save_path)


# =========================================================
# 7. MAIN PIPELINE
# =========================================================
def main(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    default_json  = os.path.join(project_root, "resources", "Threshold_pipeline.json")
    pipeline_json = args.pipeline_json if args.pipeline_json else default_json

    print(f"[*] Inference | Model: {args.model_name} | Subset: {args.subset} | Mode: {args.mode}")

    pipeline_config = load_pipeline_config(pipeline_json, args.model_name, args.subset)

    if pipeline_config:
        threshold = pipeline_config['optimal_threshold']
        pop_sri   = pipeline_config.get('sri_mean', 'N/A')
        pop_std   = pipeline_config.get('sri_std',  'N/A')
        print(f"[INFO] Threshold : {threshold}")
        print(f"[INFO] Pop. SRI  : {pop_sri} +/- {pop_std}")
    else:
        threshold = args.threshold
        print(f"[INFO] Fallback threshold: {threshold}")

    if not os.path.exists(args.image_path):
        print(f"[ERROR] Image not found: {args.image_path}")
        return

    original_image = cv2.imread(args.image_path)
    h_orig, w_orig = original_image.shape[:2]

    try:
        model_s1, conf_s1 = load_model_by_stage(1, args.lung_helper, device, project_root)
        model_s2, conf_s2 = load_model_by_stage(2, args.model_name,  device, project_root)
    except Exception as e:
        print(f"[ERROR] Model load failed: {e}")
        return

    roi_img, bbox, lung_mask_full = get_lung_roi(original_image, model_s1, conf_s1, device)
    if roi_img is None:
        print("[ERROR] Lung not detected.")
        return

    s2_size          = tuple(conf_s2.get('input_size', [512, 512]))
    tensor_roi       = preprocess_single_image(roi_img, target_size=s2_size).to(device)
    roi_disease_mask = predict_mask(
        model_s2, tensor_roi,
        original_size=(bbox[3] - bbox[2] + 1, bbox[1] - bbox[0] + 1))

    full_disease_mask = map_mask_to_original(roi_disease_mask, bbox, (h_orig, w_orig))
    ratios, draw_info = split_lung_into_segments(lung_mask_full, full_disease_mask)
    total_score       = sum(1 for r in ratios if r >= threshold)

    # [CONTRIBUTION B] SRI
    sri              = compute_sri(ratios, threshold)
    sri_label, _     = _sri_label_color(sri)
    sri_note_str     = _sri_note(sri)

    print(f"\n[RESULT] Severity Score : {total_score}/6")
    print(f"[RESULT] Region Ratios  : {[f'{r*100:.1f}%' for r in ratios]}")
    print(f"[RESULT] Threshold      : {threshold:.2f}")
    print(f"[RESULT] SRI            : {sri:.4f}  [{sri_label}]")
    print(f"[RESULT] SRI Note       : {sri_note_str}")

    if pipeline_config:
        pop_sri = pipeline_config.get('sri_mean')
        pop_std = pipeline_config.get('sri_std')
        if pop_sri is not None:
            dev = sri - pop_sri
            print(f"[RESULT] Pop. SRI       : {pop_sri:.4f} +/- {pop_std:.4f}")
            print(f"[RESULT] Patient vs Pop.: {dev:+.4f} "
                  f"({'above' if dev >= 0 else 'below'} population mean)")

    visualize_results(
        original_image=original_image,
        lung_mask_full=lung_mask_full,
        full_disease_mask=full_disease_mask,
        draw_info=draw_info,
        ratios=ratios,
        total_score=total_score,
        threshold=threshold,
        sri=sri,
        pipeline_config=pipeline_config,
        model_name=args.model_name,
        subset=args.subset,
        mode=args.mode,
        save_path=args.save_path,
    )


# =========================================================
# 8. CLI
# =========================================================
if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Single-Model Severity Scoring + SRI + Zone Profile")
    parser.add_argument('--image_path',    type=str,   required=True)
    parser.add_argument('--model_name',    type=str,   required=True)
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
