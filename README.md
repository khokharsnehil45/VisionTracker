# 🎯 VisionTracker

> **Minimalist, High-Performance Object Detection AI Studio powered by Hugging Face DEtection TRansformer (`facebook/detr-resnet-50`) and PyTorch.**

![VisionTracker Demo](https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80)

---

## ✨ Features

- **⚡ End-to-End Object Detection (DETR)**:
  - Powered by Hugging Face `facebook/detr-resnet-50` with end-to-end transformer attention queries.
  - Automatically predicts 80 COCO object classes, bounding boxes, and confidence scores.
- **🎨 Munder Difflin Design System**:
  - Minimalist aesthetic inspired by [munderdiffl.in](https://munderdiffl.in/).
  - Space Grotesk, Inter, and JetBrains Mono typography with warm gold accent tokens and custom dark/light modes.
- **🔍 Interactive Bounding Box Inspector**:
  - Click any detected card to highlight and pulse its precise bounding box on the visualizer canvas.
  - View exact pixel coordinates (`xmin`, `ymin`, `width`, `height`) and normalized percentages.
- **📦 Multi-Format Machine Learning Export**:
  - **🎯 YOLO Format (`.txt`)**: Normalized coordinates ready for training YOLOv8/v11/Ultralytics models.
  - **📦 COCO JSON (`.json`)**: Industry-standard dataset schema with image, category, and area metadata.
  - **📊 CSV Spreadsheet (`.csv`)**: Tabular export for data analysis.
  - **🖼️ Export Annotated Image**: 1-click download of the visualizer image with rendered boxes and tags.
- **🗂️ Floating Detection History**:
  - Floating left sidebar with thumbnails, timestamps, detected object counts, and 1-click preview restoration.
- **🚀 GPU Accelerated & CPU Resilient**:
  - Runs with automatic CUDA GPU acceleration and CPU fallback.

---

## 🛠️ Tech Stack

### Frontend
- **React 19** with **Vite 6**
- **Tailwind CSS v4** + `@tailwindcss/vite`
- **Lucide React** icons

### Backend
- **FastAPI** & **Uvicorn**
- **PyTorch** (`torch`, `torchvision`)
- **Hugging Face Transformers** (`DetrForObjectDetection`, `DetrImageProcessor`)
- **Pillow** (`PIL`)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18+ recommended)
- **Python 3.9+** (with CUDA GPU drivers optional)

### 1. Clone the Repository
```bash
git clone https://github.com/khokharsnehil45/VisionTracker.git
cd VisionTracker
```

### 2. Setup Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```
*Backend runs on `http://localhost:8080`.*

### 3. Setup Frontend
```bash
cd ../frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## ⚡ 1-Click Launch Script

You can start both backend and frontend concurrently with the included launcher:

```bash
chmod +x start.sh
./start.sh
```

---

## 📡 API Reference

### `POST /api/detect`
Run DETR object detection on an image.

- **Query Parameters**:
  - `threshold` (float, default: `0.7`): Confidence cutoff threshold between `0.0` and `1.0`.
- **Form Data**:
  - `file`: Image file (PNG, JPG, WebP).
- **Response**:
```json
{
  "task": "detection",
  "model_used": "facebook/detr-resnet-50",
  "image_width": 1280,
  "image_height": 720,
  "detected_count": 3,
  "detections": [
    {
      "label": "person",
      "confidence": 0.9842,
      "box": {
        "xmin": 120.5,
        "ymin": 80.0,
        "xmax": 450.2,
        "ymax": 680.4,
        "rel_xmin": 0.0941,
        "rel_ymin": 0.1111,
        "rel_xmax": 0.3517,
        "rel_ymax": 0.9450,
        "width": 329.7,
        "height": 600.4
      },
      "color": "#FFCA54"
    }
  ],
  "annotated_image_base64": "data:image/jpeg;base64,...",
  "inference_time_ms": 48.2
}
```

---

## 📄 License
MIT License. Built with ❤️ using Hugging Face Transformers.
