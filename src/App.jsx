import React, { useState, useRef, useCallback, useEffect } from 'react';
import CameraView from './components/CameraView';
import TimerDisplay from './components/TimerDisplay';
import Controls from './components/Controls';
import LapHistory from './components/LapHistory';
import useDetector from './hooks/useDetector';
import { startCamera, stopCamera } from './utils/camera';
import { sampleColor } from './utils/opencv';
import { loadSettings, saveSettings, saveSession } from './utils/storage';

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const drawRafRef = useRef(null);

  // Setup state
  const [mode, setMode] = useState('line'); // 'line' | 'color' | 'race'
  const [linePoints, setLinePoints] = useState([]);
  const [finishLine, setFinishLine] = useState(null);
  const [targetColor, setTargetColor] = useState(null);
  const [targetColorRgb, setTargetColorRgb] = useState(null);

  // Race state
  const [raceState, setRaceState] = useState('idle'); // 'idle' | 'armed' | 'running' | 'stopped'
  const [laps, setLaps] = useState([]);
  const [bestLap, setBestLap] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [lapStartTime, setLapStartTime] = useState(null);

  // Settings
  const [sensitivity, setSensitivity] = useState(30);
  const [minLapTime, setMinLapTime] = useState(3000);
  const [tolerance, setTolerance] = useState(15);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState(null);

  // Refs for race state in callbacks
  const raceStateRef = useRef(raceState);
  const lapStartTimeRef = useRef(lapStartTime);
  useEffect(() => { raceStateRef.current = raceState; }, [raceState]);
  useEffect(() => { lapStartTimeRef.current = lapStartTime; }, [lapStartTime]);

  // Handle line crossing
  const handleCrossing = useCallback((timestamp) => {
    const state = raceStateRef.current;
    if (state === 'armed') {
      setRaceState('running');
      setStartTime(timestamp);
      setLapStartTime(timestamp);
    } else if (state === 'running') {
      const lapTime = timestamp - lapStartTimeRef.current;
      setLaps((prev) => {
        const newLaps = [...prev, lapTime];
        return newLaps;
      });
      setBestLap((prev) => (prev === null || lapTime < prev) ? lapTime : prev);
      setLapStartTime(timestamp);
    }
  }, []);

  const detector = useDetector({
    targetColor,
    tolerance,
    finishLine,
    sensitivity,
    minLapTime,
    onCrossing: handleCrossing,
  });

  // Load saved settings on mount
  useEffect(() => {
    const saved = loadSettings();
    if (saved) {
      if (saved.sensitivity) setSensitivity(saved.sensitivity);
      if (saved.minLapTime) setMinLapTime(saved.minLapTime);
      if (saved.tolerance) setTolerance(saved.tolerance);
      if (saved.finishLine) setFinishLine(saved.finishLine);
      if (saved.targetColor) setTargetColor(saved.targetColor);
      if (saved.targetColorRgb) setTargetColorRgb(saved.targetColorRgb);
      if (saved.finishLine && saved.targetColor) {
        setMode('race');
      }
    }
  }, []);

  // Save settings on change
  useEffect(() => {
    saveSettings({ sensitivity, minLapTime, tolerance, finishLine, targetColor, targetColorRgb });
  }, [sensitivity, minLapTime, tolerance, finishLine, targetColor, targetColorRgb]);

  // Start camera
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const video = videoRef.current;
        if (!video) return;
        const stream = await startCamera(video);
        if (cancelled) { stopCamera(stream); return; }
        streamRef.current = stream;

        // Set canvas to match video dimensions
        const canvas = canvasRef.current;
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        canvas.width = w;
        canvas.height = h;
        setCameraReady(true);
      } catch (err) {
        if (!cancelled) {
          setError('Camera access failed. Please allow camera permissions and reload.');
          console.error(err);
        }
      }
    }
    init();
    return () => {
      cancelled = true;
      stopCamera(streamRef.current);
      if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);
    };
  }, []);

  // Draw video frames to canvas (always, for preview)
  useEffect(() => {
    if (!cameraReady) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    function draw() {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawRafRef.current = requestAnimationFrame(draw);
    }
    drawRafRef.current = requestAnimationFrame(draw);

    return () => {
      if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);
    };
  }, [cameraReady]);

  // Handle line point taps
  const handleSetLinePoint = useCallback((x, y) => {
    setLinePoints((prev) => {
      const next = [...prev, { x, y }];
      if (next.length >= 2) {
        setFinishLine({ x1: next[0].x, y1: next[0].y, x2: next[1].x, y2: next[1].y });
        setMode(targetColor ? 'race' : 'color');
        return [];
      }
      return next;
    });
  }, [targetColor]);

  // Handle color pick
  const handlePickColor = useCallback((x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const color = sampleColor(canvas, x, y, 8);
      setTargetColor(color.hsv);
      setTargetColorRgb(color.rgb);
      if (finishLine) {
        setMode('race');
      }
    } catch (err) {
      console.error('Color pick error:', err);
    }
  }, [finishLine]);

  // Race controls
  const handleArm = useCallback(() => {
    setRaceState('armed');
    setLaps([]);
    setBestLap(null);
    setStartTime(null);
    setLapStartTime(null);
    detector.resetCooldown();
    detector.start(canvasRef.current, videoRef.current);
  }, [detector]);

  const handleStop = useCallback(() => {
    setRaceState('stopped');
    detector.stop();
    // Save session
    if (laps.length > 0) {
      saveSession({
        date: new Date().toISOString(),
        laps,
        bestLap,
      });
    }
  }, [detector, laps, bestLap]);

  const handleReset = useCallback(() => {
    setRaceState('idle');
    setLaps([]);
    setBestLap(null);
    setStartTime(null);
    setLapStartTime(null);
    detector.stop();
    detector.resetCooldown();
  }, [detector]);

  if (error) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>RC Lap Timer</h1>
        </header>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!cameraReady) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>RC Lap Timer</h1>
        </header>
        <div className="loading-message">Starting camera...</div>
        <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>RC Lap Timer</h1>
      </header>

      <CameraView
        videoRef={videoRef}
        canvasRef={canvasRef}
        finishLine={finishLine}
        onSetLinePoint={handleSetLinePoint}
        onPickColor={handlePickColor}
        mode={mode}
        targetColorRgb={targetColorRgb}
        cameraReady={cameraReady}
      />

      <TimerDisplay
        raceState={raceState}
        startTime={startTime}
        lapStartTime={lapStartTime}
        bestLap={bestLap}
        lapCount={laps.length}
      />

      <Controls
        raceState={raceState}
        mode={mode}
        onArm={handleArm}
        onStop={handleStop}
        onReset={handleReset}
        onSetMode={setMode}
        sensitivity={sensitivity}
        onSensitivityChange={setSensitivity}
        minLapTime={minLapTime}
        onMinLapTimeChange={setMinLapTime}
        tolerance={tolerance}
        onToleranceChange={setTolerance}
        hasLine={!!finishLine}
        hasColor={!!targetColor}
      />

      <LapHistory laps={laps} bestLap={bestLap} />
    </div>
  );
}
