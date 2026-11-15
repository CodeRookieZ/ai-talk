import type { Message, MessageRole } from './types';
import { createId } from './utils';

/** LocalStorage 键名，带版本号便于后续结构升级。 */
export const STORAGE_KEY = 'ai-talk:messages:v1';

function isMessageRole(value: unknown): value is MessageRole {
  return value === 'user' || value === 'assistant';
}

/** 校验并归一化单条历史消息，非法数据返回 null。 */
function parseMessage(value: unknown): Message | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (!isMessageRole(raw.role) || typeof raw.content !== 'string') {
    return null;
  }
  const timestamp =
    typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)
      ? raw.timestamp
      : Date.now();
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : createId();
  return { id, role: raw.role, content: raw.content, timestamp };
}

/** 读取历史消息；JSON 损坏、结构异常或存储不可用时安全返回空数组。 */
export function loadMessages(): Message[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item: unknown) => parseMessage(item))
      .filter(
        (message: Message | null): message is Message =>
          message !== null &&
          // 清理历史脏数据：早期版本在「停止生成」时可能持久化了空的 AI 占位消息
          !(message.role === 'assistant' && message.content.trim() === ''),
      );
  } catch {
    return [];
  }
}

/** 写入历史消息；隐私模式或配额不足时静默失败，不影响聊天。 */
export function saveMessages(messages: Message[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // 存储不可用时忽略
  }
}

/** 清空历史消息存储。 */
export function clearMessagesStorage(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 存储不可用时忽略
  }
}
