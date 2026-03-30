import React from 'react';

export default function Controls({
  raceState,
  mode,
  detectMode,
  onDetectModeChange,
  onArm,
  onStop,
  onReset,
  onSetMode,
  sensitivity,
  onSensitivityChange,
  minLapTime,
  onMinLapTimeChange,
  tolerance,
  onToleranceChange,
  hasLine,
  hasColor,
}) {
  const isMotion = detectMode === 'motion';
  const canRace = isMotion ? hasLine : (hasLine && hasColor);

  return (
    <div className="controls">
      {/* Detection mode toggle */}
      <div className="mode-toggle">
        <button
          className={`mode-btn ${isMotion ? 'mode-btn-active' : ''}`}
          onClick={() => onDetectModeChange('motion')}
        >
          Motion
        </button>
        <button
          className={`mode-btn ${!isMotion ? 'mode-btn-active' : ''}`}
          onClick={() => onDetectModeChange('color')}
        >
          Color
        </button>
      </div>

      <div className="controls-buttons">
        {mode !== 'race' ? (
          <>
            <button
              className={`btn ${mode === 'line' ? 'btn-active' : ''}`}
              onClick={() => onSetMode('line')}
            >
              Set Line
            </button>
            {!isMotion && (
              <button
                className={`btn ${mode === 'color' ? 'btn-active' : ''}`}
                onClick={() => onSetMode('color')}
              >
                Pick Color
              </button>
            )}
            {canRace && (
              <button className="btn btn-primary" onClick={() => onSetMode('race')}>
                Ready
              </button>
            )}
          </>
        ) : (
          <>
            {(raceState === 'idle' || raceState === 'stopped') && (
              <button className="btn btn-primary" onClick={onArm}>
                Arm
              </button>
            )}
            {(raceState === 'armed' || raceState === 'running') && (
              <button className="btn btn-danger" onClick={onStop}>
                Stop
              </button>
            )}
            <button className="btn" onClick={onReset}>
              Reset
            </button>
            <button className="btn" onClick={() => onSetMode('line')}>
              Setup
            </button>
          </>
        )}
      </div>

      <div className="controls-sliders">
        <label>
          Sensitivity: {sensitivity}
          <input
            type="range"
            min="5"
            max="100"
            value={sensitivity}
            onChange={(e) => onSensitivityChange(Number(e.target.value))}
          />
        </label>
        {!isMotion && (
          <label>
            Color Tolerance: {tolerance}
            <input
              type="range"
              min="5"
              max="40"
              value={tolerance}
              onChange={(e) => onToleranceChange(Number(e.target.value))}
            />
          </label>
        )}
        <label>
          Min Lap Time: {(minLapTime / 1000).toFixed(1)}s
          <input
            type="range"
            min="1000"
            max="10000"
            step="500"
            value={minLapTime}
            onChange={(e) => onMinLapTimeChange(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
