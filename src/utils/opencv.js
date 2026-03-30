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
  const mat = new window.cv.Mat(1, 1, window.cv.CV_8UC3);
  mat.data[0] = r;
  mat.data[1] = g;
  mat.data[2] = b;
  const hsv = new window.cv.Mat();
  window.cv.cvtColor(mat, hsv, window.cv.COLOR_RGB2HSV);
  const h = hsv.data[0];
  const s = hsv.data[1];
  const v = hsv.data[2];
  mat.delete();
  hsv.delete();
  return { h, s, v };
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
