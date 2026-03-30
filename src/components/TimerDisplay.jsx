import React, { useState, useEffect, useRef } from 'react';

function formatTime(ms) {
  if (ms === null || ms === undefined) return '--:--.---';
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`;
}

export default function TimerDisplay({ raceState, startTime, lapStartTime, bestLap, lapCount }) {
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (raceState === 'running') {
      const tick = () => {
        setCurrentTime(performance.now() - lapStartTime);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    } else {
      setCurrentTime(0);
    }
  }, [raceState, lapStartTime]);

  return (
    <div className="timer-display">
      <div className="timer-current">
        <span className="timer-label">Current Lap</span>
        <span className="timer-value">
          {raceState === 'running' ? formatTime(currentTime) : formatTime(null)}
        </span>
      </div>
      <div className="timer-stats">
        <div className="timer-stat">
          <span className="timer-label">Best Lap</span>
          <span className="timer-value-small">{formatTime(bestLap)}</span>
        </div>
        <div className="timer-stat">
          <span className="timer-label">Laps</span>
          <span className="timer-value-small">{lapCount}</span>
        </div>
      </div>
      <div className={`race-state state-${raceState}`}>
        {raceState === 'idle' && 'Ready'}
        {raceState === 'armed' && 'Waiting for car...'}
        {raceState === 'running' && 'Racing'}
        {raceState === 'stopped' && 'Stopped'}
      </div>
    </div>
  );
}
