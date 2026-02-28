from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import rawpy
import os

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

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
