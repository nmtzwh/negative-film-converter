import cv2
import numpy as np

img = cv2.imread('../images/DSC05906.JPG')
# Let's just save a small cropped image of the top border to see what's there
# The image is 4000x6000
crop = img[0:400, 1000:2000]
cv2.imwrite('../images/top_crop.jpg', crop)
