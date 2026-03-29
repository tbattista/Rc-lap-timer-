import React, { useRef, useEffect, useCallback } from 'react';

export default function CameraView({
  videoRef,
  canvasRef,
  finishLine,
  onSetLinePoint,
  onPickColor,
  mode, // 'line' | 'color' | 'race'
  targetColorRgb,
}) {
  const overlayCanvasRef = useRef(null);
  const containerRef = useRef(null);

  // Draw overlay (finish line + guides)
  const drawOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Draw finish line
    if (finishLine) {
      ctx.beginPath();
      ctx.moveTo(finishLine.x1, finishLine.y1);
      ctx.lineTo(finishLine.x2, finishLine.y2);
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw detection band
      const dx = -(finishLine.y2 - finishLine.y1);
      const dy = finishLine.x2 - finishLine.x1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const bandWidth = 6;
      const nx = (dx / len) * bandWidth;
      const ny = (dy / len) * bandWidth;

      ctx.beginPath();
      ctx.moveTo(finishLine.x1 + nx, finishLine.y1 + ny);
      ctx.lineTo(finishLine.x2 + nx, finishLine.y2 + ny);
      ctx.lineTo(finishLine.x2 - nx, finishLine.y2 - ny);
      ctx.lineTo(finishLine.x1 - nx, finishLine.y1 - ny);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
      ctx.fill();
    }

    // Draw mode hint
    if (mode === 'line') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, overlay.width, 32);
      ctx.fillStyle = '#00ff00';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Tap two points to set the finish line', overlay.width / 2, 22);
    } else if (mode === 'color') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, overlay.width, 32);
      ctx.fillStyle = '#ffaa00';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Tap the car to capture its color', overlay.width / 2, 22);
    }
  }, [finishLine, mode]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // Sync overlay canvas size with main canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (canvas && overlay) {
      overlay.width = canvas.width;
      overlay.height = canvas.height;
      drawOverlay();
    }
  }, [canvasRef, drawOverlay]);

  const handleTap = useCallback((e) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const scaleX = overlay.width / rect.width;
    const scaleY = overlay.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    if (mode === 'line') {
      onSetLinePoint?.(x, y);
    } else if (mode === 'color') {
      onPickColor?.(x, y);
    }
  }, [mode, onSetLinePoint, onPickColor]);

  return (
    <div className="camera-view" ref={containerRef}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ display: 'none' }}
      />
      <canvas ref={canvasRef} className="camera-canvas" />
      <canvas
        ref={overlayCanvasRef}
        className="overlay-canvas"
        onClick={handleTap}
      />
      {targetColorRgb && (
        <div className="color-swatch" style={{
          backgroundColor: `rgb(${targetColorRgb.r},${targetColorRgb.g},${targetColorRgb.b})`,
        }}>
          <span>Car Color</span>
        </div>
      )}
    </div>
  );
}
