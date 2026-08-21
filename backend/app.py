import io
import base64
import time
import traceback
from typing import List
from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, ImageDraw, ImageFont
import torch
from transformers import DetrImageProcessor, DetrForObjectDetection
import gradio as gr
try:
    import spaces
    HAS_SPACES = True
except ImportError:
    HAS_SPACES = False

# 1. Initialize FastAPI
fastapi_app = FastAPI(title="VisionTracker API")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

device = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_NAME = "facebook/detr-resnet-50"

print(f"Loading DETR model '{MODEL_NAME}' on '{device}'...")
processor = DetrImageProcessor.from_pretrained(MODEL_NAME)
model = DetrForObjectDetection.from_pretrained(MODEL_NAME).to(device)
model.eval()
print(f"DETR model ready on {device}!")

COLORS = [
    "#FFCA54", "#4ADE80", "#60A5FA", "#F87171", "#A78BFA",
    "#FB923C", "#2DD4BF", "#F472B6", "#38BDF8", "#E879F9"
]

class BoundingBox(BaseModel):
    xmin: float
    ymin: float
    xmax: float
    ymax: float
    rel_xmin: float
    rel_ymin: float
    rel_xmax: float
    rel_ymax: float
    width: float
    height: float

class DetectionResult(BaseModel):
    label: str
    confidence: float
    box: BoundingBox
    color: str

class DetectionResponse(BaseModel):
    task: str = "detection"
    model_used: str = MODEL_NAME
    image_width: int
    image_height: int
    detected_count: int
    detections: List[DetectionResult]
    annotated_image_base64: str
    inference_time_ms: float

# Internal inference function
def run_model_inference(image, threshold):
    img_width, img_height = image.size
    inputs = processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = model(**inputs)

    target_sizes = torch.tensor([[img_height, img_width]]).to(device)
    return processor.post_process_object_detection(
        outputs, target_sizes=target_sizes, threshold=threshold
    )[0]

# Decorate with @spaces.GPU if running inside Hugging Face ZeroGPU Space
if HAS_SPACES:
    run_model_inference = spaces.GPU(run_model_inference)

@fastapi_app.get("/api/health")
def health_check():
    return {"status": "online", "device": device, "model": MODEL_NAME}

@fastapi_app.post("/api/detect", response_model=DetectionResponse)
async def detect_objects(
    file: UploadFile = File(...),
    threshold: float = Query(0.7, ge=0.0, le=1.0)
):
    start_time = time.time()
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode image: {str(e)}")

    img_width, img_height = image.size

    try:
        results = run_model_inference(image, threshold)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")

    detections: List[DetectionResult] = []
    annotated_image = image.copy()
    draw = ImageDraw.Draw(annotated_image)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None

    scores = results["scores"].tolist()
    labels = results["labels"].tolist()
    boxes = results["boxes"].tolist()

    for idx, (score, label_idx, box) in enumerate(zip(scores, labels, boxes)):
        xmin, ymin, xmax, ymax = [round(float(b), 2) for b in box]
        xmin = max(0.0, min(xmin, float(img_width)))
        ymin = max(0.0, min(ymin, float(img_height)))
        xmax = max(0.0, min(xmax, float(img_width)))
        ymax = max(0.0, min(ymax, float(img_height)))

        box_w = round(xmax - xmin, 2)
        box_h = round(ymax - ymin, 2)
        label_name = model.config.id2label.get(label_idx, f"class_{label_idx}")
        color = COLORS[idx % len(COLORS)]

        rel_xmin = round(xmin / img_width, 4) if img_width > 0 else 0.0
        rel_ymin = round(ymin / img_height, 4) if img_height > 0 else 0.0
        rel_xmax = round(xmax / img_width, 4) if img_width > 0 else 0.0
        rel_ymax = round(ymax / img_height, 4) if img_height > 0 else 0.0

        detections.append(
            DetectionResult(
                label=label_name,
                confidence=round(float(score), 4),
                box=BoundingBox(
                    xmin=xmin,
                    ymin=ymin,
                    xmax=xmax,
                    ymax=ymax,
                    rel_xmin=rel_xmin,
                    rel_ymin=rel_ymin,
                    rel_xmax=rel_xmax,
                    rel_ymax=rel_ymax,
                    width=box_w,
                    height=box_h
                ),
                color=color
            )
        )

        draw.rectangle([xmin, ymin, xmax, ymax], outline=color, width=3)
        text_str = f"{label_name} {int(score * 100)}%"
        try:
            text_bbox = draw.textbbox((xmin, ymin), text_str, font=font)
            text_w = text_bbox[2] - text_bbox[0] + 8
            text_h = text_bbox[3] - text_bbox[1] + 6
        except Exception:
            text_w = len(text_str) * 8 + 8
            text_h = 18

        text_bg_ymin = max(0.0, ymin - text_h)
        draw.rectangle([xmin, text_bg_ymin, xmin + text_w, text_bg_ymin + text_h], fill=color)
        draw.text((xmin + 4, text_bg_ymin + 2), text_str, fill="#17150E", font=font)

    buffered = io.BytesIO()
    annotated_image.save(buffered, format="JPEG", quality=90)
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    return DetectionResponse(
        task="detection",
        model_used=MODEL_NAME,
        image_width=img_width,
        image_height=img_height,
        detected_count=len(detections),
        detections=detections,
        annotated_image_base64=f"data:image/jpeg;base64,{img_b64}",
        inference_time_ms=round((time.time() - start_time) * 1000, 2)
    )

# 2. Gradio Interactive Interface
def gradio_detect(input_img, conf):
    if input_img is None:
        return None, "No image uploaded"
    pil_img = Image.fromarray(input_img)
    results = run_model_inference(pil_img, conf)
    
    annotated = pil_img.copy()
    draw = ImageDraw.Draw(annotated)
    found = []
    for score, label_idx, box in zip(results["scores"].tolist(), results["labels"].tolist(), results["boxes"].tolist()):
        xmin, ymin, xmax, ymax = [round(float(b), 2) for b in box]
        lbl = model.config.id2label.get(label_idx, f"class_{label_idx}")
        draw.rectangle([xmin, ymin, xmax, ymax], outline="#FFCA54", width=3)
        draw.text((xmin + 4, max(0, ymin - 16)), f"{lbl} {int(score*100)}%", fill="#FFCA54")
        found.append(f"{lbl} ({int(score*100)}%)")
    return annotated, f"Found {len(found)} objects: {', '.join(found)}"

with gr.Blocks(title="VisionTracker AI API") as demo:
    gr.Markdown("# 🎯 VisionTracker API Endpoint")
    gr.Markdown("FastAPI endpoint `/api/detect` is actively listening for requests from your Vercel frontend.")
    with gr.Row():
        img_in = gr.Image(label="Test Input Image")
        img_out = gr.Image(label="Detection Output")
    slider = gr.Slider(0.1, 0.95, value=0.7, label="Confidence Threshold")
    txt_out = gr.Textbox(label="Detection Summary")
    btn = gr.Button("Run Test")
    btn.click(gradio_detect, inputs=[img_in, slider], outputs=[img_out, txt_out])

app = gr.mount_gradio_app(fastapi_app, demo, path="/")
