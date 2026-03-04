import numpy as np
from user_curves import generate_lut, apply_curves

def test_generate_lut():
    # Identity curve
    lut = generate_lut([[0.0, 0.0], [1.0, 1.0]])
    assert len(lut) == 256
    assert lut[0] == 0 and lut[255] == 255
    
    # S-Curve test
    lut2 = generate_lut([[0.0, 0.0], [0.25, 0.1], [0.75, 0.9], [1.0, 1.0]])
    assert lut2[64] < 64  # pulled down
    assert lut2[192] > 192 # pulled up

def test_apply_curves():
    img = np.ones((10, 10, 3), dtype=np.uint8) * 128
    curves = {
        "rgb": [[0,0], [1,1]],
        "r": [[0,0], [0.5, 0.75], [1,1]], # Boost red midtones
        "g": [[0,0], [1,1]],
        "b": [[0,0], [1,1]]
    }
    out = apply_curves(img, curves)
    assert out[0,0,0] > 128 # Red boosted (OpenCV uses BGR, but we assume we pass RGB into apply_curves for now, wait, let's assume RGB input)
