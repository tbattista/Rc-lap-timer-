import React, { useState, useRef, useCallback, useEffect } from 'react';
import { startCamera, stopCamera } from './utils/camera';
import TimerDisplay from './components/TimerDisplay';
import LapHistory from './components/LapHistory';

export default function App() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState(null);
  const [debugLog, setDebugLog] = useState([]);

  // Race state
  const [raceState, setRaceState] = useState('idle');
  const [laps, setLaps] = useState([]);
  const [bestLap, setBestLap] = useState(null);
  const [lapStartTime, setLapStartTime] = useState(null);

  const addLog = useCallback((msg) => {
    const ts = new Date().toLocaleTimeString();
    setDebugLog((prev) => [...prev, `${ts}: ${msg}`]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        addLog('Init starting...');
        const video = videoRef.current;
        addLog(`videoRef exists: ${!!video}`);
        if (!video) return;

        addLog(`navigator.mediaDevices exists: ${!!navigator.mediaDevices}`);
        addLog(`getUserMedia exists: ${!!navigator.mediaDevices?.getUserMedia}`);

        const stream = await startCamera(video, addLog);
        if (cancelled) { stopCamera(stream); addLog('Cancelled after stream'); return; }
        streamRef.current = stream;

        addLog(`Video dimensions: ${video.videoWidth}x${video.videoHeight}`);
        setCameraReady(true);
        addLog('Camera ready!');
      } catch (err) {
        addLog(`ERROR: ${err.name}: ${err.message}`);
        if (!cancelled) {
          setError(`Camera failed: ${err.message}`);
          console.error(err);
        }
      }
    }

    const timeout = setTimeout(() => {
      addLog('TIMEOUT: camera init took >10s');
      if (!cancelled) {
        setError('Camera took too long to start. Please reload and allow camera access promptly.');
      }
    }, 10000);

    init().finally(() => {
      clearTimeout(timeout);
    });

    return () => {
      cancelled = true;
      stopCamera(streamRef.current);
    };
  }, [addLog]);

  const handleStart = useCallback(() => {
    setRaceState('running');
    setLaps([]);
    setBestLap(null);
    setLapStartTime(performance.now());
  }, []);

  const handleLap = useCallback(() => {
    const now = performance.now();
    const lapTime = now - lapStartTime;
    setLaps((prev) => [...prev, lapTime]);
    setBestLap((prev) => (prev === null || lapTime < prev) ? lapTime : prev);
    setLapStartTime(now);
  }, [lapStartTime]);

  const handleStop = useCallback(() => {
    setRaceState('stopped');
  }, []);

  const handleReset = useCallback(() => {
    setRaceState('idle');
    setLaps([]);
    setBestLap(null);
    setLapStartTime(null);
  }, []);

  const debugPanel = debugLog.length > 0 && (
    <div className="debug-log">
      <div className="debug-log-header">Debug Log</div>
      {debugLog.map((line, i) => (
        <div key={i} className="debug-log-line">{line}</div>
      ))}
    </div>
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>RC Lap Timer</h1>
      </header>

      {error && (
        <>
          <div className="error-message">{error}</div>
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
          {debugPanel}
        </>
      )}

      <div className="camera-view">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-canvas"
        />
        {!cameraReady && !error && (
          <div className="loading-overlay">
            Starting camera...
            {debugPanel}
          </div>
        )}
      </div>

      {cameraReady && (
        <>
          <TimerDisplay
            raceState={raceState}
            startTime={lapStartTime}
            lapStartTime={lapStartTime}
            bestLap={bestLap}
            lapCount={laps.length}
          />

          <div className="controls">
            <div className="controls-buttons">
              {raceState === 'idle' && (
                <button className="btn btn-primary" onClick={handleStart}>Start</button>
              )}
              {raceState === 'running' && (
                <>
                  <button className="btn btn-primary" onClick={handleLap}>Lap</button>
                  <button className="btn btn-danger" onClick={handleStop}>Stop</button>
                </>
              )}
              {raceState === 'stopped' && (
                <button className="btn" onClick={handleReset}>Reset</button>
              )}
            </div>
          </div>

          <LapHistory laps={laps} bestLap={bestLap} />
        </>
      )}

      {cameraReady && debugPanel}
    </div>
  );
}
