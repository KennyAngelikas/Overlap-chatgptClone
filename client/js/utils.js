// Small utility helpers used by main.js / ui.js / api.js

// Generate a UUID v4 (browser-friendly)
export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // RFC4122 version 4 compliant
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  // fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }) + Date.now().toString(16).slice(-6);
}

// Short message id used for DOM ids
export function message_id() {
  return 'm_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36);
}

// Simple text -> safe html / newline formatting fallback (used by ui.safeMarkdownRender)
export function format(text) {
  if (text == null) return '';
  const s = String(text);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n|\r|\n/g, '<br>');
}

// Resize a textarea element to fit content (pass element)
export function resizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 800) + 'px';
}

// hex (0x..) or plain hex string to ascii
export function h2a(hex) {
  if (!hex) return '';
  // strip 0x prefix if present
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  let out = '';
  for (let i = 0; i < h.length; i += 2) {
    const byte = parseInt(h.substr(i, 2), 16);
    if (isNaN(byte)) continue;
    out += String.fromCharCode(byte);
  }
  return out;
}

// expose small shims for legacy non-module code that expects globals
if (typeof window !== 'undefined') {
  window.uuid = window.uuid || uuid;
  window.message_id = window.message_id || message_id;
  window.formatText = window.formatText || format;
  window.resizeTextarea = window.resizeTextarea || resizeTextarea;
}