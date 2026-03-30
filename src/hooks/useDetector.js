import { useRef, useCallback, useEffect } from 'react';
import { loadOpenCV } from '../utils/opencv';

export default function useDetector({ targetColor, tolerance, finishLine, sensitivity, minLapTime, onCrossing }) {
  const cvRef = useRef(null);
  const runningRef = useRef(false);
  const frameIdRef = useRef(null);
  const lastCrossingRef = useRef(0);
  const wasCrossingRef = useRef(false);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const cvLoadingRef = useRef(false);

  // OpenCV is loaded lazily when start() is called, not on mount

  const getLinePixels = useCallback((line, width, height, bandWidth = 6) => {
    if (!line) return null;
    const { x1, y1, x2, y2 } = line;
    const pixels = [];
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.round(x1 + (x2 - x1) * t);
      const cy = Math.round(y1 + (y2 - y1) * t);
      for (let offset = -bandWidth; offset <= bandWidth; offset++) {
        const dx = -(y2 - y1);
        const dy = x2 - x1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const px = Math.round(cx + (dx / len) * offset);
        const py = Math.round(cy + (dy / len) * offset);
        if (px >= 0 && px < width && py >= 0 && py < height) {
          pixels.push({ x: px, y: py });
        }
      }
    }
    return pixels;
  }, []);

  const detectFrame = useCallback(() => {
    if (!runningRef.current) return;

    const cv = cvRef.current;
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!cv || !canvas || !video || !targetColor || !finishLine) {
      // Use slower polling when waiting for dependencies instead of spinning at 60fps
      frameIdRef.current = setTimeout(() => {
        frameIdRef.current = requestAnimationFrame(detectFrame);
      }, cv ? 0 : 200); // 200ms backoff while waiting for OpenCV
      return;
    }

    // Throttle to ~15fps to avoid blocking the main thread with OpenCV operations
    const now = performance.now();
    if (now - lastFrameTimeRef.current < 66) { // ~15fps
      frameIdRef.current = requestAnimationFrame(detectFrame);
      return;
    }
    lastFrameTimeRef.current = now;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      frameIdRef.current = requestAnimationFrame(detectFrame);
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const linePixels = getLinePixels(finishLine, canvas.width, canvas.height);
    if (!linePixels || linePixels.length === 0) {
      frameIdRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    let src = null;
    let hsv = null;
    let mask = null;

    try {
      src = cv.matFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
      hsv = new cv.Mat();
      mask = new cv.Mat();

      cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
      const rgb = new cv.Mat();
      hsv.copyTo(rgb);
      cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
      rgb.delete();

      const tol = tolerance || 15;
      const lower = new cv.Mat(1, 1, cv.CV_8UC3);
      const upper = new cv.Mat(1, 1, cv.CV_8UC3);
      lower.data[0] = Math.max(0, targetColor.h - tol);
      lower.data[1] = Math.max(0, targetColor.s - 50);
      lower.data[2] = Math.max(0, targetColor.v - 50);
      upper.data[0] = Math.min(180, targetColor.h + tol);
      upper.data[1] = Math.min(255, targetColor.s + 50);
      upper.data[2] = Math.min(255, targetColor.v + 50);

      cv.inRange(hsv, lower, upper, mask);
      lower.delete();
      upper.delete();

      // Count matching pixels in the finish line zone
      let matchCount = 0;
      const maskData = mask.data;
      const w = mask.cols;
      for (const { x, y } of linePixels) {
        if (maskData[y * w + x] > 0) {
          matchCount++;
        }
      }

      const matchRatio = matchCount / linePixels.length;
      const threshold = (sensitivity || 50) / 1000; // 0.01 to 0.1 range

      const isCrossing = matchRatio > threshold;
      const now = performance.now();

      if (isCrossing && !wasCrossingRef.current) {
        const elapsed = now - lastCrossingRef.current;
        if (elapsed > (minLapTime || 3000)) {
          lastCrossingRef.current = now;
          onCrossing?.(now);
        }
      }
      wasCrossingRef.current = isCrossing;
    } catch (e) {
      console.error('Detection error:', e);
    } finally {
      src?.delete();
      hsv?.delete();
      mask?.delete();
    }

    frameIdRef.current = requestAnimationFrame(detectFrame);
  }, [targetColor, tolerance, finishLine, sensitivity, minLapTime, onCrossing, getLinePixels]);

  const start = useCallback((canvas, video) => {
    canvasRef.current = canvas;
    videoRef.current = video;
    runningRef.current = true;
    lastCrossingRef.current = 0;
    wasCrossingRef.current = false;
    // Load OpenCV in background — detectFrame polls until it's ready
    loadOpenCV().then((cv) => { cvRef.current = cv; }).catch(() => {});
    frameIdRef.current = requestAnimationFrame(detectFrame);
  }, [detectFrame]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      clearTimeout(frameIdRef.current);
      frameIdRef.current = null;
    }
  }, []);

  const resetCooldown = useCallback(() => {
    lastCrossingRef.current = 0;
    wasCrossingRef.current = false;
  }, []);

  return { start, stop, resetCooldown };
}
