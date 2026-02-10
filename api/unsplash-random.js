// Vercel serverless: GET /api/unsplash-random
// Set UNSPLASH_ACCESS_KEY in Vercel env. Returns { url } for extension background.
const UNSPLASH_API = 'https://api.unsplash.com/photos/random';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return res.status(500).json({ error: 'Server not configured' });
  try {
    const apiRes = await fetch(
      `${UNSPLASH_API}?query=nature%20landscape&orientation=landscape`,
      { headers: { 'Authorization': `Client-ID ${key}` } }
    );
    if (!apiRes.ok) return res.status(apiRes.status).json({ error: 'Upstream error' });
    const data = await apiRes.json();
    const raw = data.urls?.raw;
    if (!raw) return res.status(502).json({ error: 'No image URL' });
    const w = 1920;
    const url = `${raw}&w=${w}&fit=crop&q=80`;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'private, max-age=0');
    return res.status(200).json({ url });
  } catch (e) {
    return res.status(502).json({ error: 'Proxy error' });
  }
}
