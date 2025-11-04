// Minimal API module: streaming POST to backend conversation endpoint.
// Exports streamConversation(payload, onChunk, signal) -> returns final accumulated text.

export async function streamConversation(payload, onChunk, signal) {
  const url = '/backend-api/v2/conversation';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) {
    // attempt to read response body for better error messages
    const body = await res.text().catch(() => '');
    throw new Error(`Request failed: ${res.status} ${res.statusText}${body ? ' - ' + body : ''}`);
  }

  if (!res.body) {
    throw new Error('Response has no body stream');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let finalText = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      // Basic protection: detect common HTML/CF challenge responses and convert to readable text
      const safeChunk = chunk.includes('<form id="challenge-form"') || chunk.includes('<title>Attention Required</title>')
        ? 'Error: Cloudflare/edge returned an HTML challenge. Refresh the page or check the server.'
        : chunk;

      finalText += safeChunk;

      // fire UI callback, ignore errors from the callback
      try { if (typeof onChunk === 'function') onChunk(safeChunk); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    // Propagate AbortError to allow callers to detect cancellation
    throw err;
  } finally {
    try { reader.releaseLock(); } catch (e) { /* ignore */ }
  }

  return finalText;
}