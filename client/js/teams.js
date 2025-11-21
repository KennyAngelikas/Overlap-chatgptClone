// Simple teams helper stored in localStorage (UI-first option)
const PREFIX = 'team:';
const SELECTED_KEY = 'selected_team';
const TEAM_ENDPOINTS = ['/backend-api/v2/teams', '/backend-api/v2/teams_memory'];

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

export function createLocalTeam(name, memberLimit = null) {
  if (!name) return null;
  const id = Date.now();
  const team = { id, name, members: {}, member_limit: memberLimit };
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
  if (!v) return null;
  const asNumber = Number(v);
  return Number.isNaN(asNumber) ? v : asNumber;
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

function normalizeTeam(team) {
  if (!team) return null;
  if (typeof team.id === 'undefined' && typeof team.team_id !== 'undefined') {
    team.id = team.team_id;
  }
  if (!team.name && team.team_name) team.name = team.team_name;
  if (!team.members && team.user_id) team.members = team.user_id;
  if (typeof team.member_limit === 'undefined' && typeof team.memberLimit !== 'undefined') {
    team.member_limit = team.memberLimit;
  }
  return team;
}

async function tryTeamsApi(method, suffix = '', body = null) {
  const errors = [];
  for (const base of TEAM_ENDPOINTS) {
    const url = `${base}${suffix}`;
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      if (!res.ok) {
        errors.push(`${url}: ${res.status}`);
        continue;
      }
      const json = await res.json();
      if (!json || json.success === false) {
        errors.push(`${url}: ${json?.error || 'unknown error'}`);
        continue;
      }
      return json;
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  throw new Error(errors.join(' | '));
}

export async function fetchTeamsList() {
  try {
    const data = await tryTeamsApi('GET');
    const teams = Array.isArray(data.teams) ? data.teams.map(normalizeTeam).filter(Boolean) : [];
    return teams;
  } catch (err) {
    // fallback to local storage when API is unavailable
    return listLocalTeams();
  }
}

export async function createTeamRecord(name, memberLimit = null) {
  try {
    const payload = { team_name: name, member_limit: memberLimit };
    const data = await tryTeamsApi('POST', '', payload);
    const team = normalizeTeam({
      id: data.team_id,
      name: data.team_name || name,
      member_limit: data.member_limit ?? memberLimit,
      members: {}
    });
    if (team && team.id) {
      writeRaw(key(team.id), JSON.stringify(team));
      setSelectedTeamId(team.id);
    }
    return { team, source: 'remote', success: true };
  } catch (err) {
    const team = createLocalTeam(name, memberLimit);
    setSelectedTeamId(team?.id || null);
    return { team, source: 'local', success: !!team, error: err.message };
  }
}

export async function joinTeamRecord(teamId, userKey, userEmail) {
  try {
    const payload = { team_id: teamId, user_key: userKey, user_email: userEmail };
    await tryTeamsApi('POST', '/join', payload);
    joinLocalTeam(teamId, userKey, userEmail);
    setSelectedTeamId(teamId);
    return { success: true, source: 'remote' };
  } catch (err) {
    const ok = joinLocalTeam(teamId, userKey, userEmail);
    setSelectedTeamId(teamId);
    return { success: ok, source: 'local', error: err.message };
  }
}

export default {
  listLocalTeams,
  createLocalTeam,
  joinLocalTeam,
  getSelectedTeamId,
  setSelectedTeamId,
  getTeam,
  fetchTeamsList,
  createTeamRecord,
  joinTeamRecord,
};
