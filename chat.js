// Proxy server-side: selalu membalas JSON (mencegah error "Unexpected token 'T'..." di browser)
const out = (res, code, obj) => res.status(code).json(obj);

async function up(url, opt) {
  const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(55000) });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch {}
  if (!r.ok) {
    const m = j?.error?.message || (typeof j?.error === 'string' ? j.error : '') || j?.detail || j?.message || t.slice(0, 200);
    throw new Error(`Penyedia AI membalas ${r.status}: ${m}`);
  }
  if (!j) throw new Error('Respons penyedia AI bukan JSON: ' + t.slice(0, 100));
  return j;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return out(res, 405, { error: 'Gunakan metode POST' });
    let b = req.body;
    if (typeof b === 'string') b = JSON.parse(b);
    const { provider, model, key, system = '', prompt, maxTokens = 2000, temperature = 0.7 } = b || {};
    if (!key) return out(res, 400, { error: 'API key belum diisi untuk bagian ini' });
    if (!model) return out(res, 400, { error: 'Model belum dipilih' });
    if (!prompt) return out(res, 400, { error: 'Prompt kosong' });
    const H = { 'Content-Type': 'application/json' };
    let text = '';

    if (provider === 'openai' || provider === 'nvidia') {
      const url = provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://integrate.api.nvidia.com/v1/chat/completions';
      const j = await up(url, {
        method: 'POST', headers: { ...H, Authorization: 'Bearer ' + key },
        body: JSON.stringify({ model, temperature, max_tokens: maxTokens,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] })
      });
      text = j.choices?.[0]?.message?.content || '';
    } else if (provider === 'claude') {
      const j = await up('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { ...H, 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system,
          messages: [{ role: 'user', content: prompt }] })
      });
      text = (j.content || []).map(c => c.text || '').join('');
    } else if (provider === 'gemini') {
      const j = await up(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { ...H, 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens } })
      });
      text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    } else return out(res, 400, { error: 'Penyedia tidak dikenal: ' + provider });

    if (!text) return out(res, 502, { error: 'AI tidak mengembalikan teks (mungkin diblokir atau token habis)' });
    return out(res, 200, { text });
  } catch (e) {
    return out(res, 500, { error: e.name === 'TimeoutError' ? 'Waktu habis (60 dtk). Coba model lebih cepat atau kurangi panjang.' : e.message });
  }
}
