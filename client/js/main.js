// Minimal entrypoint (ES module) — wires UI to api/store/ui/utils modules.

import { streamConversation } from './api.js';
import * as store from './store.js';
import {
  renderUserMessage,
  createAssistantPlaceholder,
  renderAssistantChunk,
  clearMessages,
  showError,
  scrollToBottom,
  renderConversationList,
} from './ui.js';
import { message_id, uuid, resizeTextarea } from './utils.js';

let currentAbort = null;

// Enable a client-side mock mode for testing the UI without a backend/API key.
// Activate by visiting the app URL with `#local` (e.g. http://localhost:1338/chat/#local)
const MOCK_MODE = (typeof location !== 'undefined' && location.hash && location.hash.includes('local'));

async function handleSend() {
  const inputEl = document.getElementById('message-input');
  if (!inputEl) return;
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = '';
  resizeTextarea(inputEl);

  const convId = window.conversation_id || uuid();
  store.addConversation(convId, convId);
  store.addMessage(convId, 'user', text);

  const token = message_id();
  renderUserMessage(token, text);

  createAssistantPlaceholder(token);

  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();

  const payload = {
    conversation_id: convId,
    action: '_ask',
    model: document.getElementById('model')?.value || 'default',
    jailbreak: document.getElementById('jailbreak')?.value || 'false',
    meta: {
      id: message_id(),
      content: {
        conversation: (await store.getConversation(convId)).messages,
        internet_access: document.getElementById('switch')?.checked || false,
        content_type: 'text',
        parts: [ { content: text, role: 'user' } ],
      },
    },
  };
  // If MOCK_MODE is active, simulate a streaming assistant response locally
  let acc = '';
  if (MOCK_MODE) {
    const simulated = `Echo: ${text}\n\n(This is a local UI-only simulated response.)`;
    // simulate streaming in small chunks
    const chunks = [];
    for (let i = 0; i < simulated.length; i += 20) chunks.push(simulated.slice(i, i + 20));

    try {
      for (const c of chunks) {
        if (currentAbort && currentAbort.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        await new Promise(r => setTimeout(r, 120));
        acc += c;
        renderAssistantChunk(token, acc);
      }
      store.addMessage(convId, 'assistant', acc);
    } catch (err) {
      if (err.name === 'AbortError') {
        renderAssistantChunk(token, acc + ' [aborted]');
      } else {
        showError('Local mock failed');
        console.error(err);
        renderAssistantChunk(token, acc + ' [error]');
      }
    } finally {
      currentAbort = null;
      // force scroll at end so user sees final content
      scrollToBottom(true);
    }
    return;
  }

  try {
    await streamConversation(payload, (chunk) => {
      acc += chunk;
      renderAssistantChunk(token, acc);
    }, currentAbort.signal);

    store.addMessage(convId, 'assistant', acc);
  } catch (err) {
    if (err.name === 'AbortError') {
      renderAssistantChunk(token, acc + ' [aborted]');
    } else {
      showError('Failed to get response from server');
      console.error(err);
      renderAssistantChunk(token, acc + ' [error]');
    }
  } finally {
    currentAbort = null;
    scrollToBottom();
  }
}

function handleCancel() {
  if (currentAbort) currentAbort.abort();
}

async function setConversation(id, conv) {
  window.conversation_id = id;
  clearMessages();
  if (!conv) conv = await store.getConversation(id);
  for (const m of conv.messages) {
    if (m.role === 'user') {
      const t = message_id();
      renderUserMessage(t, m.content);
    } else {
      const t = message_id();
      createAssistantPlaceholder(t);
      renderAssistantChunk(t, m.content);
    }
  }
}

export async function init() {
  const sendBtn = document.getElementById('send-button');
  const cancelBtn = document.getElementById('cancelButton');
  const inputEl = document.getElementById('message-input');

  if (sendBtn) sendBtn.addEventListener('click', () => handleSend());
  if (cancelBtn) cancelBtn.addEventListener('click', () => handleCancel());
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  // render into the dedicated list container; this keeps the New Conversation
  // button and spinner intact (they live in #conversations)
  const listEl = document.getElementById('conversation-list') || document.getElementById('conversations');
  const handlers = {
    onSelect: async (id) => {
      const c = await store.getConversation(id);
      if (c) setConversation(id, c);
    },
    onDelete: async (id) => {
      await store.deleteConversation(id);
      const l2 = await store.listConversations();
      if (listEl) renderConversationList(listEl, l2, handlers);
    },
    onShowOption: (id) => {
      console.log('show options for', id);
    }
  };

  if (listEl) {
    const list = await store.listConversations();
    renderConversationList(listEl, list, handlers);
  }

  // focus the input so mobile/desktop shows the input area immediately
  if (inputEl) {
    try { inputEl.focus(); } catch(e) { /* ignore */ }
  }

  // wire header buttons that previously used inline onclick attributes
  const newBtn = document.getElementById('new-convo-button');
  if (newBtn) {
    newBtn.addEventListener('click', async () => {
      const id = uuid();
      window.conversation_id = id;
      store.addConversation(id, id);
      clearMessages();
      const list = await store.listConversations();
      if (listEl) renderConversationList(listEl, list, handlers);
      // focus input after creating a new conversation
      if (inputEl) { try { inputEl.focus(); } catch(e) {} }
    });
  }

  const clearBtn = document.getElementById('clear-conversations-button');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      store.clearConversations();
      clearMessages();
      if (listEl) renderConversationList(listEl, [], handlers);
    });
  }
}

// auto-init on load
window.addEventListener('load', () => { init().catch(console.error); });