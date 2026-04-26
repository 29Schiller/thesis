import os
import glob
import pandas as pd
import json

def build_threshold_config(csv_dir="resources/threshold_selection", output_json="resources/threshold_config.json"):
    threshold_config = {}

    subset_mapping = {
        'train': 'Training',
        'val': 'Validation',
        'test': 'Testing',
        'all': 'All'
    }

    standard_subsets = ["Training", "Validation", "Testing", "All"]

    for folder_name, subset_label in subset_mapping.items():
        folder_path = os.path.join(csv_dir, folder_name)
        if not os.path.exists(folder_path):
            continue

        csv_files = glob.glob(os.path.join(folder_path, "threshold_selection_*.csv"))
        
        for file_path in csv_files:
            filename = os.path.basename(file_path)
            parts = filename.replace(".csv", "").split('_')
            
            # Based on your report: threshold(0)_selection(1)_train(2)_DeepLabV3+(3)
            if len(parts) < 4:
                continue
            
            model_name = parts[3] 

            # Initialize if new model found
            if model_name not in threshold_config:
                threshold_config[model_name] = {s: 0 for s in standard_subsets}

            try:
                df = pd.read_csv(file_path)
                
                if 'MAE' in df.columns and 'Threshold' in df.columns:
                    # Find minimum MAE
                    best_row = df.loc[df['MAE'].idxmin()]
                    
                    # Use float to capture decimal thresholds (e.g. 0.5)
                    # Use .item() to ensure it's a native Python type for JSON serialization
                    best_thresh = best_row['Threshold']
                    
                    # Update the specific subset
                    threshold_config[model_name][subset_label] = float(best_thresh)
                    
            except Exception as e:
                print(f"[-] Error in {filename}: {e}")

    # Save the file
    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, 'w') as f:
        json.dump(threshold_config, f, indent=4)
    
    print(f"✅ Config generated for models: {list(threshold_config.keys())}")
    print(f"Saved to: {output_json}")

if __name__ == "__main__":
    build_threshold_config()