import { useRef, useCallback } from 'react';
import { rgbToHsv } from '../utils/opencv';

export default function useDetector({ detectMode, targetColor, tolerance, finishLine, sensitivity, minLapTime, onCrossing, onDebug }) {
  const runningRef = useRef(false);
  const frameIdRef = useRef(null);
  const lastCrossingRef = useRef(0);
  const wasCrossingRef = useRef(false);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const prevPixelsRef = useRef(null);

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

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const useMotion = detectMode === 'motion';

    if (!canvas || !video || !finishLine || (!useMotion && !targetColor)) {
      frameIdRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    // Throttle to ~5fps
    const now = performance.now();
    if (now - lastFrameTimeRef.current < 200) {
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

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = canvas.width;

      let matchRatio;

      if (useMotion) {
        // Motion detection: compare current pixels to previous frame
        const currentPixels = new Uint8Array(linePixels.length * 3);
        for (let i = 0; i < linePixels.length; i++) {
          const idx = (linePixels[i].y * w + linePixels[i].x) * 4;
          currentPixels[i * 3] = data[idx];
          currentPixels[i * 3 + 1] = data[idx + 1];
          currentPixels[i * 3 + 2] = data[idx + 2];
        }

        if (!prevPixelsRef.current) {
          prevPixelsRef.current = currentPixels;
          onDebug?.('Capturing baseline...');
          frameIdRef.current = requestAnimationFrame(detectFrame);
          return;
        }

        // Count pixels that changed significantly
        const changeThreshold = 30; // RGB difference per channel to count as "changed"
        let changedCount = 0;
        for (let i = 0; i < linePixels.length; i++) {
          const j = i * 3;
          const dr = Math.abs(currentPixels[j] - prevPixelsRef.current[j]);
          const dg = Math.abs(currentPixels[j + 1] - prevPixelsRef.current[j + 1]);
          const db = Math.abs(currentPixels[j + 2] - prevPixelsRef.current[j + 2]);
          if (dr + dg + db > changeThreshold * 3) {
            changedCount++;
          }
        }

        prevPixelsRef.current = currentPixels;
        matchRatio = changedCount / linePixels.length;
      } else {
        // Color detection: match against target color in HSV
        const tol = tolerance || 15;
        const hLow = Math.max(0, targetColor.h - tol);
        const hHigh = Math.min(180, targetColor.h + tol);
        const sLow = Math.max(0, targetColor.s - 50);
        const sHigh = Math.min(255, targetColor.s + 50);
        const vLow = Math.max(0, targetColor.v - 50);
        const vHigh = Math.min(255, targetColor.v + 50);

        let matchCount = 0;
        for (const { x, y } of linePixels) {
          const idx = (y * w + x) * 4;
          const hsv = rgbToHsv(data[idx], data[idx + 1], data[idx + 2]);
          if (hsv.h >= hLow && hsv.h <= hHigh &&
              hsv.s >= sLow && hsv.s <= sHigh &&
              hsv.v >= vLow && hsv.v <= vHigh) {
            matchCount++;
          }
        }
        matchRatio = matchCount / linePixels.length;
      }

      const threshold = (sensitivity || 50) / 1000;
      const isCrossing = matchRatio > threshold;
      const label = useMotion ? 'motion' : 'match';
      onDebug?.(`${label}: ${(matchRatio * 100).toFixed(1)}% thresh: ${(threshold * 100).toFixed(1)}%${isCrossing ? ' CROSSING!' : ''}`);

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
    }

    frameIdRef.current = requestAnimationFrame(detectFrame);
  }, [detectMode, targetColor, tolerance, finishLine, sensitivity, minLapTime, onCrossing, onDebug, getLinePixels]);

  const start = useCallback((canvas, video) => {
    canvasRef.current = canvas;
    videoRef.current = video;
    runningRef.current = true;
    lastCrossingRef.current = 0;
    wasCrossingRef.current = false;
    prevPixelsRef.current = null;
    onDebug?.('Detection active');
    frameIdRef.current = requestAnimationFrame(detectFrame);
  }, [detectFrame, onDebug]);

  const stop = useCallback(() => {
    runningRef.current = false;
    prevPixelsRef.current = null;
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }
  }, []);

  const resetCooldown = useCallback(() => {
    lastCrossingRef.current = 0;
    wasCrossingRef.current = false;
  }, []);

  return { start, stop, resetCooldown };
}
