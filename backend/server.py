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

@app.get("/health")
def health():
    return {"status": "ok"}

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

@app.post("/convert_image")
def convert_image(image_path: ImagePath):
    if not os.path.exists(image_path.path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        with rawpy.imread(image_path.path) as raw:
            # Postprocess to get 16-bit linear RGB image
            rgb_linear = raw.postprocess(gamma=(1,1), no_auto_bright=True, output_bps=16)
            
            # Convert to float [0, 1]
            img_array = rgb_linear.astype(np.float32) / 65535.0
            
            # Apply conversion math
            positive_img = convert_negative_to_positive(img_array)
            
            # Convert back to 8-bit [0, 255] for JPEG encoding
            positive_img_8bit = (positive_img * 255.0).astype(np.uint8)
            
            # OpenCV uses BGR, so convert RGB to BGR before encoding
            bgr_img = cv2.cvtColor(positive_img_8bit, cv2.COLOR_RGB2BGR)
            
            # Encode as JPEG
            success, encoded_image = cv2.imencode(".jpg", bgr_img)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to encode image")
                
            return Response(content=encoded_image.tobytes(), media_type="image/jpeg")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
