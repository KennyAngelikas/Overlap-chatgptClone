// Client-side conversation storage (localStorage fallback to in-memory).
// Exports: getConversation, saveConversation, addConversation, addMessage,
//          listConversations, deleteConversation, clearConversations

const PREFIX = 'conv:';
const inMemory = new Map();

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

function key(id) {
  return `${PREFIX}${id}`;
}


function safeParse(raw) {
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function readRaw(k) {
  if (storageAvailable()) {
    return localStorage.getItem(k);
  }
  return inMemory.get(k) ?? null;
}

function writeRaw(k, v) {
  if (storageAvailable()) {
    localStorage.setItem(k, v);
    return;
  }
  inMemory.set(k, v);
}

/**
 * Get conversation object by id.
 * Returns { id, title, messages: [] } or a fresh skeleton if missing.
 */
export function getConversation(id) {
  if (!id) return { id: null, title: null, messages: [] };
  const raw = readRaw(key(id));
  let conv = safeParse(raw);
  if (!conv) {
    // return skeleton when there is no stored conversation in the new format
    return { id, title: id, messages: [] };
  }
  // expected new-format shape: messages is an array
  conv.messages = Array.isArray(conv.messages) ? conv.messages : [];
  return { id: conv.id || id, title: conv.title || id, messages: conv.messages };
}

/** Persist a full conversation object */
export function saveConversation(conv) {
  if (!conv || !conv.id) throw new Error('Conversation must have an id');
  const out = {
    id: conv.id,
    title: conv.title || conv.id,
    messages: Array.isArray(conv.messages) ? conv.messages : [],
    created_at: conv.created_at || Date.now(),
    updated_at: Date.now(),
  };
  writeRaw(key(conv.id), JSON.stringify(out));
}

/** Create a conversation if missing */
export function addConversation(id, title = null) {
  if (!id) throw new Error('id required');
  const existing = getConversation(id);
  if (existing && existing.messages && existing.messages.length) return existing;
  const conv = { id, title: title || id, messages: [], created_at: Date.now(), updated_at: Date.now() };
  saveConversation(conv);
  return conv;
}

/** Append a message to a conversation and persist it.
 * message: role: 'user'|'assistant'|'system', content: string
 */
export function addMessage(id, role, content) {
  if (!id) throw new Error('Conversation id required');
  const conv = getConversation(id);
  const msg = { role: role || 'user', content: (content == null ? '' : content), ts: Date.now() };
  conv.messages.push(msg);
  saveConversation(conv);
  return msg;
}

/** List all stored conversations (returns array of conversation objects) */
export function listConversations() {
  const out = [];
  if (storageAvailable()) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const conv = safeParse(localStorage.getItem(k));
      if (conv && conv.id) out.push(conv);
    }
  } else {
    for (const [k, v] of inMemory.entries()) {
      if (!k.startsWith(PREFIX)) continue;
      const conv = safeParse(v);
      if (conv && conv.id) out.push(conv);
    }
  }
  out.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
  return out;
}

/** Delete single conversation */
export function deleteConversation(id) {
  if (!id) return false;
  if (storageAvailable()) localStorage.removeItem(key(id));
  else inMemory.delete(key(id));
  return true;
}

/** Remove all conversations stored under the prefix */
export function clearConversations() {
  if (storageAvailable()) {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } else {
    for (const k of Array.from(inMemory.keys())) {
      if (k.startsWith(PREFIX)) inMemory.delete(k);
    }
  }
  return true;
}

// Legacy migration removed: this store only supports the new `conv:` format.
