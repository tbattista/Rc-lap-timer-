export function rgbToHsv(r, g, b) {
  // Pure JS — matches OpenCV's HSV convention (H:0-180, S:0-255, V:0-255)
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
    h: Math.round(h / 2),       // 0-180
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
