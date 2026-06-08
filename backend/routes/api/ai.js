'use strict';

const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { chatCompletion } = require('../../config/ai');

// GET /api/ai/ping — kiểm tra kết nối OpenRouter (admin only)
router.get('/ping', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await chatCompletion([
      { role: 'user', content: 'Say "OK" in one word.' }
    ], { max_tokens: 10 });

    const reply = result.choices?.[0]?.message?.content?.trim() || '(no response)';
    res.json({
      ok: true,
      model: result.model,
      reply,
      usage: result.usage,
    });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

module.exports = router;
