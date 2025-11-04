// UI helpers used by main.js: renderUserMessage, createAssistantPlaceholder,
// renderAssistantChunk, clearMessages, showError, scrollToBottom

function getMessagesBox() {
  return document.getElementById('messages');
}

function safeMarkdownRender(text) {
  if (window.markdownit) {
    try { return window.markdownit().render(text); } catch (e) { /* fallthrough */ }
  }
  // very small fallback: escape HTML and replace newlines
  const esc = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc.replace(/\n/g, '<br>');
}

// scrollToBottom(force=false)
// If force is true, always jump to bottom. If force is false (default), only
// auto-scroll when the user is already near the bottom — this lets users
// scroll up to read previous messages without the UI fighting their scroll.
export function scrollToBottom(force = false) {
  const box = getMessagesBox();
  if (!box) return;
  try {
    // Only auto-scroll when the messages container actually overflows (i.e.
    // there is content to scroll). This prevents forcing scroll when the
    // content fits the container (common on initial render).
    if (box.scrollHeight <= box.clientHeight && !force) return;

    const distanceFromBottom = box.scrollHeight - (box.scrollTop + box.clientHeight);
    // if user is within 120px of the bottom, consider them "at bottom" and
    // auto-scroll. Otherwise, don't change their scroll position unless forced.
    if (force || distanceFromBottom < 120) {
      box.scrollTop = box.scrollHeight;
    }
  } catch (e) {
    // fallback to always scrolling if something unexpected happens
    box.scrollTop = box.scrollHeight;
  }
}

export function clearMessages() {
  const box = getMessagesBox();
  if (!box) return;
  box.innerHTML = '';
}

export function renderUserMessage(token, text, user_image_html = '') {
  const box = getMessagesBox();
  if (!box) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'message user';
  wrapper.id = `user_${token}`;
  wrapper.innerHTML = `
    <div class="avatar">${user_image_html}</div>
    <div class="content">${safeMarkdownRender(text)}</div>
  `;
  box.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

export function createAssistantPlaceholder(token, gpt_image_html = '') {
  const box = getMessagesBox();
  if (!box) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'message assistant';
  wrapper.id = `gpt_${token}`;
  // store accumulated text in data attribute
  wrapper.dataset.text = '';
  wrapper.innerHTML = `
    <div class="avatar">${gpt_image_html}</div>
    <div class="content"><span class="cursor">▌</span></div>
  `;
  box.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

export function renderAssistantChunk(token, chunk) {
  const el = document.getElementById(`gpt_${token}`);
  if (!el) return;
  // accumulate plain text
  const prev = el.dataset.text || '';
  const combined = prev + (chunk || '');
  el.dataset.text = combined;
  // render markdown/html
  el.querySelector('.content').innerHTML = safeMarkdownRender(combined);
  // syntax highlight if hljs is present
  try {
    if (window.hljs) {
      el.querySelectorAll('pre code').forEach(block => {
        try { window.hljs.highlightElement(block); } catch (e) { /* ignore */ }
      });
    }
  } catch (e) { /* ignore */ }
  scrollToBottom();
}

export function showError(message) {
  const box = getMessagesBox();
  if (!box) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'message error';
  wrapper.innerText = message;
  box.appendChild(wrapper);
  scrollToBottom();
}

// Render a conversation list into a container element using programmatic
// event listeners (replaces inline onclick HTML generation).
// conversations: array of { id, title, messages }
// handlers: { onSelect(id), onDelete(id), onShowOption(id), onHideOption(id) }
export function renderConversationList(container, conversations, handlers = {}) {
  if (!container) return;
  container.innerHTML = '';
  // ensure the container has a predictable layout for the list
  container.classList.add('conversation-list-items');
  // if there are no conversations, show a small placeholder so users
  // can tell the list is intentionally empty (and the New Conversation
  // button above remains visible).
  if (!Array.isArray(conversations) || conversations.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'no-convos';
    empty.textContent = 'No conversations yet — click "New Conversation" to start.';
    container.appendChild(empty);
    return;
  }
  conversations.forEach((conv) => {
    const id = conv.id;
    const item = document.createElement('div');
    item.className = 'convo';
    item.id = `convo-${id}`;

    // left column (click selects conversation)
    const left = document.createElement('div');
    left.className = 'left';
    const icon = document.createElement('i');
    icon.className = 'fa-regular fa-comments';
    left.appendChild(icon);
    const span = document.createElement('span');
    span.className = 'convo-title';
    span.textContent = conv.title || id;
    left.appendChild(span);
    item.appendChild(left);

    // action icons (trash, confirm, cancel)
    const trash = document.createElement('i');
    trash.className = 'fa-regular fa-trash';
    trash.id = `conv-${id}`;
    item.appendChild(trash);

    const yes = document.createElement('i');
    yes.className = 'fa-regular fa-check';
    yes.id = `yes-${id}`;
    yes.style.display = 'none';
    item.appendChild(yes);

    const no = document.createElement('i');
    no.className = 'fa-regular fa-x';
    no.id = `not-${id}`;
    no.style.display = 'none';
    item.appendChild(no);

    // wire events
    left.addEventListener('click', (e) => {
      if (handlers.onSelect) handlers.onSelect(id);
    });

    trash.addEventListener('click', (e) => {
      e.stopPropagation();
      // show confirm icons
      trash.style.display = 'none';
      yes.style.display = 'inline-block';
      no.style.display = 'inline-block';
      if (handlers.onShowOption) handlers.onShowOption(id);
    });

    yes.addEventListener('click', (e) => {
      e.stopPropagation();
      if (handlers.onDelete) handlers.onDelete(id);
    });

    no.addEventListener('click', (e) => {
      e.stopPropagation();
      // hide confirm icons
      trash.style.display = 'inline-block';
      yes.style.display = 'none';
      no.style.display = 'none';
      if (handlers.onHideOption) handlers.onHideOption(id);
    });

    container.appendChild(item);
  });
}

// Additional functions or exports can go here