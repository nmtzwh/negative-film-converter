from fastapi.testclient import TestClient
from server import app
from unittest.mock import patch, MagicMock
import os

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_load_image_not_found():
    response = client.post("/load_image", json={"path": "non_existent.arw"})
    assert response.status_code == 404
    assert response.json()["detail"] == "File not found"

@patch("rawpy.imread")
def test_load_image_success(mock_imread):
    # Mock rawpy object
    mock_raw = MagicMock()
    mock_raw.sizes.width = 6000
    mock_raw.sizes.height = 4000
    mock_raw.camera_white_balance = MagicMock()
    mock_raw.camera_white_balance.tolist.return_value = [2000, 1000, 1500, 1000]
    
    # Mock context manager
    mock_imread.return_value.__enter__.return_value = mock_raw
    
    # Create a dummy file to pass the os.path.exists check
    with open("dummy.arw", "w") as f:
        f.write("dummy content")
    
    try:
        response = client.post("/load_image", json={"path": "dummy.arw"})
        assert response.status_code == 200
        assert response.json() == {
            "width": 6000,
            "height": 4000,
            "camera_white_balance": [2000, 1000, 1500, 1000]
        }
    finally:
        if os.path.exists("dummy.arw"):
            os.remove("dummy.arw")

@patch("rawpy.imread")
def test_load_image_error(mock_imread):
    mock_imread.side_effect = Exception("Invalid RAW file")
    
    with open("dummy.arw", "w") as f:
        f.write("dummy content")
    
    try:
        response = client.post("/load_image", json={"path": "dummy.arw"})
        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid RAW file"
    finally:
        if os.path.exists("dummy.arw"):
            os.remove("dummy.arw")

@patch("rawpy.imread")
@patch("cv2.imencode")
@patch("converter.convert_negative_to_positive")
def test_convert_image_success(mock_convert, mock_imencode, mock_imread):
    import numpy as np
    
    # Mock rawpy object
    mock_raw = MagicMock()
    # Postprocess returns a dummy array
    mock_raw.postprocess.return_value = np.zeros((10, 10, 3), dtype=np.uint16)
    mock_imread.return_value.__enter__.return_value = mock_raw
    
    # Mock converter
    mock_convert.return_value = np.zeros((10, 10, 3), dtype=np.float32)
    
    # Mock cv2.imencode
    mock_imencode.return_value = (True, np.array([1, 2, 3], dtype=np.uint8))
    
    with open("dummy.arw", "w") as f:
        f.write("dummy content")
    
    try:
        response = client.post("/convert_image", json={"path": "dummy.arw"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/jpeg"
        assert response.content == b"\x01\x02\x03"
    finally:
        if os.path.exists("dummy.arw"):
            os.remove("dummy.arw")

