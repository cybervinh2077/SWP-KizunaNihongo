'use strict';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

async function chatCompletion(messages, options = {}) {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
      'X-Title': 'Kizuna Nihongo',
    },
    body: JSON.stringify({
      model: options.model || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
      messages,
      max_tokens: options.max_tokens || 1024,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `OpenRouter error ${res.status}`);
  }

  return res.json();
}

module.exports = { chatCompletion };
