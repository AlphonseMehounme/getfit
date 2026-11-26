import type { Send } from './sync-client';

// P4-04 / D89: the outbox's real `send`. A network error throws on its own; any answer but 2xx throws too, so the
// writes stay on the device (the client counts an attempt).
export const sendToServer: Send = async (request) => {
  const response = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`sync answered ${response.status}`);
  return response.json();
};
