let cvInstance = null;
let cvPromise = null;

export function loadOpenCV() {
  if (cvInstance) return Promise.resolve(cvInstance);
  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    // Inject the script tag on demand if not already present
    if (!document.querySelector('script[src*="opencv.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.9.0/opencv.js';
      script.async = true;
      document.head.appendChild(script);
    }

    let elapsed = 0;
    const interval = 100;
    const maxWait = 30000; // 30s timeout for CDN load
    function check() {
      if (window.cv && window.cv.Mat) {
        cvInstance = window.cv;
        resolve(cvInstance);
      } else {
        elapsed += interval;
        if (elapsed >= maxWait) {
          cvPromise = null; // allow retry
          reject(new Error('OpenCV.js failed to load within 30s'));
        } else {
          setTimeout(check, interval);
        }
      }
    }
    check();
  });

  return cvPromise;
}

export function rgbToHsv(r, g, b) {
  // Pure JS implementation — matches OpenCV's HSV convention (H:0-180, S:0-255, V:0-255)
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6);
    } else if (max === gn) {
      h = 60 * ((bn - rn) / delta + 2);
    } else {
      h = 60 * ((rn - gn) / delta + 4);
    }
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return {
    h: Math.round(h / 2),       // 0-180 (OpenCV convention)
    s: Math.round(s * 255),     // 0-255
    v: Math.round(v * 255),     // 0-255
  };
}

export function sampleColor(canvas, x, y, radius = 5) {
  const ctx = canvas.getContext('2d');
  const size = radius * 2 + 1;
  const imageData = ctx.getImageData(x - radius, y - radius, size, size);
  const data = imageData.data;

  let totalR = 0, totalG = 0, totalB = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
    count++;
  }

  const avgR = Math.round(totalR / count);
  const avgG = Math.round(totalG / count);
  const avgB = Math.round(totalB / count);

  return {
    rgb: { r: avgR, g: avgG, b: avgB },
    hsv: rgbToHsv(avgR, avgG, avgB),
  };
}
