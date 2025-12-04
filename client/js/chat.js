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
  joinTeamRecord,
  getSelectedTeamId,
  setSelectedTeamId,
} from "./teams.js";
import { message_id, uuid, resizeTextarea } from "./utils.js";

let currentAbort = null;
let closeSidebarRef = null;
let appInitialized = false;
let teamStatusTimeout = null;
let teamsCache = [];

// Check if running on localhost for testing
const MOCK_MODE =
  typeof location !== "undefined" &&
  (location.hostname === "localhost" || location.hostname === "127.0.0.1") &&
  location.hash.includes("local");

// --- UTILS ---
function ensureUserIdentity() {
  const userId = localStorage.getItem("user_id");

  // STRICT CHECK: If no User ID, redirect immediately
  if (!userId) {
    window.location.href = "/";
    // Throwing an error stops the rest of the function from running
    throw new Error("User not logged in. Redirecting...");
  }

  let userEmail = localStorage.getItem("user_email");
  
  // We can keep the email fallback as a safety measure, 
  // but the ID is now strictly required.
  if (!userEmail) {
    userEmail = `${userId}@overlap.local`;
  }
  
  return { userId, userEmail };
}

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

// --- TEAMS LOGIC ---

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

function updateHeaderTeam() {
  const nameEl = document.getElementById("active-team-name");
  const iconContainer = document.querySelector("#team-chip .team-chip-icon");
  
  const joinedId = localStorage.getItem("team_id");
  const joinedTeam = teamsCache.find((t) => `${t.id}` === `${joinedId}`);
  
  // If we have an ID, we are in a team. Prefer name, fallback to ID.
  // If no ID, we are in Personal space.
  let label = "Personal space";
  if (joinedId) {
    label = joinedTeam?.name || `Team ${joinedId}`;
  }

  if (nameEl) nameEl.textContent = label;
  
  if (iconContainer) {
    iconContainer.innerHTML = joinedId 
       ? `<i class="fa-solid fa-user-group"></i>` 
       : `<i class="fa-solid fa-user"></i>`;
  }
}

function updateSettingsMeta() {
  const metaEl = document.getElementById("team-meta");
  if (!metaEl) return;
  
  const selectedId = getSelectedTeamId();
  const selectedTeam = teamsCache.find((t) => `${t.id}` === `${selectedId}`);
  const label = selectedTeam?.name || "Personal space";

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
    updateSettingsMeta();
    renderTeamsList(list || teamsCache);
  };

  updateSettingsMeta();
}

function updateJoinButtonLabel(forceJoined = false) {
  const joinBtn = document.getElementById("join-team-button");
  if (!joinBtn) return;
  const selectedId = getSelectedTeamId();
  const currentTeamId = localStorage.getItem("team_id");
  
  // Case: Personal Space selected (selectedId is null/empty)
  if (!selectedId) {
    if (currentTeamId) {
      // User is in a team, but viewing Personal Space -> Offer to LEAVE
      joinBtn.disabled = false;
      const labelSpan = joinBtn.querySelector("span") || joinBtn;
      labelSpan.textContent = "Leave team";
      
      const icon = joinBtn.querySelector("i");
      if(icon) icon.className = "fa-solid fa-arrow-right-from-bracket";
      
      joinBtn.classList.remove("joined");
      joinBtn.classList.add("destructive"); // Optional styling
    } else {
      // User is already in Personal Space
      joinBtn.disabled = true;
      const labelSpan = joinBtn.querySelector("span") || joinBtn;
      labelSpan.textContent = "Personal Space";
      
      const icon = joinBtn.querySelector("i");
      if(icon) icon.className = "fa-solid fa-user";
      
      joinBtn.classList.add("joined");
      joinBtn.classList.remove("destructive");
    }
    return;
  }
  
  // Case: A Team is selected
  joinBtn.classList.remove("destructive");
  const icon = joinBtn.querySelector("i");
  if(icon) icon.className = "fa-solid fa-circle-check";

  // Ensure we compare strings to strings
  const isJoined = forceJoined || (String(currentTeamId || "") === String(selectedId));
  
  joinBtn.disabled = false;
  const labelSpan = joinBtn.querySelector("span") || joinBtn;
  labelSpan.textContent = isJoined
    ? "Joined"
    : `Join team`;
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
    const isSelected = String(team.id) === String(selectedId);
    const item = document.createElement("div");
    item.className = "team-card";
    if (isSelected) item.classList.add("active");

    const info = document.createElement("div");
    info.className = "team-info";
    const nameEl = document.createElement("div");
    nameEl.className = "team-name";
    nameEl.textContent = team.name || team.team_name || `Team ${team.id}`;
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
      updateSettingsMeta();
    });

    item.addEventListener("click", () => {
      setSelectedTeamId(team.id);
      renderTeamsList(list);
      updateJoinButtonLabel();
      updateSettingsMeta();
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
    // Safely sort
    teamsCache.sort((a, b) => Number(a.id) - Number(b.id));
  } catch (err) {
    teamsCache = [];
  }
  renderTeamsList(teamsCache);
  renderTeamSelect(teamsCache);
  updateSettingsMeta();
  updateHeaderTeam();
}



// --- CHAT LOGIC ---

async function handleSend() {
  const inputEl = document.getElementById("message-input");
  if (!inputEl) return;

  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = "";
  resizeTextarea(inputEl);

  // 1. Setup Conversation ID
  const convId = window.conversation_id || uuid();
  window.conversation_id = convId; // Ensure global tracking

  // 2. Save User Message
  // NOTE: We await this to ensure data is saved before UI renders if needed
  await store.addConversation(convId, text.slice(0, 48)); 
  await store.addMessage(convId, "user", text);
  
  // 3. Update UI
  const conv = await store.getConversation(convId);
  updateMessageCount(conv.messages.length);
  setActiveConversation(convId);

  const token = message_id();
  renderUserMessage(token, text);
  createAssistantPlaceholder(token);

  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();

  const customApiKey = localStorage.getItem("custom_api_key");

  const payload = {
    conversation_id: convId,
    action: "_ask",
    model: "gpt-4o",
    jailbreak: "default",
    ...(customApiKey ? { api_key: customApiKey } : {}),
    meta: {
      id: message_id(),
      content: {
        conversation: conv.messages,
        internet_access:
          document.getElementById("toggle-internet")?.checked || false,
        content_type: "text",
        parts: [{ content: text, role: "user" }],
      },
    },
  };

  showStopGenerating(true);

  let acc = "";
  // --- MOCK MODE HANDLING ---
  if (MOCK_MODE) {
    const simulated = `Echo: ${text}\n\n(Local simulated response.)`;
    await new Promise(r => setTimeout(r, 500)); // Fake delay
    renderAssistantChunk(token, simulated);
    await store.addMessage(convId, "assistant", simulated);
    showStopGenerating(false);
    updateMessageCount((await store.getConversation(convId)).messages.length);
    scrollToBottom();
    return;
  }

  // --- REAL API HANDLING ---
  try {
    await streamConversation(
      payload,
      (chunk) => {
        acc += chunk;
        renderAssistantChunk(token, acc);
      },
      currentAbort.signal
    );

    await store.addMessage(convId, "assistant", acc);
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
  
  // Update URL
  const newUrl = `/chat/${id}`;
  if (location.pathname !== newUrl) {
    history.pushState({ path: newUrl }, "", newUrl);
  }

  if (!conv) conv = await store.getConversation(id);
  if (!conv) return;

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

// --- INITIALIZATION ---

async function init() {
  if (appInitialized) return;
  appInitialized = true;

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

  const listEl =
    document.getElementById("conversation-list") ||
    document.getElementById("conversations");
    
  const handlers = {
    onSelect: async (id) => {
      const c = await store.getConversation(id);
      if (c) setConversation(id, c);
      closeSidebarIfMobile();
    },
    onDelete: async (id) => {
      await store.deleteConversation(id);
      const l2 = await store.listConversations();
      if (listEl) {
        renderConversationList(listEl, l2, handlers);
        // If we deleted the active chat, reset ID
        if (window.conversation_id === id) window.conversation_id = null;
      }
    },
    onShowOption: () => {},
  };

  if (listEl) {
    const list = await store.listConversations();
    renderConversationList(listEl, list, handlers);
    if (window.conversation_id) {
       const c = await store.getConversation(window.conversation_id);
       if(c) setActiveConversation(window.conversation_id);
    }
  }

  if (inputEl) {
    try {
      inputEl.focus();
    } catch (e) {}
  }

  const newBtn = document.getElementById("new-convo-button");
  if (newBtn) {
    newBtn.addEventListener("click", async () => {
      const id = uuid();
      window.conversation_id = id;
      // Don't create empty chat record yet, just clear UI
      clearMessages();
      updateMessageCount(0);
      
      const list = await store.listConversations();
      if (listEl) {
        renderConversationList(listEl, list, handlers);
      }
      if (inputEl) inputEl.focus();
    });
  }

  const clearBtn = document.getElementById("clear-conversations-button");
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      if(!confirm("Clear all chat history?")) return;
      await store.clearConversations();
      clearMessages();
      if (listEl) renderConversationList(listEl, [], handlers);
      updateMessageCount(0);
    });
  }

  initTeamsPanel();
  initMobileSidebar();
  initStopGeneratingButton();
  initApiKeySettings();
  initSettingsDrawer();
  applyCompactMode();
  initLogoNavigation();
}

// --- UI INIT HELPERS ---

function initMobileSidebar() {
  const menuBtn = document.getElementById("mobile-menu-btn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("mobile-overlay");

  const toggle = () => {
    if (sidebar) sidebar.classList.toggle("open");
    if (overlay) overlay.classList.toggle("active");
  };
  
  const close = () => {
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("active");
  };

  if (menuBtn) menuBtn.addEventListener("click", toggle);
  if (overlay) overlay.addEventListener("click", close);
  
  // Export reference for closing on selection
  closeSidebarRef = close;
}

function initStopGeneratingButton() {
   // Logic primarily handled in init() via cancelBtn listener
   // and showStopGenerating(). Kept for architectural consistency.
}

function initSettingsDrawer() {
  const openBtn = document.getElementById("open-settings");
  const closeBtn = document.getElementById("close-settings");
  const drawer = document.getElementById("settings-drawer");
  const backdrop = document.getElementById("settings-backdrop");
  
  // Tabs
  const tabGeneral = document.querySelector('.settings-tab[data-tab="general"]');
  const tabTeams = document.querySelector('.settings-tab[data-tab="teams"]');
  const panelGeneral = document.querySelector('.settings-section[data-panel="general"]');
  const panelTeams = document.querySelector('.settings-section[data-panel="teams"]');

  const open = () => { if (drawer) drawer.classList.add("open"); };
  const close = () => { if (drawer) drawer.classList.remove("open"); };

  if (openBtn) openBtn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (backdrop) backdrop.addEventListener("click", close);

  if (tabGeneral && tabTeams && panelGeneral && panelTeams) {
    tabGeneral.addEventListener("click", () => {
      tabGeneral.classList.add("active");
      tabTeams.classList.remove("active");
      panelGeneral.classList.add("active");
      panelTeams.classList.remove("active");
    });
    
    tabTeams.addEventListener("click", () => {
      tabTeams.classList.add("active");
      tabGeneral.classList.remove("active");
      panelTeams.classList.add("active");
      panelGeneral.classList.remove("active");
    });
  }
}


function openCreateTeamModal() {
  const modal = document.getElementById("team-modal");
  if(modal) modal.classList.add("active");
}
function closeCreateTeamModal(reset) {
  const modal = document.getElementById("team-modal");
  if(modal) modal.classList.remove("active");
  if(reset && document.getElementById("team-modal-name")) {
      document.getElementById("team-modal-name").value = "";
  }
}

async function handleJoinSelectedTeam() {
  const selectedId = getSelectedTeamId();
  
  // Case: Personal Space (Leave Team)
  if (!selectedId) {
    if (localStorage.getItem("team_id")) {
      if (confirm("Leave current team and return to Personal Space?")) {
        localStorage.removeItem("team_id");
        updateJoinButtonLabel();
        updateHeaderTeam();
        showTeamStatus("You are now in Personal Space", "success");
      }
    }
    return;
  }

  console.log("Joining team:", selectedId);
  
  const { userId, userEmail } = ensureUserIdentity();
  const res = await joinTeamRecord(selectedId, userId, userEmail);
  
  if (res.success) {
    localStorage.setItem("team_id", selectedId); // SAVE JOINED STATE
    updateJoinButtonLabel(true); 
    updateHeaderTeam();
    showTeamStatus("Joined team!", "success");
  } else {
    showTeamStatus(res.error || "Failed to join", "error");
  }
}

function initTeamsPanel() {
  const createBtn = document.getElementById("create-team-button"); // May not exist in UI
  const joinBtn = document.getElementById("join-team-button");
  const cancelBtn = document.getElementById("team-modal-cancel");
  const overlay = document.getElementById("team-modal-overlay");
  const refreshBtn = document.getElementById("refresh-teams-button");

  if (createBtn) createBtn.addEventListener("click", openCreateTeamModal);
  if (joinBtn) joinBtn.addEventListener("click", handleJoinSelectedTeam);
  if (cancelBtn) cancelBtn.addEventListener("click", () => closeCreateTeamModal(true));
  if (overlay) overlay.addEventListener("click", () => closeCreateTeamModal(true));
  if (refreshBtn) refreshBtn.addEventListener("click", refreshTeams);

  refreshTeams();
}

function initApiKeySettings() {
  const input = document.getElementById("api-key-input");
  const saveBtn = document.getElementById("save-api-key-button");
  const clearBtn = document.getElementById("clear-api-key-button");
  const status = document.getElementById("api-key-status");

  const load = () => {
    const key = localStorage.getItem("custom_api_key");
    if (input && key) input.value = key;
  };

  if (saveBtn && input) {
    saveBtn.addEventListener("click", () => {
      const val = input.value.trim();
      if (val) {
        localStorage.setItem("custom_api_key", val);
        if (status) {
            status.textContent = "Saved!";
            status.className = "api-key-status success";
            setTimeout(() => status.textContent = "", 2000);
        }
      }
    });
  }

  if (clearBtn && input) {
    clearBtn.addEventListener("click", () => {
        localStorage.removeItem("custom_api_key");
        input.value = "";
        if (status) {
            status.textContent = "Cleared";
            status.className = "api-key-status";
        }
    });
  }

  load();
}

function applyCompactMode() {
  const toggle = document.getElementById("toggle-compact");
  const isCompact = localStorage.getItem("compact_mode") === "true";
  
  if (toggle) {
    toggle.checked = isCompact;
    toggle.addEventListener("change", (e) => {
      const val = e.target.checked;
      localStorage.setItem("compact_mode", val);
      document.body.classList.toggle("compact-mode", val);
    });
  }
  
  if (isCompact) document.body.classList.add("compact-mode");
  
  // Also internet toggle
  const internetToggle = document.getElementById("toggle-internet");
  if (internetToggle) {
      internetToggle.checked = localStorage.getItem("internet_access") === "true";
      internetToggle.addEventListener("change", (e) => {
          localStorage.setItem("internet_access", e.target.checked);
      });
  }
}

function initLogoNavigation() {
  const sidebarLogo = document.querySelector(".sidebar-logo");
  if (sidebarLogo) {
    sidebarLogo.style.cursor = "pointer";
    // Point to landing page
    sidebarLogo.addEventListener("click", () => window.location.href = "index.html");
  }
}

// === ENTRY POINT ===
window.addEventListener("load", () => {
  // Only start if we are on Chat Page
  if (document.getElementById("main-app")) {
    init().catch(console.error);
  }
});