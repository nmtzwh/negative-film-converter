import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import rawpy
import os
import cv2
import numpy as np
from converter import convert_negative_to_positive
from curve_fitting import fit_roll_curve, log_func, apply_curve
from user_curves import apply_curves

app = FastAPI()
executor = ThreadPoolExecutor(max_workers=4)

# Add CORS middleware to allow the Tauri frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production if necessary
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImagePath(BaseModel):
    path: str

class ConvertRequest(BaseModel):
    path: str
    exposure: float = 0.0
    base_color: list[float] | None = None
    user_curves: dict | None = None

class SampleRequest(BaseModel):
    path: str
    x: float  # Normalized coordinates 0.0 - 1.0
    y: float

class SettingsRequest(BaseModel):
    path: str
    exposure: float = 0.0
    base_color: list[float] | None = None
    base_color_samples: list[dict] | None = None
    crop: list[float] | None = None
    user_curves: dict | None = None

class ExportRequest(BaseModel):
    path: str
    output_dir: str
    exposure: float = 0.0
    base_color: list[float] | None = None
    crop: list[float] | None = None
    user_curves: dict | None = None

class RollProfileRequest(BaseModel):
    dir_path: str
    anchors: list[list[float]] # List of [R, G, B]

class DirectoryRequest(BaseModel):
    path: str

@app.get("/health")
async def health():
    return {"status": "ok"}

import json

def is_raw(path: str) -> bool:
    return not path.lower().endswith(('.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp'))

def get_rgb_float(path: str) -> np.ndarray:
    if is_raw(path):
        with rawpy.imread(path) as raw:
            # Postprocess to get 16-bit linear RGB image
            rgb_linear = raw.postprocess(gamma=(1,1), no_auto_bright=True, output_bps=16)
            return rgb_linear.astype(np.float32) / 65535.0
    else:
        img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
        if img is None:
            raise Exception("Failed to load image")
        
        # Handle BGR -> RGB
        if len(img.shape) == 3:
            if img.shape[2] == 4:
                img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
            else:
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        elif len(img.shape) == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
            
        if img.dtype == np.uint8:
            return img.astype(np.float32) / 255.0
        elif img.dtype == np.uint16:
            return img.astype(np.float32) / 65535.0
        elif img.dtype == np.float32:
            return img
        else:
            return img.astype(np.float32) / np.max(img)

@app.post("/update_roll_profile")
def update_roll_profile(request: RollProfileRequest):
    if not os.path.isdir(request.dir_path):
        raise HTTPException(status_code=404, detail="Directory not found")
        
    profile_path = os.path.join(request.dir_path, "roll_profile.json")
    
    # Try fitting a curve
    curve_params = fit_roll_curve(request.anchors)
    
    # Generate visualization data if we have a curve (100 points along X axis)
    vis_data = None
    if curve_params:
        vis_data = {'r': [], 'g': [], 'b': []}
        x_vals = np.linspace(0, 1, 100)
        for ch in ['r', 'g', 'b']:
            y_vals = log_func(x_vals, *curve_params[ch])
            vis_data[ch] = y_vals.tolist()
            
    profile_data = {
        "anchors": request.anchors,
        "curve_params": curve_params
    }
    
    with open(profile_path, "w") as f:
        json.dump(profile_data, f)
        
    return {"status": "success", "curve_params": curve_params, "vis_data": vis_data}

@app.post("/load_roll_profile")
def load_roll_profile(request: DirectoryRequest):
    profile_path = os.path.join(request.path, "roll_profile.json")
    if not os.path.exists(profile_path):
        return {"anchors": [], "curve_params": None, "vis_data": None}
        
    try:
        with open(profile_path, "r") as f:
            data = json.load(f)
            
        # Re-generate vis data
        vis_data = None
        if data.get("curve_params"):
            vis_data = {'r': [], 'g': [], 'b': []}
            x_vals = np.linspace(0, 1, 100)
            for ch in ['r', 'g', 'b']:
                y_vals = log_func(x_vals, *data["curve_params"][ch])
                vis_data[ch] = y_vals.tolist()
                
        return {
            "anchors": data.get("anchors", []), 
            "curve_params": data.get("curve_params"),
            "vis_data": vis_data
        }
    except Exception:
        return {"anchors": [], "curve_params": None, "vis_data": None}

@app.post("/save_settings")
def save_settings(request: SettingsRequest):
    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="File not found")
    
    settings_path = request.path + ".json"
    try:
        settings = {
            "exposure": request.exposure,
            "base_color": request.base_color,
            "base_color_samples": request.base_color_samples,
            "crop": request.crop,
            "user_curves": request.user_curves
        }
        with open(settings_path, "w") as f:
            json.dump(settings, f)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/load_settings")
def load_settings(request: ImagePath):
    settings_path = request.path + ".json"
    if not os.path.exists(settings_path):
        return {"exposure": 0.0, "base_color": None} # Defaults
        
    try:
        with open(settings_path, "r") as f:
            settings = json.load(f)
            return {
                "exposure": settings.get("exposure", 0.0),
                "base_color": settings.get("base_color", None),
                "base_color_samples": settings.get("base_color_samples", []),
                "crop": settings.get("crop", None),
                "user_curves": settings.get("user_curves", None)
            }
    except Exception as e:
        # If we fail to read settings, just return defaults rather than breaking
        return {"exposure": 0.0, "base_color": None, "crop": None, "user_curves": None}

@app.post("/sample_color")
def sample_color(request: SampleRequest):
    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        rgb_float = get_rgb_float(request.path)
        h, w = rgb_float.shape[:2]
        
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
        
        region = rgb_float[y_start:y_end, x_start:x_end]
        avg_color = np.mean(region, axis=(0, 1))
        
        return {"color": avg_color.tolist()}
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/load_image")
def load_image(image_path: ImagePath):
    if not os.path.exists(image_path.path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        if is_raw(image_path.path):
            with rawpy.imread(image_path.path) as raw:
                return {
                    "width": raw.sizes.width,
                    "height": raw.sizes.height,
                    "camera_white_balance": raw.camera_white_balance.tolist()
                }
        else:
            img = cv2.imread(image_path.path, cv2.IMREAD_UNCHANGED)
            if img is None:
                raise Exception("Failed to load image")
            h, w = img.shape[:2]
            return {
                "width": w,
                "height": h,
                "camera_white_balance": [1.0, 1.0, 1.0, 1.0]
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

import base64

def sync_get_raw_preview(path: str) -> str:
    if is_raw(path):
        with rawpy.imread(path) as raw:
            # Fast extract of un-converted data
            rgb = raw.postprocess(half_size=True, use_camera_wb=True, output_bps=8)
            bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    else:
        bgr = cv2.imread(path)
        if bgr is None:
            raise Exception("Failed to read image")
            
    # Resize to a reasonable preview size to keep base64 payload small (~1080p max)
    h, w = bgr.shape[:2]
    max_dim = 1080
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    success, encoded_image = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not success:
        raise Exception("Failed to encode raw preview")
        
    return base64.b64encode(encoded_image.tobytes()).decode('utf-8')

@app.post("/get_raw_preview")
async def get_raw_preview(request: ImagePath):
    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        loop = asyncio.get_running_loop()
        img_b64 = await loop.run_in_executor(executor, sync_get_raw_preview, request.path)
        return {"image": f"data:image/jpeg;base64,{img_b64}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/list_directory")
def list_directory(request: DirectoryRequest):
    if not os.path.isdir(request.path):
        raise HTTPException(status_code=404, detail="Directory not found")
        
    supported_extensions = ('.arw', '.dng', '.nef', '.cr2', '.cr3', '.orf', '.rw2', '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp')
    files = []
    
    try:
        for f in os.listdir(request.path):
            if f.lower().endswith(supported_extensions):
                files.append({
                    "name": f,
                    "path": os.path.join(request.path, f)
                })
        # Sort files alphabetically
        files.sort(key=lambda x: x["name"].lower())
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def sync_get_thumbnail(path: str) -> str:
    if is_raw(path):
        with rawpy.imread(path) as raw:
            # Use half_size for faster loading of raw
            rgb = raw.postprocess(half_size=True, use_camera_wb=True, output_bps=8)
            
            # Resize
            h, w = rgb.shape[:2]
            scale = 200 / max(h, w)
            new_size = (int(w * scale), int(h * scale))
            thumb_rgb = cv2.resize(rgb, new_size, interpolation=cv2.INTER_AREA)
            
            # BGR for OpenCV
            thumb = cv2.cvtColor(thumb_rgb, cv2.COLOR_RGB2BGR)
    else:
        # Fast path for non-RAWs
        img = cv2.imread(path)
        if img is None:
            raise Exception("Failed to read image")
        # Resize
        h, w = img.shape[:2]
        scale = 200 / max(h, w)
        new_size = (int(w * scale), int(h * scale))
        thumb = cv2.resize(img, new_size, interpolation=cv2.INTER_AREA)
            
    # Encode
    success, encoded_image = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 80])
    if not success:
        raise Exception("Failed to encode thumbnail")
        
    return base64.b64encode(encoded_image.tobytes()).decode('utf-8')

@app.post("/get_thumbnail")
async def get_thumbnail(request: ImagePath):
    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        loop = asyncio.get_running_loop()
        img_b64 = await loop.run_in_executor(executor, sync_get_thumbnail, request.path)
        return {"image": f"data:image/jpeg;base64,{img_b64}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

from cache import global_cache

def sync_convert_image(request: ConvertRequest) -> tuple[str, list]:
    # Check for roll profile
    dir_path = os.path.dirname(request.path)
    profile_path = os.path.join(dir_path, "roll_profile.json")
    curve_params = None
    if os.path.exists(profile_path):
        try:
            with open(profile_path, "r") as f:
                data = json.load(f)
                curve_params = data.get("curve_params")
        except:
            pass

    base_color_tuple = tuple(request.base_color) if request.base_color else None
    
    # Check Cache
    cached_positive = global_cache.get(request.path, base_color_tuple, curve_params)
    
    if cached_positive is not None:
        positive_img_base = cached_positive
    else:
        img_array = get_rgb_float(request.path)
        
        positive_img_base = convert_negative_to_positive(
            img_array, 
            base_color=base_color_tuple, 
            exposure=0.0,
            curve_params=curve_params
        )
        
        global_cache.set(request.path, base_color_tuple, curve_params, positive_img_base)

    # Apply exposure fast
    gain = 2.0 ** request.exposure
    positive_img = np.clip(positive_img_base * gain, 0.0, 1.0)
    
    # Convert back to 8-bit [0, 255] for JPEG encoding and histogram
    positive_img_8bit = (positive_img * 255.0).astype(np.uint8)
    
    if hasattr(request, 'user_curves') and request.user_curves:
        positive_img_8bit = apply_curves(positive_img_8bit, request.user_curves)
    
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
        raise Exception("Failed to encode image")
        
    # Return JSON with base64 image and histogram
    img_b64 = base64.b64encode(encoded_image.tobytes()).decode('utf-8')
    return img_b64, hist

@app.post("/convert_image")
async def convert_image(request: ConvertRequest):
    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        loop = asyncio.get_running_loop()
        img_b64, hist = await loop.run_in_executor(executor, sync_convert_image, request)
        return {
            "image": f"data:image/jpeg;base64,{img_b64}",
            "histogram": hist
        }
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def sync_export_image(request: ExportRequest) -> str:
    img_array = get_rgb_float(request.path)
    
    # Check for roll profile
    dir_path = os.path.dirname(request.path)
    profile_path = os.path.join(dir_path, "roll_profile.json")
    curve_params = None
    if os.path.exists(profile_path):
        try:
            with open(profile_path, "r") as f:
                data = json.load(f)
                curve_params = data.get("curve_params")
        except:
            pass

    base_color_tuple = tuple(request.base_color) if request.base_color else None
    
    positive_img = convert_negative_to_positive(
        img_array, 
        base_color=base_color_tuple, 
        exposure=request.exposure,
        curve_params=curve_params
    )
    
    # Convert back to 8-bit [0, 255] for JPEG encoding
    positive_img_8bit = (positive_img * 255.0).astype(np.uint8)

    if hasattr(request, 'user_curves') and request.user_curves:
        positive_img_8bit = apply_curves(positive_img_8bit, request.user_curves)
    
    # OpenCV uses BGR
    bgr_img = cv2.cvtColor(positive_img_8bit, cv2.COLOR_RGB2BGR)
    
    # Apply physical crop if requested
    if request.crop:
        x_min, y_min, x_max, y_max = request.crop
        h, w = bgr_img.shape[:2]
        
        px_min = max(0, int(x_min * w))
        py_min = max(0, int(y_min * h))
        px_max = min(w, int(x_max * w))
        py_max = min(h, int(y_max * h))
        
        if px_max > px_min and py_max > py_min:
            bgr_img = bgr_img[py_min:py_max, px_min:px_max]
    
    # Determine output filename (original name + _converted.jpg)
    filename = os.path.basename(request.path)
    name, _ = os.path.splitext(filename)
    out_filename = f"{name}_converted.jpg"
    out_path = os.path.join(request.output_dir, out_filename)
    
    # Encode as high-quality JPEG
    success = cv2.imwrite(out_path, bgr_img, [cv2.IMWRITE_JPEG_QUALITY, 100])
    if not success:
        raise Exception("Failed to save exported image")
        
    return out_path

@app.post("/export_image")
async def export_image(request: ExportRequest):
    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.isdir(request.output_dir):
        raise HTTPException(status_code=404, detail="Output directory not found")
        
    try:
        loop = asyncio.get_running_loop()
        out_path = await loop.run_in_executor(executor, sync_export_image, request)
        return {"status": "success", "output_path": out_path}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
