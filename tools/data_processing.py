import cv2
import torch
from torchvision import transforms

def preprocess_single_image(image_bgr, target_size=(512, 512)):
    """
    Tiền xử lý 1 ảnh BGR: chuyển sang RGB, resize, chuyển thành Tensor và Normalize.
    Trả về Tensor có shape [1, C, H, W] sẵn sàng để đưa vào mô hình.
    """
    # Chuyển đổi màu từ BGR (OpenCV mặc định) sang RGB
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    
    # Resize ảnh về kích thước mong muốn cho mô hình
    image_resized = cv2.resize(image_rgb, target_size)
    
    # Pipeline biến đổi ảnh thành Tensor và chuẩn hóa theo chuẩn ImageNet
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    # Thêm batch dimension (unsqueeze(0))
    tensor_image = transform(image_resized).unsqueeze(0)
    
    return tensor_image