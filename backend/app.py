import gradio as gr
from PIL import Image, ImageDraw
import torch
from transformers import DetrImageProcessor, DetrForObjectDetection
import spaces

MODEL_NAME = "facebook/detr-resnet-50"
processor = DetrImageProcessor.from_pretrained(MODEL_NAME)
model = DetrForObjectDetection.from_pretrained(MODEL_NAME)

COLORS = [
    "#FFCA54", "#4ADE80", "#60A5FA", "#F87171", "#A78BFA",
    "#FB923C", "#2DD4BF", "#F472B6", "#38BDF8", "#E879F9"
]

@spaces.GPU
def predict_objects(image: Image.Image, threshold: float):
    if image is None:
        return None, "Please upload an image.", {}
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    mdl = model.to(device)
    
    img_width, img_height = image.size
    inputs = processor(images=image, return_tensors="pt").to(device)
    
    with torch.no_grad():
        outputs = mdl(**inputs)

    target_sizes = torch.tensor([[img_height, img_width]]).to(device)
    results = processor.post_process_object_detection(
        outputs, target_sizes=target_sizes, threshold=threshold
    )[0]

    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)
    detections_list = []
    
    scores = results["scores"].tolist()
    labels = results["labels"].tolist()
    boxes = results["boxes"].tolist()

    for idx, (score, label_idx, box) in enumerate(zip(scores, labels, boxes)):
        xmin, ymin, xmax, ymax = [round(float(b), 2) for b in box]
        label_name = mdl.config.id2label.get(label_idx, f"class_{label_idx}")
        color = COLORS[idx % len(COLORS)]

        draw.rectangle([xmin, ymin, xmax, ymax], outline=color, width=3)
        text_str = f"{label_name} {int(score * 100)}%"
        draw.text((xmin + 4, max(0, ymin - 16)), text_str, fill=color)

        detections_list.append({
            "label": label_name,
            "confidence": round(float(score), 4),
            "box": [xmin, ymin, xmax, ymax]
        })

    summary = f"Detected {len(detections_list)} object(s): " + ", ".join([f"{d['label']} ({int(d['confidence']*100)}%)" for d in detections_list])
    
    return annotated, summary, {"count": len(detections_list), "detections": detections_list}

demo = gr.Interface(
    fn=predict_objects,
    inputs=[
        gr.Image(type="pil", label="Input Image"),
        gr.Slider(minimum=0.1, maximum=0.95, value=0.7, step=0.05, label="Confidence Threshold")
    ],
    outputs=[
        gr.Image(type="pil", label="Detections Visualizer"),
        gr.Textbox(label="Detection Summary"),
        gr.JSON(label="Raw JSON (API format)")
    ],
    title="VisionTracker - DETR Object Detection API",
    description="Live Hugging Face Space running facebook/detr-resnet-50 on Free ZeroGPU with Gradio Client API.",
    api_name="detect"
)

if __name__ == "__main__":
    demo.launch()
