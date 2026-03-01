from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn
import rawpy
import os
import cv2
import numpy as np
from converter import convert_negative_to_positive

app = FastAPI()

class ImagePath(BaseModel):
    path: str

class ConvertRequest(BaseModel):
    path: str
    exposure: float = 0.0
    base_color: list[float] | None = None

class SampleRequest(BaseModel):
    path: str
    x: float  # Normalized coordinates 0.0 - 1.0
    y: float

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/sample_color")
def sample_color(request: SampleRequest):
    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        with rawpy.imread(request.path) as raw:
            # Postprocess to get 16-bit linear RGB image
            rgb_linear = raw.postprocess(gamma=(1,1), no_auto_bright=True, output_bps=16)
            
            h, w = rgb_linear.shape[:2]
            
            # Map normalized coords to pixel coords
            px = int(request.x * w)
            py = int(request.y * h)
            
            # Ensure within bounds
            px = max(0, min(w - 1, px))
            py = max(0, min(h - 1, py))
            
            # Sample a 5x5 region around the point for average color
            region_size = 5
            half_size = region_size // 2
            
            y_start = max(0, py - half_size)
            y_end = min(h, py + half_size + 1)
            x_start = max(0, px - half_size)
            x_end = min(w, px + half_size + 1)
            
            region = rgb_linear[y_start:y_end, x_start:x_end]
            avg_color = np.mean(region, axis=(0, 1))
            
            # Convert to float [0, 1]
            color_normalized = avg_color / 65535.0
            
            return {"color": color_normalized.tolist()}
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/load_image")
def load_image(image_path: ImagePath):
    if not os.path.exists(image_path.path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        with rawpy.imread(image_path.path) as raw:
            return {
                "width": raw.sizes.width,
                "height": raw.sizes.height,
                "camera_white_balance": raw.camera_white_balance.tolist()
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

import base64

@app.post("/convert_image")
def convert_image(request: ConvertRequest):
    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        with rawpy.imread(request.path) as raw:
            # Postprocess to get 16-bit linear RGB image
            rgb_linear = raw.postprocess(gamma=(1,1), no_auto_bright=True, output_bps=16)
            
            # Convert to float [0, 1]
            img_array = rgb_linear.astype(np.float32) / 65535.0
            
            # Apply conversion math
            base_color_tuple = tuple(request.base_color) if request.base_color else None
            positive_img = convert_negative_to_positive(img_array, base_color=base_color_tuple, exposure=request.exposure)
            
            # Convert back to 8-bit [0, 255] for JPEG encoding and histogram
            positive_img_8bit = (positive_img * 255.0).astype(np.uint8)
            
            # Calculate Histogram (on RGB channels)
            hist = []
            for i in range(3):
                hist_channel = cv2.calcHist([positive_img_8bit], [i], None, [256], [0, 256])
                hist.append([int(v[0]) for v in hist_channel])
                
            # OpenCV uses BGR, so convert RGB to BGR before encoding
            bgr_img = cv2.cvtColor(positive_img_8bit, cv2.COLOR_RGB2BGR)
            
            # Encode as JPEG
            success, encoded_image = cv2.imencode(".jpg", bgr_img)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to encode image")
                
            # Return JSON with base64 image and histogram
            img_b64 = base64.b64encode(encoded_image.tobytes()).decode('utf-8')
            return {
                "image": f"data:image/jpeg;base64,{img_b64}",
                "histogram": hist
            }
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
