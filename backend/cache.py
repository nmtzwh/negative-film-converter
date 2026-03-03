import numpy as np

class ImageCache:
    def __init__(self):
        self.path = None
        self.base_color = None
        self.curve_params = None
        # The positive image before exposure is applied
        self.base_positive = None

    def get(self, path: str, base_color, curve_params):
        if (self.path == path and
            self.base_color == base_color and
            self.curve_params == curve_params and
            self.base_positive is not None):
            return self.base_positive
        return None

    def set(self, path: str, base_color, curve_params, base_positive: np.ndarray):
        self.path = path
        self.base_color = base_color
        self.curve_params = curve_params
        self.base_positive = base_positive

global_cache = ImageCache()
