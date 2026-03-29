import React from 'react';

function formatTime(ms) {
  if (ms === null || ms === undefined) return '--:--.---';
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`;
}

export default function LapHistory({ laps, bestLap }) {
  if (laps.length === 0) {
    return (
      <div className="lap-history">
        <div className="lap-history-empty">No laps recorded yet</div>
      </div>
    );
  }

  return (
    <div className="lap-history">
      <div className="lap-history-header">Lap History</div>
      <div className="lap-list">
        {[...laps].reverse().map((lap, idx) => {
          const lapNum = laps.length - idx;
          const isBest = lap === bestLap;
          return (
            <div key={idx} className={`lap-item ${isBest ? 'lap-best' : ''}`}>
              <span className="lap-num">#{lapNum}</span>
              <span className="lap-time">{formatTime(lap)}</span>
              {isBest && <span className="lap-badge">BEST</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
