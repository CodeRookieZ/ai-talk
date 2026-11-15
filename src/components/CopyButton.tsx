import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { copyToClipboard } from '../utils';

interface CopyButtonProps {
  /** 待复制的文本。 */
  text: string;
  /** 空闲状态按钮文案。 */
  label?: string;
  /** 附加 Tailwind 类名，用于适配深色代码块等场景。 */
  className?: string;
}

type CopyStatus = 'idle' | 'success' | 'error';

/** 通用复制按钮：navigator.clipboard 优先，失败时 execCommand 降级，并给出成功/失败反馈。 */
export function CopyButton({
  text,
  label = '复制',
  className = '',
}: CopyButtonProps): ReactElement {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => (): void => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const handleCopy = useCallback(async (): Promise<void> => {
    const ok = await copyToClipboard(text);
    setStatus(ok ? 'success' : 'error');
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => setStatus('idle'), 2000);
  }, [text]);

  const display =
    status === 'success' ? '已复制' : status === 'error' ? '复制失败' : label;

  return (
    <button
      type="button"
      onClick={(): void => {
        void handleCopy();
      }}
      title={label}
      aria-label={label}
      className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
        status === 'success'
          ? 'text-green-600'
          : status === 'error'
            ? 'text-red-500'
            : ''
      } ${className}`}
    >
      {display}
    </button>
  );
}
