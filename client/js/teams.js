// Simple teams helper stored in localStorage (UI-first option)
const PREFIX = 'team:';
const SELECTED_KEY = 'selected_team';

function storageAvailable() {
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

function key(id) { return `${PREFIX}${id}`; }

function readRaw(k) { return storageAvailable() ? localStorage.getItem(k) : null; }
function writeRaw(k, v) { if (storageAvailable()) localStorage.setItem(k, v); }

function safeParse(v) { try { return JSON.parse(v); } catch (e) { return null; } }

export function listLocalTeams() {
  const out = [];
  if (!storageAvailable()) return out;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    const t = safeParse(localStorage.getItem(k));
    if (t && t.id) out.push(t);
  }
  out.sort((a,b)=> (a.id - b.id));
  return out;
}

export function createLocalTeam(name) {
  if (!name) return null;
  const id = Date.now();
  const team = { id, name, members: {} };
  writeRaw(key(id), JSON.stringify(team));
  return team;
}

export function joinLocalTeam(teamId, userKey, userEmail) {
  if (!teamId || !userKey || !userEmail) return false;
  const raw = readRaw(key(teamId));
  const team = safeParse(raw) || { id: teamId, name: `team-${teamId}`, members: {} };
  team.members = team.members || {};
  team.members[userKey] = userEmail;
  writeRaw(key(teamId), JSON.stringify(team));
  return true;
}

export function getSelectedTeamId() {
  if (!storageAvailable()) return null;
  const v = localStorage.getItem(SELECTED_KEY);
  return v ? Number(v) : null;
}

export function setSelectedTeamId(id) {
  if (!storageAvailable()) return false;
  if (id == null) { localStorage.removeItem(SELECTED_KEY); return true; }
  localStorage.setItem(SELECTED_KEY, String(id));
  return true;
}

export function getTeam(teamId) {
  const raw = readRaw(key(teamId));
  return safeParse(raw);
}

export default {
  listLocalTeams,
  createLocalTeam,
  joinLocalTeam,
  getSelectedTeamId,
  setSelectedTeamId,
  getTeam,
};
