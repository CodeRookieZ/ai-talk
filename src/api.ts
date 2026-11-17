import type { ChatMessagePayload } from './types';
import { loadCustomApiKey, maskApiKey } from './settings';

/** 开发环境默认走 vite.config.ts 的 /zhipu 同源代理。 */
const DEFAULT_BASE_URL = '/zhipu/api/paas/v4/chat/completions';
const DEFAULT_MODEL = 'glm-4.5-flash';
const DONE_MARKER = '[DONE]';

/** 智谱流式响应中单个分片的类型定义（仅声明用到的字段）。 */
interface SseDelta {
  role?: string;
  content?: string;
}

interface SseChoice {
  index?: number;
  delta?: SseDelta;
  finish_reason?: string | null;
}

interface SseChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: SseChoice[];
}

interface ZhipuErrorBody {
  error?: { message?: string; code?: string } | string;
  message?: string;
}

interface ApiConfig {
  apiKey: string;
  model: string;
  url: string;
}

/** 携带「是否被用户主动取消」标记的 API 错误。 */
export class ChatApiError extends Error {
  readonly cancelled: boolean;

  constructor(message: string, cancelled: boolean = false) {
    super(message);
    this.name = 'ChatApiError';
    this.cancelled = cancelled;
  }
}

export interface StreamChatOptions {
  /** 完整对话历史，按 {role, content} 传给 API。 */
  messages: ChatMessagePayload[];
  /** 每收到一段增量文本时回调。 */
  onChunk: (text: string) => void;
  /** 用于「停止生成」的取消信号。 */
  signal?: AbortSignal;
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return true;
  }
  return error instanceof Error && error.name === 'AbortError';
}

/** 密钥来源：界面自定义 / 环境变量 / 未配置。 */
export type ApiKeySource = 'custom' | 'env' | 'none';

/**
 * 安全读取环境变量中的回退密钥。
 * 显式标注可空类型并配合可选链，兼容 esbuild / Node 离线测试中
 * import.meta.env 未注入的情况，避免直接访问导致崩溃。
 */
function readEnvApiKey(): string {
  const env: { readonly VITE_ZHIPU_API_KEY?: string } | undefined = import.meta.env;
  return (env?.VITE_ZHIPU_API_KEY ?? '').trim();
}

/**
 * 动态解析最终生效的 API Key：界面自定义（LocalStorage）优先，
 * 未配置时回退环境变量 `VITE_ZHIPU_API_KEY`。
 * 每次调用都重新读取、不在模块顶层缓存，保证界面保存后下一次发送立即生效。
 */
export function getApiKey(): string {
  const customKey = loadCustomApiKey();
  if (customKey) {
    return customKey;
  }
  return readEnvApiKey();
}

/** 返回当前生效密钥的来源：界面自定义 / 环境变量 / 未配置。 */
export function getApiKeySource(): ApiKeySource {
  if (loadCustomApiKey()) {
    return 'custom';
  }
  return readEnvApiKey() ? 'env' : 'none';
}

/** 是否已配置任一来源的 API Key。 */
export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

/** 返回脱敏后的生效密钥；未配置时返回 null，绝不返回明文。 */
export function getMaskedApiKey(): string | null {
  const key = getApiKey();
  return key ? maskApiKey(key) : null;
}

/**
 * 组装请求配置：密钥由 getApiKey() 动态解析，model / url 仍取自环境变量并使用默认值；
 * 禁止硬编码密钥，缺失时给出中文提示。
 */
function resolveConfig(): ApiConfig {
  const env = import.meta.env;
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new ChatApiError(
      '尚未配置 API Key：请点击右上角「设置」填写，或在项目根目录 .env.local 中设置 VITE_ZHIPU_API_KEY 后重启开发服务器。',
    );
  }
  const model = (env.VITE_ZHIPU_MODEL ?? '').trim() || DEFAULT_MODEL;
  const url = (env.VITE_ZHIPU_BASE_URL ?? '').trim() || DEFAULT_BASE_URL;
  return { apiKey, model, url };
}

/** 将 HTTP 错误响应转换为友好的中文提示。 */
async function buildHttpErrorMessage(response: Response): Promise<string> {
  const statusMessages: Record<number, string> = {
    400: '请求参数有误，请检查模型名称或消息格式。',
    401: 'API Key 无效或已过期：请到 https://bigmodel.cn/usercenter/proj-mgmt/apikeys 检查密钥是否完整复制（现行密钥通常为 id.secret 形式）、是否已启用且未过期；更新 .env.local 后重启开发服务器。也可点击右上角「设置」直接更换密钥。',
    403: '无权访问该模型，请确认账号权限或 VITE_ZHIPU_MODEL 配置。',
    404: '接口地址不存在，请检查 VITE_ZHIPU_BASE_URL 与代理配置。',
    429: '请求过于频繁或额度不足，请稍后再试。',
    500: 'AI 服务暂时不可用，请稍后再试。',
    502: '网关异常，请检查 Vite 代理配置或稍后再试。',
    503: 'AI 服务繁忙，请稍后再试。',
  };
  let detail = '';
  try {
    const bodyText = await response.text();
    if (bodyText) {
      try {
        const body = JSON.parse(bodyText) as ZhipuErrorBody;
        if (typeof body.error === 'string') {
          detail = body.error;
        } else {
          detail = body.error?.message ?? body.message ?? '';
        }
      } catch {
        detail = bodyText.slice(0, 160);
      }
    }
  } catch {
    detail = '';
  }
  const base = statusMessages[response.status] ?? `请求失败（HTTP ${response.status}）。`;
  return detail ? `${base}（${detail.slice(0, 160)}）` : base;
}

/** 解析单行 SSE data，返回增量文本；非内容行或解析失败返回空字符串。 */
function extractDelta(dataLine: string): string {
  const line = dataLine.trim();
  if (!line || !line.startsWith('data:')) {
    return '';
  }
  const data = line.slice('data:'.length).trim();
  if (!data || data === DONE_MARKER) {
    return '';
  }
  try {
    const chunk = JSON.parse(data) as SseChunk;
    const content = chunk.choices?.[0]?.delta?.content;
    return typeof content === 'string' ? content : '';
  } catch {
    // 忽略服务端偶发的非 JSON 行或半行数据
    return '';
  }
}

function isDoneLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) {
    return false;
  }
  return trimmed.slice('data:'.length).trim() === DONE_MARKER;
}

/**
 * 调用智谱 Chat Completions 流式接口。
 * 使用 fetch + ReadableStream.getReader() + TextDecoder 手动解析 SSE，
 * 支持跨 chunk 半行缓冲、空行 / 注释行、[DONE] 边界、HTTP 错误与取消。
 * @returns 本次回答的完整文本
 * @throws {ChatApiError} 配置缺失、网络异常、HTTP 错误或读取中断
 */
export async function streamChat(options: StreamChatOptions): Promise<string> {
  const { messages, onChunk, signal } = options;
  const { apiKey, model, url } = resolveConfig();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal,
    });
  } catch (error: unknown) {
    if (isAbortError(error, signal)) {
      throw new ChatApiError('已停止生成，已生成的内容会保留。', true);
    }
    throw new ChatApiError('网络连接失败，请检查网络或 Vite 代理配置后重试。');
  }

  if (!response.ok) {
    throw new ChatApiError(await buildHttpErrorMessage(response));
  }
  if (!response.body) {
    throw new ChatApiError('当前浏览器不支持流式响应，请更换现代浏览器后重试。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  let finished = false;

  const appendDelta = (dataLine: string): void => {
    const delta = extractDelta(dataLine);
    if (delta) {
      fullText += delta;
      onChunk(delta);
    }
  };

  try {
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      // 按行切分，最后一段可能是跨 chunk 的半行，留在 buffer 中等待拼接
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (isDoneLine(line)) {
          finished = true;
          break;
        }
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) {
          continue;
        }
        appendDelta(line);
      }
    }

    // 流结束时冲刷解码器与残留 buffer（服务端未以换行结尾的最后一条 data）
    if (!finished) {
      buffer += decoder.decode();
      const tail = buffer.trim();
      if (tail.startsWith('data:') && !isDoneLine(tail)) {
        appendDelta(tail);
      }
    }
  } catch (error: unknown) {
    if (isAbortError(error, signal)) {
      throw new ChatApiError('已停止生成，已生成的内容会保留。', true);
    }
    throw new ChatApiError('读取 AI 回答时连接中断，请重试。');
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // 流已关闭时忽略
    }
  }

  return fullText;
}

/** 将任意异常转换为可直接展示的中文文案。 */
export function toFriendlyError(error: unknown): string {
  if (error instanceof ChatApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return '抱歉，服务暂时不可用，请稍后重试。';
}
