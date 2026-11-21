export const config = { runtime: 'edge' };

export default async function handler(req) {
  console.log('[zhipu-proxy] handler invoked, method =', req.method);

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const upstreamPath = url.pathname.replace(/^\/api\/zhipu/, '');
    const upstreamUrl = `https://open.bigmodel.cn${upstreamPath}`;
    console.log('[zhipu-proxy] upstreamUrl =', upstreamUrl);

    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: { message: 'ZHIPU_API_KEY is not set in environment' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.text();
    const upstreamResp = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body,
    });

    console.log('[zhipu-proxy] upstream status =', upstreamResp.status);

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      headers: {
        'Content-Type': upstreamResp.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e) {
    console.error('[zhipu-proxy] error:', String(e && e.message || e), e && e.stack);
    return new Response(
      JSON.stringify({ error: { message: String(e && e.message || e) } }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}