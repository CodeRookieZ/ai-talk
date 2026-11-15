/** 消息角色：用户或 AI 助手。 */
export type MessageRole = 'user' | 'assistant';

/** 界面展示与本地持久化使用的完整消息结构。 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

/** 发送给 Chat Completions API 的消息体，仅包含接口要求的两个字段。 */
export interface ChatMessagePayload {
  role: MessageRole;
  content: string;
}
