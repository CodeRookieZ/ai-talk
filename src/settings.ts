/**
 * 界面自定义 API Key 的 LocalStorage 存储层。
 *
 * 设计约束：
 * - 纯存储模块，不引用 import.meta.env，也不产生任何顶层副作用；
 * - 兼容 SSR / Node 环境（QA 会用 esbuild 把 api.ts 打包进 Node 做离线测试，
 *   届时不存在 window），因此所有对 window / localStorage 的访问都先做
 *   typeof window === 'undefined' 判断，并用 try/catch 静默容错。
 */

/** LocalStorage 键名，带版本号便于后续结构升级。 */
export const API_KEY_STORAGE_KEY = 'ai-talk:api-key:v1';

/** 读取界面自定义密钥并 trim；存储异常、隐私模式或 SSR 环境返回空字符串。 */
export function loadCustomApiKey(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const raw = window.localStorage.getItem(API_KEY_STORAGE_KEY);
    return typeof raw === 'string' ? raw.trim() : '';
  } catch {
    return '';
  }
}

/**
 * 保存界面自定义密钥（写入前 trim）。
 * 空值等价于清除；隐私模式或配额不足时静默失败，不影响聊天。
 */
export function saveCustomApiKey(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const trimmed = key.trim();
    if (trimmed) {
      window.localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch {
    // 存储不可用时忽略
  }
}

/** 清除界面自定义密钥，回退到环境变量；存储不可用时静默失败。 */
export function clearCustomApiKey(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // 存储不可用时忽略
  }
}

/**
 * 脱敏展示密钥：仅保留末尾 4 位，前面以 •••• 遮蔽；短密钥全部遮蔽。
 * 绝不返回原文，可安全用于 DOM / 提示文案 / 日志。
 */
export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) {
    return '';
  }
  const SUFFIX_LENGTH = 4;
  const FULL_MASK = '••••••••';
  // 密钥过短时展示后 4 位会泄露几乎全部内容，直接全部遮蔽
  if (trimmed.length <= SUFFIX_LENGTH * 2) {
    return FULL_MASK;
  }
  return `••••${trimmed.slice(-SUFFIX_LENGTH)}`;
}

/** 是否存在界面自定义密钥（等价于 loadCustomApiKey() 非空）。 */
export function hasCustomApiKey(): boolean {
  return loadCustomApiKey().length > 0;
}
