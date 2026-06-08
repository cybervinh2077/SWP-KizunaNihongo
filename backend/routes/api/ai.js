'use strict';

const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { chatCompletion } = require('../../config/ai');

// GET /api/ai/ping
router.get('/ping', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await chatCompletion([{ role: 'user', content: 'Say "OK" in one word.' }], { max_tokens: 10 });
    res.json({ ok: true, model: result.model, reply: result.choices?.[0]?.message?.content?.trim() });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// POST /api/ai/check-json
// Body: { type: 'vocab'|'kanji', items: [...] }
// Returns: { items: [...with _notes, _changed], summary }
router.post('/check-json', requireAuth, requireAdmin, async (req, res) => {
  const { type, items } = req.body;
  if (!['vocab', 'kanji'].includes(type)) return res.status(400).json({ error: 'type phải là vocab hoặc kanji.' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items phải là mảng không rỗng.' });
  if (items.length > 50) return res.status(400).json({ error: 'Chỉ kiểm tra tối đa 50 mục một lần.' });

  const systemPrompt = type === 'vocab'
    ? `Bạn là chuyên gia tiếng Nhật. Nhiệm vụ: kiểm tra và sửa mảng JSON từ vựng tiếng Nhật.
Với mỗi từ, hãy:
1. Sửa reading (furigana) nếu sai so với kanji
2. Sửa lỗi chính tả trong meaning_vi (tiếng Việt)
3. Bổ sung level phù hợp nếu thiếu (N5/N4/N3/N2/N1)
4. Bổ sung type phù hợp nếu thiếu (DANH TỪ/ĐỘNG TỪ/TÍNH TỪ/PHÓ TỪ/LIÊN TỪ)
5. Sửa example_sentence nếu sai ngữ pháp
6. Thêm trường "_notes" giải thích ngắn những thay đổi (tiếng Việt). Nếu không thay đổi gì thì "_notes" = ""
7. Thêm "_changed": true nếu có bất kỳ thay đổi nào, ngược lại false

Trả về ĐÚNG mảng JSON gốc với các trường đã sửa. Không thêm trường nào khác ngoài _notes và _changed. Không giải thích gì ngoài JSON.`
    : `Bạn là chuyên gia tiếng Nhật. Nhiệm vụ: kiểm tra và sửa mảng JSON kanji tiếng Nhật.
Với mỗi kanji, hãy:
1. Kiểm tra reading_on (on-yomi, katakana) — sửa nếu sai
2. Kiểm tra reading_kun (kun-yomi, hiragana) — sửa nếu sai
3. Sửa lỗi chính tả trong meaning_vi (tiếng Việt)
4. Bổ sung level phù hợp nếu thiếu (N5/N4/N3/N2/N1)
5. Sửa stroke_count nếu sai
6. Thêm "_notes" giải thích ngắn những thay đổi (tiếng Việt). Nếu không thay đổi gì thì "_notes" = ""
7. Thêm "_changed": true nếu có bất kỳ thay đổi nào, ngược lại false

Trả về ĐÚNG mảng JSON gốc với các trường đã sửa. Không thêm trường nào khác ngoài _notes và _changed. Không giải thích gì ngoài JSON.`;

  const userPrompt = `Kiểm tra và sửa mảng JSON sau:\n${JSON.stringify(items, null, 2)}`;

  try {
    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { max_tokens: 4096, temperature: 0.2 }
    );

    const raw = result.choices?.[0]?.message?.content || '';

    // Extract JSON array from response (model may wrap in markdown)
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return res.status(502).json({ error: 'AI không trả về JSON hợp lệ.', raw: raw.slice(0, 500) });

    let checked;
    try { checked = JSON.parse(match[0]); }
    catch { return res.status(502).json({ error: 'Không thể parse JSON từ AI.', raw: raw.slice(0, 500) }); }

    const changedCount = checked.filter(i => i._changed).length;
    res.json({
      items: checked,
      summary: `Đã kiểm tra ${checked.length} mục. ${changedCount > 0 ? `AI đề xuất sửa ${changedCount} mục.` : 'Không phát hiện lỗi nào.'}`,
      usage: result.usage,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
