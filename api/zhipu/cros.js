// api/zhipu/[...path].js
export const config = { runtime: 'edge' }; // 流式传输需要 Edge Runtime

export default async function handler(req) {
  // 处理 CORS 预检
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 构建智谱 API 的真实地址
  const url = new URL(req.url);
  // 将 /zhipu/api/paas/v4/... 映射为 https://open.bigmodel.cn/api/paas/v4/...
  const upstreamPath = url.pathname.replace(/^\/api\/zhipu/, '');
  const upstreamUrl = `https://open.bigmodel.cn${upstreamPath}`;

  const body = await req.text();

  const upstreamResp = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`, // 密钥仅在服务端使用
    },
    body,
  });

  // 流式回传响应（保留 SSE）
  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: {
      'Content-Type': upstreamResp.headers.get('content-type') || 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}