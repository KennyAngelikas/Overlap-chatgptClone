// Simple teams helper (API-only, no local mock data)
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
  const data = await tryTeamsApi('GET');
  const teams = Array.isArray(data.teams) ? data.teams.map(normalizeTeam).filter(Boolean) : [];
  return teams;
}

export async function createTeamRecord(name, memberLimit = null) {
  const payload = { team_name: name, member_limit: memberLimit };
  const data = await tryTeamsApi('POST', '', payload);
  const team = normalizeTeam({
    id: data.team_id,
    name: data.team_name || name,
    member_limit: data.member_limit ?? memberLimit,
    members: {}
  });
  if (team && team.id) {
    setSelectedTeamId(team.id);
  }
  return { team, source: 'remote', success: true };
}

export async function joinTeamRecord(teamId, userKey, userEmail) {
  const payload = { team_id: teamId, user_key: userKey, user_email: userEmail };
  await tryTeamsApi('POST', '/join', payload);
  setSelectedTeamId(teamId);
  return { success: true, source: 'remote' };
}

export default {
  getSelectedTeamId,
  setSelectedTeamId,
  fetchTeamsList,
  createTeamRecord,
  joinTeamRecord,
};
