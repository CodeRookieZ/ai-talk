/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 智谱 AI API Key（仅本地开发使用，生产应由后端代理持有）。 */
  readonly VITE_ZHIPU_API_KEY?: string;
  /** 模型名称，默认 glm-4.5-flash。 */
  readonly VITE_ZHIPU_MODEL?: string;
  /** 接口完整地址，默认 /zhipu/api/paas/v4/chat/completions。 */
  readonly VITE_ZHIPU_BASE_URL?: string;
}
