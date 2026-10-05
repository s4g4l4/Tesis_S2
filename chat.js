// Vercel Serverless Function: proxy ke ChatGPT, Claude, Gemini, NVIDIA.
// API key dikirim dari browser per permintaan dan TIDAK disimpan di server.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Gunakan POST" });
  const { provider, model, apiKey, system, prompt } = req.body || {};
  if (!provider || !model || !apiKey || !prompt)
    return res.status(400).json({ error: "provider, model, apiKey, prompt wajib diisi" });
  try {
    let url, headers = { "Content-Type": "application/json" }, body, pick;
    if (provider === "openai" || provider === "nvidia") {
      url = provider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://integrate.api.nvidia.com/v1/chat/completions";
      headers.Authorization = `Bearer ${apiKey}`;
      body = { model, max_tokens: 2000, messages: [
        { role: "system", content: system || "" }, { role: "user", content: prompt }] };
      pick = d => d.choices?.[0]?.message?.content;
    } else if (provider === "anthropic") {
      url = "https://api.anthropic.com/v1/messages";
      headers["x-api-key"] = apiKey; headers["anthropic-version"] = "2023-06-01";
      body = { model, max_tokens: 2000, system: system || "", messages: [{ role: "user", content: prompt }] };
      pick = d => d.content?.map(c => c.text || "").join("");
    } else if (provider === "gemini") {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      headers["x-goog-api-key"] = apiKey;
      body = { systemInstruction: { parts: [{ text: system || "" }] },
               contents: [{ role: "user", parts: [{ text: prompt }] }] };
      pick = d => d.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("");
    } else return res.status(400).json({ error: "Provider tidak dikenal" });

    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || JSON.stringify(data) });
    res.status(200).json({ text: pick(data) || "(respons kosong)" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
