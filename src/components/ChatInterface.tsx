import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactElement } from 'react';
import { ChatApiError, streamChat, toFriendlyError } from '../api';
import { clearMessagesStorage, loadMessages, saveMessages } from '../storage';
import type { ChatMessagePayload, Message } from '../types';
import { createId, createMessage } from '../utils';
import { MessageBubble } from './MessageBubble';

interface Notice {
  kind: 'error' | 'info';
  text: string;
}

/** 流式期间消息防抖落盘间隔；流结束与页面卸载时会同步强制写入。 */
const SAVE_DEBOUNCE_MS = 400;

/** 微信风格聊天主界面：消息列表 + 输入区 + 状态与错误提示。 */
export function ChatInterface(): ReactElement {
  const [messages, setMessages] = useState<Message[]>(() => loadMessages());
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // 同步镜像 messages，保证流式回调与 finally 中读到的始终是最新数据
  const messagesRef = useRef<Message[]>(messages);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef<boolean>(true);
  const loadingRef = useRef<boolean>(false);

  const commitMessages = useCallback(
    (updater: (prev: Message[]) => Message[]): void => {
      const next = updater(messagesRef.current);
      messagesRef.current = next;
      setMessages(next);
    },
    [],
  );

  // 第五步：消息更新后防抖保存，避免流式期间每个 chunk 都写 LocalStorage
  useEffect(() => {
    const timer = window.setTimeout(() => saveMessages(messages), SAVE_DEBOUNCE_MS);
    return (): void => window.clearTimeout(timer);
  }, [messages]);

  // 刷新 / 关闭页面前同步写入，保证已完成内容不丢失
  useEffect(() => {
    const flush = (): void => saveMessages(messagesRef.current);
    window.addEventListener('beforeunload', flush);
    return (): void => window.removeEventListener('beforeunload', flush);
  }, []);

  // 第六步：新消息与流式更新自动滚动到底部
  useEffect(() => {
    const element = listRef.current;
    if (element && stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  const handleScroll = useCallback((): void => {
    const element = listRef.current;
    if (!element) {
      return;
    }
    stickToBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  }, []);

  const handleStop = useCallback((): void => {
    abortRef.current?.abort();
  }, []);

  /**
   * 第四步：追加用户消息 → 构造完整历史 → 调用流式 API →
   * 逐块追加到 AI 气泡；期间禁用输入并展示「思考中...」。
   */
  const handleSend = useCallback(async (): Promise<void> => {
    const text = input.trim();
    if (!text || loadingRef.current) {
      return;
    }
    loadingRef.current = true;
    setIsLoading(true);
    setNotice(null);

    const userMessage = createMessage('user', text);
    const assistantId = createId();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    commitMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    stickToBottomRef.current = true;

    // 多轮对话：把完整历史（含刚发送的用户消息）按 {role, content} 传给 API
    const history: ChatMessagePayload[] = messagesRef.current
      .filter((item) => item.id !== assistantId && item.content.trim().length > 0)
      .map(({ role, content }) => ({ role, content }));

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat({
        messages: history,
        signal: controller.signal,
        onChunk: (chunk: string): void => {
          commitMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? { ...item, content: item.content + chunk }
                : item,
            ),
          );
        },
      });
    } catch (error: unknown) {
      const cancelled = error instanceof ChatApiError && error.cancelled;
      // 用户在生成过程中清空了对话，则不再弹出提示
      if (messagesRef.current.length > 0) {
        setNotice({
          kind: cancelled ? 'info' : 'error',
          text: toFriendlyError(error),
        });
      }
    } finally {
      abortRef.current = null;
      loadingRef.current = false;
      setIsLoading(false);
      // 无条件清理「未收到任何内容」的 AI 占位气泡：
      // 首个 chunk 到达前点「停止」或请求失败时，避免留下永久空气泡并被持久化；
      // 已生成内容的消息 content 非空，会被完整保留。
      commitMessages((prev) =>
        prev.filter(
          (item) => !(item.id === assistantId && item.content.trim() === ''),
        ),
      );
      // 清理之后再同步落盘，保证内存与 LocalStorage 一致，刷新不丢已完成内容
      saveMessages(messagesRef.current);
    }
  }, [commitMessages, input]);

  const handleClear = useCallback((): void => {
    if (loadingRef.current) {
      abortRef.current?.abort();
    }
    clearMessagesStorage();
    commitMessages(() => []);
    setInput('');
    setNotice(null);
    stickToBottomRef.current = true;
  }, [commitMessages]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void handleSend();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleSend();
    }
  };

  const lastMessage = messages[messages.length - 1];
  const streamingId =
    isLoading && lastMessage?.role === 'assistant' ? lastMessage.id : null;

  return (
    <div className="flex h-full w-full flex-col bg-wechat-bg">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/5 bg-wechat-header px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-wechat-green text-sm font-semibold text-gray-800">
            AI
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">AI 聊天助手</h1>
            <p className="text-[11px] text-gray-400">
              {isLoading ? '思考中...' : '在线 · 支持 Markdown 与代码高亮'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClear}
          title="清空本地对话记录"
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800"
        >
          清空对话
        </button>
      </header>

      {notice && (
        <div
          role="status"
          className={`flex shrink-0 items-start gap-2 px-4 py-2 text-xs ${
            notice.kind === 'error'
              ? 'bg-red-50 text-red-600'
              : 'bg-amber-50 text-amber-700'
          }`}
        >
          <span className="flex-1 leading-relaxed">{notice.text}</span>
          <button
            type="button"
            onClick={(): void => setNotice(null)}
            aria-label="关闭提示"
            className="text-base leading-none opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5"
      >
        <div className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <div className="mt-20 text-center text-sm text-gray-400">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-lg font-semibold text-gray-500 shadow-sm">
                AI
              </div>
              <p>你好，我是 AI 助手，有什么可以帮你？</p>
              <p className="mt-1 text-xs">对话会自动保存在本地，刷新页面不会丢失。</p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={streamingId === message.id}
              />
            ))
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-black/5 bg-wechat-header px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-3xl items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={2}
            aria-label="消息输入框"
            placeholder={isLoading ? 'AI 正在思考中...' : '输入消息，Enter 发送，Shift + Enter 换行'}
            className="max-h-32 min-h-[46px] flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed text-gray-800 outline-none transition-colors focus:border-wechat-green focus:ring-1 focus:ring-wechat-green disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              className="h-[46px] shrink-0 rounded-lg bg-gray-600 px-5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-[46px] shrink-0 rounded-lg bg-wechat-green px-5 text-sm font-medium text-gray-800 transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              发送
            </button>
          )}
        </form>
        <p className="mx-auto mt-2 w-full max-w-3xl text-center text-[11px] text-gray-400">
          {isLoading ? '思考中... AI 正在逐字生成回答' : '内容由 AI 生成，请注意甄别'}
        </p>
      </footer>
    </div>
  );
}
