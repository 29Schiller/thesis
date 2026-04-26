# Hướng dẫn Deploy Toàn diện (Frontend + Backend)

## ⚠️ TRỌNG TÂM QUAN TRỌNG VỀ VERCEL VÀ PYTHON (AI MODELS)
Vercel là một nền tảng tuyệt vời để deploy Frontend (React/Vite). Nó cũng hỗ trợ chạy Python qua Serverless Functions. **TUY NHIÊN**, Vercel Serverless Functions có giới hạn kích thước deployment package tối đa là **250MB** (kể cả bản Pro).

Backend của bạn đang sử dụng **PyTorch (`torch`)** và **OpenCV**. Chỉ riêng PyTorch khi cài đặt cũng đã chiếm hơn **2GB**, vượt quá giới hạn của Vercel rất rất nhiều. Nâng cấp hay thay đổi setting của Vercel đều không thể giải quyết được.
👉 **Kết luận:** Bạn **KHÔNG THỂ** deploy backend FastAPI chứa PyTorch + AI Models trực tiếp lên Vercel Serverless Functions.

## 🌟 KIẾN TRÚC RECOMMENDED CHO PROJECT NÀY
1. **Frontend (React/Vite):** Deploy trên **Vercel** (Miễn phí, nhanh, hỗ trợ CI/CD cực kỳ tốt).
2. **Backend (FastAPI + AI Models):** Deploy trên các nền tảng chạy **Docker Container**, ví dụ: **Google Cloud Run**, **Render**, hoặc **Hugging Face Spaces**, hoặc một con VPS tự thuê.

Dưới đây là hướng dẫn cụ thể theo mô hình này.

---

## PHẦN 1: DEPLOY BACKEND (FastAPI + AI Models)

Chúng tôi đã chuẩn bị sẵn file `Dockerfile` trong thư mục `python_backend/`. Đây là chìa khóa để chạy nó ở bất kỳ đâu.

### Phương án 1: Dùng Render.com (Có bản Free)
1. Đẩy (Push) toàn bộ code của bạn lên một repository trên GitHub.
2. Tạo tài khoản và đăng nhập vào [Render.com](https://render.com).
3. Ấn **"New" -> "Web Service"**.
4. Kết nối với GitHub và chọn Repository của bạn.
5. Cấu hình Web Service:
   - **Root Directory:** `python_backend`
   - **Environment:** `Docker` (Render sẽ tự động đọc `Dockerfile` trong thư mục này)
   - Chọn gói (Free hoặc Paid). 
   *Lưu ý:* Gói Free của Render chỉ có 512MB RAM, đôi khi khi load PyTorch vào sẽ bị out-of-memory. Khuyên dùng gói có ít nhất 2GB - 4GB RAM cho xử lý AI ảnh.
6. Ấn **"Create Web Service"**.
7. Chờ hệ thống build image và chạy. Sau khi thành công, Render sẽ cung cấp URL (vd: `https://my-backend.onrender.com`). Lưu URL này lại.

### Phương án 2: Google Cloud Run (Khuyên Dùng, Ổn định và Dùng Docker Native)
1. Cài đặt Google Cloud SDK (`gcloud` CLI) lên máy vi tính.
2. Mở terminal tại thư mục `python_backend`.
3. Gửi mã nguồn lên Google Cloud Build:
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/cxr-backend
   ```
4. Triển khai lên Cloud Run (cấp 4GB RAM cho Model AI):
   ```bash
   gcloud run deploy cxr-backend --image gcr.io/PROJECT_ID/cxr-backend --platform managed --memory 4Gi --allow-unauthenticated
   ```
5. Nhận và lưu lại Backend API URL trả về.

---

## PHẦN 2: DEPLOY FRONTEND LÊN VERCEL

Trước khi deploy frontend trên Vercel, bạn phải nói cho React app biết địa chỉ Backend thực tế (URL vừa lấy ở Phần 1).

### Bước 1: Cấu hình biến môi trường gọi API
Đừng gọi trực tiếp về `localhost` trong code. Hãy quản lý qua `.env`.

Tạo hoặc chỉnh sửa nội dung để Frontend gọi API sử dụng `import.meta.env.VITE_API_URL`. Ví dụ:

```typescript
// Trong file service (VD: src/services/api.ts)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function uploadImageToAI(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        body: formData
    });
    return response.json();
}
```

### Bước 2: Push frontend code lên GitHub
Push code nằm trong thư mục gốc (hoặc thư mục chứa folder react app, file `package.json`, `vite.config.ts`,...) lên GitHub.

### Bước 3: Đưa lên Vercel
1. Đăng nhập [Vercel.com](https://vercel.com) với tài khoản GitHub của bạn.
2. Ấn **"Add New Project"**.
3. Chọn Repository chứa Frontend vừa push.
4. Ở màn hình cấu hình ("Configure Project"):
   - **Framework Preset:** Vercel thường tự nhận diện là **Vite**.
   - **Environment Variables:** Mở mục này ra và gõ:
     - Name: `VITE_API_URL`
     - Value: `https://url-backend-tu-phan-1-cua-ban.com`
5. Ấn **"Deploy"**.

### Bước 4: Xử lý Routing trên Vercel (Nếu bạn có dùng React Router dom)
Vì React là Single Page Application, nếu F5 trang có thể bị lỗi 404. Bạn nên tạo thêm file định tuyến cho Vercel.

Tạo file `vercel.json` ở vị trí ngang hàng với `package.json`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
Và commit push một lần nữa. Mọi thứ sẽ hoàn hảo.

---
**Tóm tắt luồng hoạt động sau khi deploy:**
User vào qua link Vercel -> Bấm tải ảnh X-ray lên -> React Frontend gửi file về link: `https://my-backend.onrender.com/api/analyze` -> Backend Docker nhận ảnh, chạy thông qua PyTorch Models -> Trả về kết quả JSON -> Vercel hiển thị lên giao diện 🤩.
