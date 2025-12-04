/**
 * chat.js
 * Logic for the Chat Application (chat.html)
 */

import { streamConversation } from "./api.js";
import * as store from "./store.js";
import {
  renderUserMessage,
  createAssistantPlaceholder,
  renderAssistantChunk,
  clearMessages,
  showError,
  scrollToBottom,
  renderConversationList,
} from "./ui.js";
import {
  fetchTeamsList,
  createTeamRecord,
  joinTeamRecord,
  getSelectedTeamId,
  setSelectedTeamId,
} from "./teams.js";
import { message_id, uuid, resizeTextarea } from "./utils.js";

// === GLOBAL STATE ===
let currentAbort = null;
let closeSidebarRef = null;
let appInitialized = false;
let teamStatusTimeout = null;
let teamsCache = [];

const MOCK_MODE =
  typeof location !== "undefined" &&
  location.hash &&
  location.hash.includes("local");

// === AUTH HELPERS ===
function ensureUserIdentity() {
  let userId = localStorage.getItem("user_id");
  let userEmail = localStorage.getItem("user_email");
  
  if (!userId) {
    // If we somehow got here without an ID, generate one
    userId = `user_${uuid().slice(0, 8)}`;
    localStorage.setItem("user_id", userId);
  }
  if (!userEmail) {
    userEmail = `${userId}@overlap.local`;
    localStorage.setItem("user_email", userEmail);
  }
  return { userId, userEmail };
}

// === UI HELPERS ===
function showStopGenerating(show) {
  const stopEl = document.getElementById("stop-generating");
  if (stopEl) stopEl.style.display = show ? "block" : "none";
}

function updateMessageCount(count) {
  const countEl = document.getElementById("message-count");
  if (countEl) {
    countEl.textContent = `${count} message${count === 1 ? "" : "s"}`;
  }
}

function setActiveConversation(id) {
  document.querySelectorAll(".convo").forEach((el) => {
    el.classList.toggle("active", el.id === `convo-${id}`);
  });
}

function closeSidebarIfMobile() {
  if (closeSidebarRef && typeof closeSidebarRef === "function") {
    if (window.innerWidth <= 1024) closeSidebarRef();
  }
}

function showTeamStatus(message, type = "info") {
  const status = document.getElementById("team-status");
  if (!status) return;
  status.textContent = message || "";
  status.className = `team-status ${type}`;
  if (teamStatusTimeout) clearTimeout(teamStatusTimeout);
  if (message) {
    teamStatusTimeout = setTimeout(() => {
      status.textContent = "";
      status.className = "team-status";
    }, 3500);
  }
}

// === TEAM LOGIC ===
function updateActiveTeamChip() {
  const nameEl = document.getElementById("active-team-name");
  const metaEl = document.getElementById("team-meta");
  const selectedId = getSelectedTeamId();
  const selectedTeam = teamsCache.find((t) => `${t.id}` === `${selectedId}`);
  const label = selectedTeam?.name || "Personal space";
  if (nameEl) nameEl.textContent = label;
  if (metaEl) {
    if (selectedTeam) {
      const size =
        selectedTeam.member_limit && Number(selectedTeam.member_limit) > 0
          ? `${selectedTeam.member_limit} seats`
          : "Unlimited seats";
      metaEl.textContent = `${label} · ${size}`;
    } else {
      metaEl.textContent = "Solo workspace";
    }
  }
}

function renderTeamSelect(list) {
  const select = document.getElementById("team-select");
  if (!select) return;
  const selectedId = getSelectedTeamId();
  select.innerHTML = "";

  const personal = document.createElement("option");
  personal.value = "";
  personal.textContent = "Personal space";
  select.appendChild(personal);

  if (list && list.length) {
    list.forEach((team) => {
      const opt = document.createElement("option");
      opt.value = `${team.id}`;
      opt.textContent = team.name || `Team ${team.id}`;
      select.appendChild(opt);
    });
  }

  select.value = selectedId != null ? `${selectedId}` : "";
  select.onchange = (e) => {
    const value = e.target.value;
    setSelectedTeamId(value || null);
    updateJoinButtonLabel();
    updateActiveTeamChip();
    renderTeamsList(list || teamsCache);
  };
  updateActiveTeamChip();
}

function updateJoinButtonLabel(forceJoined = false) {
  const joinBtn = document.getElementById("join-team-button");
  if (!joinBtn) return;
  const selectedId = getSelectedTeamId();
  const selectedTeam = teamsCache.find((t) => `${t.id}` === `${selectedId}`);
  const labelNode = joinBtn.querySelector("span") || joinBtn;
  const isJoined = forceJoined || `${localStorage.getItem("team_id") || ""}` === `${selectedId}`;
  if (!selectedId) {
    joinBtn.disabled = true;
    labelNode.textContent = "Select a team";
    joinBtn.classList.remove("joined");
    return;
  }
  joinBtn.disabled = false;
  labelNode.textContent = isJoined
    ? "Joined"
    : `Join ${selectedTeam?.name || "team"}`;
  joinBtn.classList.toggle("joined", isJoined);
}

function renderTeamsList(list) {
  const container = document.getElementById("team-list");
  if (!container) return;
  const selectedId = getSelectedTeamId();
  container.innerHTML = "";
  if (!list || !list.length) {
    const empty = document.createElement("div");
    empty.className = "no-teams";
    empty.textContent = "No teams yet. Create one to get started.";
    container.appendChild(empty);
    updateJoinButtonLabel();
    return;
  }
  list.forEach((team) => {
    const isSelected = `${team.id}` === `${selectedId}`;
    const item = document.createElement("div");
    item.className = "team-card";
    if (isSelected) item.classList.add("active");

    const info = document.createElement("div");
    info.className = "team-info";
    const nameEl = document.createElement("div");
    nameEl.className = "team-name";
    nameEl.textContent = team.name || `Team ${team.id}`;
    const meta = document.createElement("div");
    meta.className = "team-meta";
    meta.textContent = team.member_limit
      ? `${team.member_limit} member${team.member_limit === 1 ? "" : "s"}`
      : "Flexible size";
    info.appendChild(nameEl);
    info.appendChild(meta);

    const selectBtn = document.createElement("button");
    selectBtn.className = "team-select-btn";
    selectBtn.textContent = isSelected ? "Selected" : "Select";
    selectBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setSelectedTeamId(team.id);
      renderTeamsList(list);
      updateJoinButtonLabel();
    });

    item.addEventListener("click", () => {
      setSelectedTeamId(team.id);
      renderTeamsList(list);
      updateJoinButtonLabel();
    });

    item.appendChild(info);
    item.appendChild(selectBtn);
    container.appendChild(item);
  });
  updateJoinButtonLabel();
}

async function refreshTeams() {
  try {
    teamsCache = await fetchTeamsList();
    teamsCache.sort((a, b) => Number(a.id) - Number(b.id));
  } catch (err) {
    teamsCache = [];
  }
  renderTeamsList(teamsCache);
  renderTeamSelect(teamsCache);
  updateActiveTeamChip();
}

function openCreateTeamModal() {
  const modal = document.getElementById("team-modal");
  if (!modal) return;
  modal.classList.add("active");
  const nameInput = document.getElementById("team-modal-name");
  if (nameInput) {
    nameInput.value = "";
    nameInput.focus();
  }
  const sizeInput = document.getElementById("team-modal-size");
  if (sizeInput) sizeInput.value = "";
  const err = document.getElementById("team-modal-error");
  if (err) err.textContent = "";
}

function closeCreateTeamModal(resetFields = false) {
  const modal = document.getElementById("team-modal");
  if (!modal) return;
  modal.classList.remove("active");
  if (resetFields) {
    document.getElementById("team-modal-error").textContent = "";
    document.getElementById("team-modal-name").value = "";
    document.getElementById("team-modal-size").value = "";
  }
}

async function handleCreateTeamSubmit() {
  const nameInput = document.getElementById("team-modal-name");
  const sizeInput = document.getElementById("team-modal-size");
  const errorEl = document.getElementById("team-modal-error");
  const confirmBtn = document.getElementById("team-modal-confirm");
  const name = nameInput?.value?.trim();
  const rawLimit = sizeInput?.value?.trim();
  const memberLimit = rawLimit ? parseInt(rawLimit, 10) : null;

  if (!name) {
    if (errorEl) errorEl.textContent = "Please enter a team name.";
    return;
  }
  
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Creating...";
  }

  try {
    const result = await createTeamRecord(name, memberLimit);
    if (!result.success || !result.team) throw new Error(result.error);
    setSelectedTeamId(result.team.id);
    await refreshTeams();
    showTeamStatus(`Created ${result.team.name}`, "success");
    closeCreateTeamModal(true);
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message || "Unable to create team.";
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Create team";
    }
  }
}

async function handleCreateTeamInline() {
  const nameInput = document.getElementById("settings-team-name");
  const sizeInput = document.getElementById("settings-team-size");
  const statusEl = document.getElementById("settings-create-error");
  const createBtn = document.getElementById("settings-create-team");

  const name = nameInput?.value?.trim();
  const rawLimit = sizeInput?.value?.trim();
  const memberLimit = rawLimit ? parseInt(rawLimit, 10) : null;

  if (!name) {
    if (statusEl) statusEl.textContent = "Give your team a name.";
    return;
  }

  if (createBtn) {
    createBtn.disabled = true;
    createBtn.textContent = "Creating...";
  }

  try {
    const result = await createTeamRecord(name, memberLimit);
    if (!result.success || !result.team) throw new Error(result.error);
    setSelectedTeamId(result.team.id);
    if (nameInput) nameInput.value = "";
    if (sizeInput) sizeInput.value = "";
    await refreshTeams();
    showTeamStatus(`Created ${result.team.name}`, "success");
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || "Unable to create team.";
  } finally {
    if (createBtn) {
      createBtn.disabled = false;
      createBtn.textContent = "Create team";
    }
  }
}

async function handleJoinSelectedTeam() {
  const selectedId = getSelectedTeamId();
  const joinBtn = document.getElementById("join-team-button");
  if (!selectedId) {
    showTeamStatus("Select a team to join", "error");
    return;
  }
  const { userId, userEmail } = ensureUserIdentity();
  const selectedTeam = teamsCache.find((t) => `${t.id}` === `${selectedId}`);
  if (joinBtn) joinBtn.disabled = true;
  showTeamStatus("Joining team...", "info");
  try {
    const result = await joinTeamRecord(selectedId, userId, userEmail);
    if (!result.success) throw new Error(result.error);
    localStorage.setItem("team_id", selectedId);
    showTeamStatus(`You have joined ${selectedTeam?.name}`, "success");
    updateJoinButtonLabel(true);
    updateActiveTeamChip();
  } catch (err) {
    showTeamStatus(err.message, "error");
  } finally {
    if (joinBtn) joinBtn.disabled = false;
  }
}

function initTeamsPanel() {
  const createBtn = document.getElementById("create-team-button");
  const inlineCreateBtn = document.getElementById("settings-create-team");
  const joinBtn = document.getElementById("join-team-button");
  const cancelBtn = document.getElementById("team-modal-cancel");
  const confirmBtn = document.getElementById("team-modal-confirm");
  const overlay = document.getElementById("team-modal-overlay");
  const refreshBtn = document.getElementById("refresh-teams-button");

  if (createBtn) createBtn.addEventListener("click", openCreateTeamModal);
  if (inlineCreateBtn) inlineCreateBtn.addEventListener("click", handleCreateTeamInline);
  if (joinBtn) joinBtn.addEventListener("click", handleJoinSelectedTeam);
  if (cancelBtn) cancelBtn.addEventListener("click", () => closeCreateTeamModal(true));
  if (overlay) overlay.addEventListener("click", () => closeCreateTeamModal(true));
  if (confirmBtn) confirmBtn.addEventListener("click", handleCreateTeamSubmit);
  if (refreshBtn) refreshBtn.addEventListener("click", refreshTeams);

  refreshTeams();
}

// === CHAT LOGIC ===
async function handleSend() {
  const inputEl = document.getElementById("message-input");
  if (!inputEl) return;
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = "";
  resizeTextarea(inputEl);

  const convId = window.conversation_id || uuid();
  const title = text.length > 0 ? text.slice(0, 48).trim() : convId;
  store.addConversation(convId, title || convId);
  store.addMessage(convId, "user", text);
  updateMessageCount((await store.getConversation(convId)).messages.length);
  setActiveConversation(convId);

  const token = message_id();
  renderUserMessage(token, text);
  createAssistantPlaceholder(token);

  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();

  const customApiKey = localStorage.getItem("custom_api_key");
  const { userId } = ensureUserIdentity();
  const teamId = localStorage.getItem("team_id") || null;

  const payload = {
    conversation_id: convId,
    action: "_ask",
    model: "gpt-4o",
    jailbreak: "default",
    ...(customApiKey ? { api_key: customApiKey } : {}),
    meta: {
      id: message_id(),
      user: {
        user_id: userId,
        ...(teamId ? { team_id: teamId } : {}),
      },
      content: {
        conversation: (await store.getConversation(convId)).messages,
        internet_access: document.getElementById("toggle-internet")?.checked || false,
        content_type: "text",
        parts: [{ content: text, role: "user" }],
      },
    },
  };

  showStopGenerating(true);

  let acc = "";
  if (MOCK_MODE) {
    const simulated = `Echo: ${text}\n\n(Local simulated response.)`;
    renderAssistantChunk(token, simulated);
    store.addMessage(convId, "assistant", simulated);
    showStopGenerating(false);
    return;
  }

  try {
    await streamConversation(
      payload,
      (chunk) => {
        acc += chunk;
        renderAssistantChunk(token, acc);
      },
      currentAbort.signal
    );

    store.addMessage(convId, "assistant", acc);
    updateMessageCount((await store.getConversation(convId)).messages.length);
  } catch (err) {
    if (err.name === "AbortError") {
      renderAssistantChunk(token, acc + " [aborted]");
    } else {
      showError("Failed to get response");
      console.error(err);
      renderAssistantChunk(token, acc + " [error]");
    }
  } finally {
    currentAbort = null;
    showStopGenerating(false);
    scrollToBottom();
  }
}

function handleCancel() {
  if (currentAbort) currentAbort.abort();
  showStopGenerating(false);
}

async function setConversation(id, conv) {
  window.conversation_id = id;
  clearMessages();
  if (!conv) conv = await store.getConversation(id);
  for (const m of conv.messages) {
    const t = message_id();
    if (m.role === "user") {
      renderUserMessage(t, m.content);
    } else {
      createAssistantPlaceholder(t);
      renderAssistantChunk(t, m.content);
    }
  }
  updateMessageCount(conv.messages.length);
  setActiveConversation(id);
}

// === INIT CHAT APP ===
async function init() {
  if (appInitialized) return;
  appInitialized = true;

  // SECURITY: Kick to landing page if not logged in
  if (!localStorage.getItem("user_id")) {
    window.location.href = "/";
    return;
  }

  const sendBtn = document.getElementById("send-button");
  const cancelBtn = document.getElementById("cancelButton");
  const inputEl = document.getElementById("message-input");

  if (sendBtn) sendBtn.addEventListener("click", () => handleSend());
  if (cancelBtn) cancelBtn.addEventListener("click", () => handleCancel());
  if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  // Load Conversations
  const listEl = document.getElementById("conversation-list");
  if (listEl) {
    const handlers = {
      onSelect: async (id) => {
        const c = await store.getConversation(id);
        setConversation(id, c);
        closeSidebarIfMobile();
      },
      onDelete: async (id) => {
        await store.deleteConversation(id);
        const l2 = await store.listConversations();
        renderConversationList(listEl, l2, handlers);
      },
    };
    const list = await store.listConversations();
    renderConversationList(listEl, list, handlers);
  }

  // New Conversation Button
  const newBtn = document.getElementById("new-convo-button");
  if (newBtn) {
    newBtn.addEventListener("click", async () => {
      const id = uuid();
      window.conversation_id = id;
      store.addConversation(id, "New chat");
      clearMessages();
      // Reload list to highlight new chat
      if (listEl) {
          const list = await store.listConversations();
          // handlers is defined in scope above, careful. 
          // Re-defining briefly for safety or moving handlers out is better.
          // For now, reloading page is simplest or just assume list refresh:
          window.location.reload(); 
      }
      inputEl?.focus();
    });
  }
    
  // Clear All Button
  const clearBtn = document.getElementById("clear-conversations-button");
  if(clearBtn) {
      clearBtn.addEventListener("click", async () => {
          store.clearConversations();
          clearMessages();
          if(listEl) listEl.innerHTML = "";
      });
  }

  // Initialize Modules
  initTeamsPanel();
  initSidebar();
  initSettings();
  applyCompactMode();
}

function initSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("mobile-overlay");
    const openBtn = document.getElementById("mobile-menu-btn");
    const closeBtn = document.getElementById("sidebar-close-btn");

    if(openBtn) openBtn.addEventListener("click", () => sidebar.classList.add("open"));
    if(closeBtn) closeBtn.addEventListener("click", () => sidebar.classList.remove("open"));
    if(overlay) overlay.addEventListener("click", () => sidebar.classList.remove("open"));
    closeSidebarRef = () => sidebar.classList.remove("open");
}

function initSettings() {
    const drawer = document.getElementById("settings-drawer");
    const openBtn = document.getElementById("open-settings");
    const closeBtn = document.getElementById("close-settings");
    if(openBtn) openBtn.addEventListener("click", () => drawer.classList.add("open"));
    if(closeBtn) closeBtn.addEventListener("click", () => drawer.classList.remove("open"));
    
    // Toggles
    const toggleInternet = document.getElementById("toggle-internet");
    if(toggleInternet) {
        toggleInternet.checked = localStorage.getItem("overlap_internet_enabled") === "true";
        toggleInternet.addEventListener("change", () => {
            localStorage.setItem("overlap_internet_enabled", toggleInternet.checked);
        });
    }
}

function applyCompactMode() {
    if(localStorage.getItem("overlap_compact_mode") === "true") {
        document.body.classList.add("compact-mode");
    }
}

// === ENTRY POINT ===
document.addEventListener("DOMContentLoaded", () => {
  // Only run if we are on the Chat App page
  if (document.getElementById("main-app")) {
    init().catch(console.error);
  }
});