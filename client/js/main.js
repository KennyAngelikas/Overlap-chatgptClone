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

let currentAbort = null;
let closeSidebarRef = null;
let appInitialized = false;
let teamStatusTimeout = null;
let teamsCache = [];

const MOCK_MODE =
  typeof location !== "undefined" &&
  location.hash &&
  location.hash.includes("local");

function ensureUserIdentity() {
  let userId = localStorage.getItem("user_id");
  if (!userId) {
    userId = `user_${uuid().slice(0, 8)}`;
    localStorage.setItem("user_id", userId);
  }
  let userEmail = localStorage.getItem("user_email");
  if (!userEmail) {
    userEmail = `${userId}@overlap.local`;
    localStorage.setItem("user_email", userEmail);
  }
  return { userId, userEmail };
}

function showStopGenerating(show) {
  const stopEl = document.getElementById("stop-generating");
  if (stopEl) stopEl.style.display = show ? "block" : "none";
}

function showLanding() {
  const landing = document.getElementById("landing-page");
  const mainApp = document.getElementById("main-app");
  if (landing) {
    landing.style.display = "flex";
    landing.classList.remove("hidden");
  }
  if (mainApp) mainApp.style.display = "none";
}

function showChat() {
  const landing = document.getElementById("landing-page");
  const mainApp = document.getElementById("main-app");
  if (landing) landing.style.display = "none";
  if (mainApp) {
    mainApp.style.display = "flex";
    mainApp.classList.add("visible");
  }
  localStorage.setItem("overlap_seen_landing", "true");
  startApp();
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
  const container =
    document.getElementById("team-list") ||
    document.getElementById("teams-placeholder");
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
    teamsCache.sort((a, b) => {
      const aNum = Number(a.id);
      const bNum = Number(b.id);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
      return `${a.id}`.localeCompare(`${b.id}`);
    });
  } catch (err) {
    teamsCache = [];
  }
  renderTeamsList(teamsCache);
}

function openCreateTeamModal() {
  const modal = document.getElementById("team-modal");
  const nameInput = document.getElementById("team-modal-name");
  if (!modal) return;
  modal.classList.add("active");
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
    const err = document.getElementById("team-modal-error");
    const nameInput = document.getElementById("team-modal-name");
    const sizeInput = document.getElementById("team-modal-size");
    if (err) err.textContent = "";
    if (nameInput) nameInput.value = "";
    if (sizeInput) sizeInput.value = "";
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
  if (rawLimit && (!Number.isInteger(memberLimit) || memberLimit < 1)) {
    if (errorEl) errorEl.textContent = "Member count must be a positive number.";
    return;
  }

  if (errorEl) errorEl.textContent = "";
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Creating...";
  }

  try {
    const result = await createTeamRecord(name, memberLimit);
    if (!result.success || !result.team) {
      throw new Error(result.error || "Unable to create team.");
    }
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
    if (!result.success) throw new Error(result.error || "Unable to join team.");
    localStorage.setItem("team_id", selectedId);
    showTeamStatus(
      `You have joined ${selectedTeam?.name || "this team"}`,
      "success"
    );
    updateJoinButtonLabel(true);
  } catch (err) {
    showTeamStatus(err.message || "Could not join team.", "error");
  } finally {
    if (joinBtn) joinBtn.disabled = false;
  }
}

function initTeamsPanel() {
  const createBtn = document.getElementById("create-team-button");
  const joinBtn = document.getElementById("join-team-button");
  const cancelBtn = document.getElementById("team-modal-cancel");
  const confirmBtn = document.getElementById("team-modal-confirm");
  const overlay = document.getElementById("team-modal-overlay");

  if (createBtn) createBtn.addEventListener("click", openCreateTeamModal);
  if (joinBtn) joinBtn.addEventListener("click", handleJoinSelectedTeam);
  if (cancelBtn) cancelBtn.addEventListener("click", () => closeCreateTeamModal(true));
  if (overlay) overlay.addEventListener("click", () => closeCreateTeamModal(true));
  if (confirmBtn) confirmBtn.addEventListener("click", handleCreateTeamSubmit);

  refreshTeams();
}

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
        internet_access: document.getElementById("switch")?.checked || false,
        content_type: "text",
        parts: [{ content: text, role: "user" }],
      },
    },
  };

  showStopGenerating(true);

  let acc = "";
  if (MOCK_MODE) {
    const simulated = `Echo: ${text}\n\n(This is a local UI-only simulated response.)`;
    const chunks = [];
    for (let i = 0; i < simulated.length; i += 20)
      chunks.push(simulated.slice(i, i + 20));

    try {
      for (const c of chunks) {
        if (currentAbort && currentAbort.signal.aborted)
          throw new DOMException("Aborted", "AbortError");
        await new Promise((r) => setTimeout(r, 120));
        acc += c;
        renderAssistantChunk(token, acc);
      }
      store.addMessage(convId, "assistant", acc);
      updateMessageCount((await store.getConversation(convId)).messages.length);
    } catch (err) {
      if (err.name === "AbortError") {
        renderAssistantChunk(token, acc + " [aborted]");
      } else {
        showError("Local mock failed");
        console.error(err);
        renderAssistantChunk(token, acc + " [error]");
      }
    } finally {
      currentAbort = null;
      showStopGenerating(false);
      scrollToBottom(true);
    }
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
      showError("Failed to get response from server");
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
        setActiveConversation(window.conversation_id);
      }
    },
    onShowOption: () => {},
  };

  if (listEl) {
    const list = await store.listConversations();
    renderConversationList(listEl, list, handlers);
    if (window.conversation_id) setActiveConversation(window.conversation_id);
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
      store.addConversation(id, "New chat");
      clearMessages();
      const list = await store.listConversations();
      if (listEl) {
        renderConversationList(listEl, list, handlers);
        setActiveConversation(id);
      }
      if (inputEl) {
        try {
          inputEl.focus();
        } catch (e) {}
      }
    });
  }

  const clearBtn = document.getElementById("clear-conversations-button");
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      store.clearConversations();
      clearMessages();
      if (listEl) renderConversationList(listEl, [], handlers);
      updateMessageCount(0);
    });
  }

  initTeamsPanel();
  initMobileSidebar();
  initStopGeneratingButton();
  initApiKeySettings();
  initLogoNavigation();
}

function initMobileSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("mobile-overlay");
  const openBtn = document.getElementById("mobile-menu-btn");
  const closeBtn = document.getElementById("sidebar-close-btn");

  if (!sidebar || !overlay) return;

  function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("active");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  }

  closeSidebarRef = closeSidebar;

  if (openBtn) openBtn.addEventListener("click", openSidebar);
  if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);
}

function initStopGeneratingButton() {
  const cancelBtn = document.getElementById("cancelButton");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => showStopGenerating(false));
  }
  showStopGenerating(false);
}

function initApiKeySettings() {
  const settingsToggle = document.getElementById("settings-toggle-button");
  const settingsContent = document.getElementById("settings-content");
  const settingsChevron = document.getElementById("settings-chevron");
  const apiKeyInput = document.getElementById("api-key-input");
  const saveBtn = document.getElementById("save-api-key-button");
  const clearBtn = document.getElementById("clear-api-key-button");
  const statusDiv = document.getElementById("api-key-status");
  const panel = document.getElementById("settings-panel");

  const savedApiKey = localStorage.getItem("custom_api_key");
  if (savedApiKey && apiKeyInput) {
    apiKeyInput.value = savedApiKey;
    apiKeyInput.style.borderColor = "var(--primary)";
    panel?.classList.add("has-key");
  }

  if (settingsToggle && settingsContent) {
    settingsToggle.addEventListener("click", () => {
      const isHidden = settingsContent.style.display === "none";
      settingsContent.style.display = isHidden ? "block" : "none";
      if (settingsChevron) {
        settingsChevron.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
      }
    });
  }

  if (saveBtn && apiKeyInput) {
    saveBtn.addEventListener("click", () => {
      const apiKey = apiKeyInput.value.trim();
      if (apiKey) {
        localStorage.setItem("custom_api_key", apiKey);
        apiKeyInput.style.borderColor = "var(--primary)";
        panel?.classList.add("has-key");
        showApiKeyStatus(statusDiv, "API key saved successfully", "success");
      } else {
        apiKeyInput.style.borderColor = "";
        panel?.classList.remove("has-key");
        showApiKeyStatus(statusDiv, "Please enter an API key", "error");
      }
    });
  }

  if (clearBtn && apiKeyInput) {
    clearBtn.addEventListener("click", () => {
      apiKeyInput.value = "";
      apiKeyInput.style.borderColor = "";
      panel?.classList.remove("has-key");
      localStorage.removeItem("custom_api_key");
      showApiKeyStatus(statusDiv, "API key cleared", "success");
    });
  }
}

function showApiKeyStatus(node, message, type) {
  if (!node) return;
  node.textContent = message;
  node.className = `api-key-status ${type}`;
  setTimeout(() => {
    node.textContent = "";
    node.className = "api-key-status";
  }, 2500);
}

function startApp() {
  if (!appInitialized) {
    init().catch(console.error);
  }
  const landing = document.getElementById("landing-page");
  const mainApp = document.getElementById("main-app");
  if (landing) landing.style.display = "none";
  if (mainApp) {
    mainApp.style.display = "flex";
    mainApp.classList.add("visible");
  }
}

function initLogoNavigation() {
  const landingLogo = document.getElementById("landing-logo");
  const sidebarLogo = document.querySelector(".sidebar-logo");

  if (landingLogo) {
    landingLogo.style.cursor = "pointer";
    landingLogo.addEventListener("click", showLanding);
  }
  if (sidebarLogo) {
    sidebarLogo.style.cursor = "pointer";
    sidebarLogo.addEventListener("click", showLanding);
  }
}

function initLandingPage() {
  const landing = document.getElementById("landing-page");
  const mainApp = document.getElementById("main-app");
  const startBtn = document.getElementById("start-chatting-btn");
  const hasVisited = localStorage.getItem("overlap_seen_landing");

  if (hasVisited) {
    showChat();
    return;
  }

  if (startBtn) {
    startBtn.addEventListener("click", showChat);
  } else {
    startApp();
  }
}

window.addEventListener("load", () => {
  initLandingPage();
});
