import numpy as np
from converter import convert_negative_to_positive

def test_convert_with_curve_params():
    img = np.ones((10, 10, 3), dtype=np.float32) * 0.5
    curve_params = {
        'r': [1.0, 1.0, 0.0, 0.0],
        'g': [1.0, 1.0, 0.0, 0.0],
        'b': [1.0, 1.0, 0.0, 0.0]
    }
    out = convert_negative_to_positive(img, curve_params=curve_params)
    assert out.shape == (10, 10, 3)
