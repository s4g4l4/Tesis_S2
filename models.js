// Mengambil daftar model NVIDIA terbaru dari build.nvidia.com / integrate.api.nvidia.com
export default async function handler(req, res) {
  try {
    let b = req.body; if (typeof b === 'string') b = JSON.parse(b);
    const h = b?.key ? { Authorization: 'Bearer ' + b.key } : {};
    const r = await fetch('https://integrate.api.nvidia.com/v1/models', { headers: h, signal: AbortSignal.timeout(20000) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    if (!r.ok || !j) return res.status(502).json({ error: `Gagal memuat model NVIDIA (${r.status})` });
    res.status(200).json({ models: (j.data || []).map(m => m.id).sort() });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
