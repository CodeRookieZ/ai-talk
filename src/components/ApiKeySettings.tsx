import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { getApiKeySource, getMaskedApiKey } from '../api';
import type { ApiKeySource } from '../api';
import {
  API_KEY_STORAGE_KEY,
  clearCustomApiKey,
  hasCustomApiKey,
  saveCustomApiKey,
} from '../settings';

interface ApiKeySettingsProps {
  /** 关闭面板。 */
  onClose: () => void;
  /** 保存 / 清除成功后通知主界面刷新来源状态。 */
  onChanged: () => void;
}

interface Feedback {
  kind: 'ok' | 'error';
  text: string;
}

/** 密钥来源的中文标签。 */
const SOURCE_LABELS: Record<ApiKeySource, string> = {
  custom: '界面自定义',
  env: '环境变量',
  none: '未配置',
};

const API_KEY_HELP_URL = 'https://bigmodel.cn/usercenter/proj-mgmt/apikeys';

/**
 * API Key 设置模态面板：填写 / 覆盖 / 清除界面自定义密钥。
 * 输入框永远不回填完整密钥，仅通过 placeholder 与脱敏值提示当前状态。
 */
export function ApiKeySettings({ onClose, onChanged }: ApiKeySettingsProps): ReactElement {
  const [draft, setDraft] = useState<string>('');
  const [visible, setVisible] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [source, setSource] = useState<ApiKeySource>(() => getApiKeySource());
  const [masked, setMasked] = useState<string | null>(() => getMaskedApiKey());
  const [customExists, setCustomExists] = useState<boolean>(() => hasCustomApiKey());
  const inputRef = useRef<HTMLInputElement | null>(null);

  /** 重新读取 api.ts 暴露的状态，供保存 / 清除 / 跨标签页同步后刷新展示。 */
  const refreshStatus = useCallback((): void => {
    setSource(getApiKeySource());
    setMasked(getMaskedApiKey());
    setCustomExists(hasCustomApiKey());
  }, []);

  // 打开时自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 按 Esc 关闭
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 其它标签页修改密钥时同步来源与脱敏值（localStorage.clear 时 key 为 null）
  useEffect(() => {
    const handleStorage = (event: StorageEvent): void => {
      if (event.key === API_KEY_STORAGE_KEY || event.key === null) {
        refreshStatus();
      }
    };
    window.addEventListener('storage', handleStorage);
    return (): void => window.removeEventListener('storage', handleStorage);
  }, [refreshStatus]);

  /** 依据当前来源生成 placeholder，绝不把完整密钥放进 value / defaultValue。 */
  let placeholder = '请输入 API Key（形如 id.secret）';
  if (source === 'custom') {
    placeholder = `已配置自定义密钥（${masked ?? '••••'}），输入新值以覆盖`;
  } else if (source === 'env') {
    placeholder = `当前使用环境变量中的密钥（${masked ?? '••••'}），输入即覆盖`;
  }

  const handleSave = (): void => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setFeedback({ kind: 'error', text: '请输入要保存的 API Key，不能为空。' });
      return;
    }
    saveCustomApiKey(trimmed);
    setDraft('');
    setVisible(false);
    refreshStatus();
    setFeedback({ kind: 'ok', text: '已保存，下一次发送消息即会使用新的 API Key。' });
    onChanged();
  };

  const handleClear = (): void => {
    clearCustomApiKey();
    setDraft('');
    setVisible(false);
    refreshStatus();
    const next = getApiKeySource();
    setFeedback({
      kind: 'ok',
      text:
        next === 'env'
          ? '已恢复使用环境变量中的密钥。'
          : '已清除自定义密钥，当前未配置密钥，请重新填写。',
    });
    onChanged();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    handleSave();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(event): void => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-settings-title"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2
            id="api-key-settings-title"
            className="text-base font-semibold text-gray-800"
          >
            API Key 设置
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="text-xl leading-none text-gray-400 transition-colors hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <p>
            当前密钥来源：
            <span className="font-medium text-gray-800">{SOURCE_LABELS[source]}</span>
          </p>
          <p className="mt-1">
            当前生效密钥：
            <span className="font-mono text-gray-800">{masked ?? '未配置'}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <label
            htmlFor="api-key-input"
            className="block text-xs font-medium text-gray-700"
          >
            {source === 'custom' ? '输入新密钥以覆盖' : '设置自定义密钥'}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              ref={inputRef}
              id="api-key-input"
              type={visible ? 'text' : 'password'}
              value={draft}
              onChange={(event): void => {
                setDraft(event.target.value);
                if (feedback) {
                  setFeedback(null);
                }
              }}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-wechat-green focus:ring-1 focus:ring-wechat-green"
            />
            <button
              type="button"
              onClick={(): void => setVisible((prev) => !prev)}
              aria-label={visible ? '隐藏密钥' : '显示密钥'}
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800"
            >
              {visible ? '隐藏' : '显示'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-wechat-green px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:brightness-95"
            >
              保存
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!customExists}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              清除自定义密钥
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800"
            >
              取消
            </button>
          </div>
        </form>

        {feedback && (
          <p
            role="status"
            className={`mt-3 text-xs ${
              feedback.kind === 'error' ? 'text-red-600' : 'text-green-700'
            }`}
          >
            {feedback.text}
          </p>
        )}

        <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
          <p className="font-semibold">安全说明</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>
              密钥仅保存在本机浏览器 LocalStorage，不会上传服务器，也不会写入源码或构建产物；刷新页面后仍然有效。
            </li>
            <li>
              界面配置的密钥优先于环境变量，保存后下一次发送立即生效；清除自定义密钥即回退到环境变量。
            </li>
            <li>
              共用浏览器或不可信设备请勿保存；生产环境应由后端代理持有密钥并转发请求。
            </li>
          </ul>
          <p className="mt-2 break-all">
            获取地址：
            <a
              href={API_KEY_HELP_URL}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              https://bigmodel.cn/usercenter/proj-mgmt/apikeys
            </a>
          </p>
          <p className="mt-1">
            现行密钥通常为 <code className="font-mono">id.secret</code> 形式，请完整复制。
          </p>
        </div>
      </div>
    </div>
  );
}
