import type { CSSProperties, ReactElement } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import scala from 'react-syntax-highlighter/dist/esm/languages/prism/scala';
import scss from 'react-syntax-highlighter/dist/esm/languages/prism/scss';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { CopyButton } from './CopyButton';

/**
 * 只注册常用语言，避免把 refractor 全部语法打进产物。
 * 未登记的语言标注会退化为纯文本代码块，不会导致渲染异常。
 */
const LANGUAGE_MODULES: Record<string, unknown> = {
  bash,
  c,
  cpp,
  csharp,
  css,
  diff,
  go,
  java,
  javascript,
  json,
  jsx,
  kotlin,
  markdown,
  markup,
  php,
  python,
  ruby,
  rust,
  scala,
  scss,
  sql,
  swift,
  tsx,
  typescript,
  yaml,
};

for (const [name, languageModule] of Object.entries(LANGUAGE_MODULES)) {
  SyntaxHighlighter.registerLanguage(name, languageModule);
}

/** 常见语言标注别名，统一映射到已注册的 Prism 语言名。 */
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  html: 'markup',
  xml: 'markup',
  'c++': 'cpp',
  'c#': 'csharp',
  golang: 'go',
  vue: 'markup',
};

const SUPPORTED_LANGUAGES = new Set([
  ...Object.keys(LANGUAGE_MODULES),
  'text',
]);

/** 归一化语言标注；未知语言返回 text 以走纯文本兜底。 */
function normalizeLanguage(language: string): string {
  const key = language.toLowerCase();
  const normalized = LANGUAGE_ALIASES[key] ?? key;
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : 'text';
}

interface CodeBlockProps {
  code: string;
  language: string;
}

/** 带语言标签、复制按钮和语法高亮的代码块。 */
function CodeBlock({ code, language }: CodeBlockProps): ReactElement {
  const normalized = normalizeLanguage(language);
  const canHighlight =
    normalized !== 'text' &&
    Object.prototype.hasOwnProperty.call(LANGUAGE_MODULES, normalized);
  const codeAreaStyle: CSSProperties = {
    margin: 0,
    padding: '12px',
    background: 'transparent',
    fontSize: '12px',
    lineHeight: '1.6',
  };

  return (
    <div className="my-2 overflow-hidden rounded-md border border-black/10 bg-[#1E1E1E]">
      <div className="flex items-center justify-between bg-[#2B2B2B] px-3 py-1.5 text-[11px] text-gray-300">
        <span className="font-mono">{language || 'text'}</span>
        <CopyButton
          text={code}
          label="复制代码"
          className="text-gray-300 hover:bg-white/10 hover:text-white"
        />
      </div>
      {canHighlight ? (
        <SyntaxHighlighter
          language={normalized}
          style={oneDark}
          customStyle={codeAreaStyle}
          wrapLongLines
        >
          {code}
        </SyntaxHighlighter>
      ) : (
        <pre
          className="m-0 overflow-x-auto text-gray-100"
          style={codeAreaStyle}
        >
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

/**
 * react-markdown 自定义组件：
 * - 在 components.code 中区分行内代码与围栏代码块（依据 language- 标注或换行）
 * - components.pre 返回 Fragment，避免 <pre> 与高亮组件自带的 <pre> 嵌套
 */
const markdownComponents: Components = {
  code({ className, children }) {
    const raw = String(children ?? '');
    const match = /language-([\w+#-]+)/.exec(className ?? '');
    const isBlock = Boolean(match) || raw.includes('\n') || Boolean(className);
    if (!isBlock) {
      return (
        <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em]">
          {children}
        </code>
      );
    }
    return (
      <CodeBlock
        code={raw.replace(/\n$/, '')}
        language={match?.[1] ?? 'text'}
      />
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
};

interface MarkdownRendererProps {
  content: string;
}

/** 以 Markdown 渲染 AI 回答，代码块自动语法高亮。 */
export function MarkdownRenderer({ content }: MarkdownRendererProps): ReactElement {
  return (
    <div className="markdown-body text-gray-800">
      <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  );
}
