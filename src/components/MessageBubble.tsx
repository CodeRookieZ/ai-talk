import type { ReactElement } from 'react';
import type { Message } from '../types';
import { formatTime } from '../utils';
import { CopyButton } from './CopyButton';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageBubbleProps {
  message: Message;
  /** 该条 AI 消息是否正在流式生成且尚无内容。 */
  isStreaming: boolean;
}

/** 单条消息气泡：用户右对齐微信绿，AI 左对齐白色。 */
export function MessageBubble({
  message,
  isStreaming,
}: MessageBubbleProps): ReactElement {
  const isUser = message.role === 'user';
  const showThinking = isStreaming && message.content.length === 0;
  const timeLabel = formatTime(message.timestamp);

  return (
    <div
      className={`mb-5 flex w-full items-start gap-2 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold shadow-sm ${
          isUser ? 'bg-wechat-green text-gray-800' : 'bg-white text-gray-600'
        }`}
        aria-hidden="true"
      >
        {isUser ? '我' : 'AI'}
      </div>
      <div
        className={`flex max-w-[78%] flex-col ${isUser ? 'items-end' : 'items-start'}`}
      >
        <div
          className={`relative rounded-lg px-3 py-2 text-left shadow-sm ${
            isUser ? 'bg-wechat-green' : 'bg-white'
          }`}
        >
          {showThinking ? (
            <div className="flex items-center gap-1 py-0.5 text-sm text-gray-500">
              <span>思考中...</span>
              <span className="animate-pulse" aria-hidden="true">···</span>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900">
              {message.content}
            </p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
        <div
          className={`mt-1 flex items-center gap-2 px-1 text-[11px] text-gray-400 ${
            isUser ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          {timeLabel && <span>{timeLabel}</span>}
          {!isUser && !showThinking && message.content.length > 0 && (
            <CopyButton
              text={message.content}
              label="复制"
              className="text-gray-400 hover:bg-black/5 hover:text-gray-600"
            />
          )}
        </div>
      </div>
    </div>
  );
}
