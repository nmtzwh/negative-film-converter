Let's dive right into the research on the mathematics behind converting scanned color negative film into positive images.

Converting a negative isn't as simple as flipping the colors. Because of the physical properties of color film—specifically the orange substrate (the "film base") and the non-linear way film reacts to light—the math requires a few distinct steps to get accurate, true-to-life colors.

Here is the mathematical breakdown of how this conversion works.

### **1\. The Photographic Densitometry Approach (The Pure Math)**

Photographic film responds to light logarithmically. The fundamental equation relating the density ($D$) of the developed film to the original scene exposure ($E$) is known as the Hurter-Driffield (H\&D) characteristic curve:

$$D \= \\gamma \\log\_{10}(E) \+ D\_{min}$$  
Where:

* $D$ is the density of the film.  
* $\\gamma$ (gamma) is the contrast of the film.

* $E$ is the original scene exposure (the light we want to recover).  
* $D\_{min}$ is the minimum density of the film (the orange film base).

When you scan the film, the scanner's sensor measures **transmittance** ($T$), which is the fraction of light that passes through the film. Density and transmittance are related inversely and logarithmically:

$$D \= \-\\log\_{10}(T)$$  
To find the original scene exposure ($E$), we substitute the equations and solve for $E$:

$$-\\log\_{10}(T) \= \\gamma \\log\_{10}(E) \+ D\_{min}$$

$$\\log\_{10}(E) \= \-\\frac{1}{\\gamma}\\log\_{10}(T) \- \\frac{D\_{min}}{\\gamma}$$

$$E \= T^{-\\frac{1}{\\gamma}} \\cdot 10^{-\\frac{D\_{min}}{\\gamma}}$$  
This final equation reveals a crucial fact: **mathematically, converting a negative involves raising the scanned transmittance to a negative power**, not simply subtracting it from 1\.

### ---

**2\. The Practical Digital Workflow (The RGB Math)**

In modern digital workflows (like using Lightroom, Photoshop, or Negative Lab Pro), software approximates this densitometry using linear algebra and channel manipulation.

Assuming your scanner outputs linear, 16-bit normalized values where $0.0$ is pure black and $1.0$ is pure white, the math happens in three main stages:

#### **Step A: Neutralizing the Orange Mask**

Color negative film is printed on an orange-tinted base to correct for dye impurities. If you just invert the image, the result will be heavily tinted cyan/blue. We must mathematically divide out the base color.

Let $V \= (R, G, B)$ be a scanned pixel, and $B \= (R\_b, G\_b, B\_b)$ be the color of the unexposed film border. We divide the image by the base color channel-by-channel:

$$R' \= \\frac{R}{R\_b}, \\quad G' \= \\frac{G}{G\_b}, \\quad B' \= \\frac{B}{B\_b}$$  
This normalizes the film base to pure white ($1.0, 1.0, 1.0$) so that when inverted, the unexposed edges become pure black.

#### **Step B: The Inversion**

Once the mask is neutralized, the software performs a linear inversion. For normalized floating-point values ($0.0$ to $1.0$):

$$R\_{inv} \= 1.0 \- R', \\quad G\_{inv} \= 1.0 \- G', \\quad B\_{inv} \= 1.0 \- B'$$

#### **Step C: Applying the Tone Curve (Gamma Correction)**

Because scanners capture light linearly but our eyes (and film) perceive light logarithmically, the inverted linear image will look flat, dark, and washed out. A non-linear power function (gamma correction) is applied to restore contrast:

$$R\_{out} \= R\_{inv}^{1/\\gamma}, \\quad G\_{out} \= G\_{inv}^{1/\\gamma}, \\quad B\_{out} \= B\_{inv}^{1/\\gamma}$$  
Typically, a $\\gamma$ value between $1.8$ and $2.2$ is used, though specialized software will apply a more complex "S-curve" to mimic the specific roll-off of highlights and shadows characteristic of analog film.

### ---

**3\. Color Matrices (Correcting Dye Crosstalk)**

Finally, cyan, magenta, and yellow dyes in film are never physically perfect; they overlap and absorb light outside their intended spectrum. To fix this "crosstalk," advanced inversion math multiplies the resulting RGB vector by a $3 \\times 3$ color correction matrix ($M$):

$$\\begin{bmatrix} R\_{final} \\\\ G\_{final} \\\\ B\_{final} \\end{bmatrix} \= \\begin{bmatrix} m\_{11} & m\_{12} & m\_{13} \\\\ m\_{21} & m\_{22} & m\_{23} \\\\ m\_{31} & m\_{32} & m\_{33} \\end{bmatrix} \\begin{bmatrix} R\_{out} \\\\ G\_{out} \\\\ B\_{out} \\end{bmatrix}$$  
This matrix pushes the colors back into their correct spectral places, making the greens look like natural foliage and skin tones look human.