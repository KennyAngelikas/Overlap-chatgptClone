/**
 * store.js
 * Handles saving and loading chat history using LocalStorage.
 */

const STORAGE_KEY = "conversations";

// === INTERNAL HELPER: Read from Storage ===
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

// === INTERNAL HELPER: Save to Storage ===
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// === EXPORTED FUNCTIONS ===

// 1. List all conversations (Sorted by newest)
export async function listConversations() {
  const data = loadData();
  // Convert object {id: {data}} to array [{data}, {data}]
  const list = Object.values(data);
  // Sort by updatedAt timestamp (descending)
  return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// 2. Get a single conversation
export async function getConversation(id) {
  const data = loadData();
  return data[id] || null;
}

// 3. Add or Update a conversation
export async function addConversation(id, title) {
  const data = loadData();
  
  if (!data[id]) {
    // Create new conversation entry
    data[id] = {
      id: id,
      title: title || "New Chat",
      messages: [], // Empty messages array
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  } else {
    // Just update the title if it already exists
    if (title) data[id].title = title;
  }
  
  saveData(data);
  return data[id];
}

// 4. Add a message to a conversation
export async function addMessage(id, role, content) {
  const data = loadData();
  
  // Safety check: Create conversation if it doesn't exist yet
  if (!data[id]) {
    await addConversation(id, content.slice(0, 30));
  }

  // Push the new message
  data[id].messages.push({
    role: role, // 'user' or 'assistant'
    content: content,
    timestamp: Date.now()
  });

  // Update timestamp so this chat moves to the top of the list
  data[id].updatedAt = Date.now();

  // Auto-Title: If this is the very first message from the user, set title
  if (role === 'user' && data[id].messages.length === 1) {
    data[id].title = content.substring(0, 40) + (content.length > 40 ? "..." : "");
  }

  saveData(data);
}

// 5. Delete a conversation
export async function deleteConversation(id) {
  const data = loadData();
  if (data[id]) {
    delete data[id];
    saveData(data);
  }
}

// 6. Clear all conversations
export async function clearConversations() {
  localStorage.removeItem(STORAGE_KEY);
}