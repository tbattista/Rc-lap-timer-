const SETTINGS_KEY = 'rc-lap-timer-settings';
const SESSIONS_KEY = 'rc-lap-timer-sessions';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSession(session) {
  const sessions = loadSessions();
  sessions.unshift(session);
  // Keep last 50 sessions
  if (sessions.length > 50) sessions.length = 50;
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}
