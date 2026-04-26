# tools/models.py
import os
import json
import torch
import segmentation_models_pytorch as smp
import cv2
import numpy as np

def build_model(arch, encoder='resnet34', in_channels=3, classes=1, activation='sigmoid'):
    """
    Khởi tạo mô hình dựa trên tên kiến trúc và encoder.
    """
    architectures = {
        'unet': smp.Unet, 
        'unet++': smp.UnetPlusPlus, 
        'unetplusplus': smp.UnetPlusPlus,
        'deeplabv3': smp.DeepLabV3, 
        'deeplabv3plus': smp.DeepLabV3Plus, 
        'deeplabv3+': smp.DeepLabV3Plus,
        'fpn': smp.FPN, 
        'pan': smp.PAN, 
        'linknet': smp.Linknet,
        'pspnet': smp.PSPNet, 
        'manet': smp.MAnet
    }
    
    arch_key = arch.lower().replace(" ", "")
    if arch_key not in architectures:
        raise ValueError(f"Architecture '{arch}' is not supported. Please check the spelling.")

    model = architectures[arch_key](
        encoder_name=encoder,
        encoder_weights=None,
        in_channels=in_channels,
        classes=classes,
        activation=activation
    )
    return model

def load_model_weights(model, weights_path, device):
    """
    Load trọng số đã train vào mô hình và chuyển mô hình sang thiết bị (CPU/GPU).
    """
    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Weights file not found at path: {weights_path}")
        
    model.load_state_dict(torch.load(weights_path, map_location=device), strict=False)
    model.to(device).eval()
    return model

def load_model_by_stage(stage, model_name, device, project_root):
    """
    Tìm và load model dựa trên Stage (1 hoặc 2) và model_name.
    Tự động đọc thông số kiến trúc từ config.json.
    
    Args:
        stage (int): 1 cho Lung Segmentation, 2 cho Disease Segmentation.
        model_name (str): Tên thư mục chứa model (vd: 'DeepLabV3plus').
        device (torch.device): Thiết bị chạy model (cpu/cuda).
        project_root (str): Đường dẫn gốc của project.
        
    Returns:
        tuple: (model, config_dict)
    """
    stage_dir = "models_lungs" if stage == 1 else "models_covids"
    model_dir = os.path.join(project_root, "models", stage_dir, model_name)
    config_path = os.path.join(model_dir, f"{model_name}_config.json")
    weights_path = os.path.join(model_dir, "weights.pth")
    
    if not os.path.exists(config_path) or not os.path.exists(weights_path):
        raise FileNotFoundError(f"[ERROR] Thiếu file config hoặc weights tại: {model_dir}")
        
    with open(config_path, 'r') as f:
        config = json.load(f)["parameters"]
        
    model = build_model(
        arch=config['model_name'],
        encoder=config['encoder_name'],
        in_channels=config.get('input_channels', 3),
        classes=config.get('num_classes', 1),
        activation=config.get('activation', 'sigmoid')
    )
    
    model = load_model_weights(model, weights_path, device)
    
    return model, config

def predict_mask(model, tensor_img, original_size):
    """
    Chạy tensor qua model và trả về mask nhị phân đã được resize về kích thước gốc.
    """
    with torch.no_grad():
        pred = model(tensor_img)
        # Nếu model trả về tuple (ví dụ có classification head phụ), lấy phần tử đầu tiên
        if isinstance(pred, tuple):
             pred = pred[0]
             
        # Chuẩn hóa về xác suất [0.0, 1.0] nếu output là Logits
        if pred.max() > 1.0 or pred.min() < 0.0:
            prob = torch.sigmoid(pred)
        else:
            prob = pred
            
        # Áp dụng ngưỡng 0.5 để tạo mask nhị phân (True/False), sau đó ép kiểu thành 0 và 1
        mask = (prob > 0.5).squeeze().cpu().numpy().astype(np.uint8)
        
    # Resize mask ngược trở lại kích thước thật của ảnh (w, h)
    # Dùng cv2.INTER_NEAREST để đảm bảo giá trị pixel không bị nội suy thành số thập phân
    mask_resized = cv2.resize(mask, original_size, interpolation=cv2.INTER_NEAREST)
    
    return mask_resized