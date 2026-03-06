import numpy as np
from curve_fitting import fit_roll_curve

def test_fit_roll_curve_with_base_color():
    anchors = [[0.2, 0.4, 0.6], [0.3, 0.5, 0.7], [0.4, 0.6, 0.8], [0.5, 0.7, 0.9]]
    base_color = [1.0, 1.0, 1.0] # Identity
    # Should run without error
    params = fit_roll_curve(anchors, base_color=base_color)
    assert params is not None
    assert 'r' in params and 'g' in params and 'b' in params
