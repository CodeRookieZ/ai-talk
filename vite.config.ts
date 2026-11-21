import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 开发环境通过同源反向代理转发智谱 API，绕开浏览器 CORS 限制。
 * 请求 /zhipu/api/paas/v4/chat/completions 会被转发到
 * https://open.bigmodel.cn/api/paas/v4/chat/completions。
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    // 端口被占用时直接报错，避免静默漂移到其它端口导致自测命中无关服务
    strictPort: true,
    proxy: {
      '/api/zhipu': {
        target: 'https://open.bigmodel.cn',
        changeOrigin: true,
        secure: true,
        rewrite: (path: string): string => path.replace(/^\/api\/zhipu/, ''),
      },
    },
  },
});
