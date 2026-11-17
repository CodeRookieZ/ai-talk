# AI 聊天助手（ai-talk）

基于 React + TypeScript + Vite + Tailwind CSS 的微信风格 AI 聊天助手，调用智谱 AI（GLM）Chat Completions 流式接口，支持多轮对话、Markdown / 代码高亮、本地持久化。

## 快速开始

```bash
npm install
cp .env.example .env.local     # Windows Git Bash 同样可用；也可手动复制
# 可选：填入 VITE_ZHIPU_API_KEY；也可启动后在界面右上角「设置」中配置
npm run dev                    # http://127.0.0.1:5173（端口被占用会直接报错，不会自动换端口）
npm run build                  # tsc 类型检查 + Vite 生产构建
npm run typecheck              # 仅类型检查
```

> 本项目已提供一份本地生效的 `.env.local`（已被 `.gitignore` 忽略），填写后可直接使用；请勿把密钥写进任何源码或提交物。也可以完全不填该变量，启动后在界面「设置」中直接填写 / 更换密钥。

## 在界面配置 API Key

点击聊天界面右上角的「设置」按钮（⚙）即可打开配置面板，无需修改 `.env.local`、无需重启开发服务器、无需刷新页面：

- **优先级**：界面手动配置的值 > 环境变量 `VITE_ZHIPU_API_KEY`（可选回退）> 未配置。每次发送消息时都会动态解析，**保存后下一次发送立即生效**。
- **保存位置**：仅保存在本机浏览器 `LocalStorage`（键 `ai-talk:api-key:v1`），不会上传服务器，也不会写入源码或构建产物；刷新页面后仍然有效。
- **即时生效 / 清除回退**：保存新密钥后立即覆盖环境变量；点击「清除自定义密钥」即回退到环境变量中的密钥（若环境变量也未配置，则回到「未配置」状态并显示引导条）。
- **首次引导**：未配置任何密钥时，消息区上方会显示「尚未配置 API Key」提示条与「立即配置」按钮；此时直接发送消息会被拦截并弹出设置面板，不会产生用户消息或空 AI 气泡。
- **脱敏展示**：输入框不回填完整密钥，面板仅显示「当前密钥来源：界面自定义 / 环境变量 / 未配置」与脱敏值（如 `••••abcd`）；输入框可切换「显示 / 隐藏」。
- **安全说明**：密钥仅存本机浏览器，共用浏览器或不可信设备请勿保存；**生产环境应由后端代理持有密钥**并转发请求。现行密钥通常为 `id.secret` 形式，请完整复制。获取地址：https://bigmodel.cn/usercenter/proj-mgmt/apikeys 。
- **推荐做法**：构建 / 部署时不设置 `VITE_ZHIPU_API_KEY`，完全由界面配置，可从根本上避免密钥被内联进 `dist` 产物。

### 与初始设计文档的差异

- `AGENTS.md` 第 9 行「API Key 从环境变量读取」与 `TECH_DESIGN.md` 第 17 行「API Key 存储在环境变量中」描述的是**初始方案**；两份原始文档作为需求基线保留，本轮未作修改。
- 按后续需求，密钥来源扩展为「界面自定义（浏览器 `LocalStorage`）优先 + 环境变量 `VITE_ZHIPU_API_KEY` 可选回退」；`AGENTS.md` 的「不要硬编码」约束仍严格遵守，密钥不写入任何源码、文档、提交物或构建产物。
- 因此 `VITE_ZHIPU_API_KEY` 已由「必填」变为「可选」，完全由界面配置时可不设置该变量。

## 环境变量

Vite 只暴露 `VITE_` 前缀的变量，修改 `.env.local` 后需重启开发服务器；界面「设置」中配置的值优先于环境变量，且无需重启。

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `VITE_ZHIPU_API_KEY` | 否（可选） | 无 | 智谱 AI API Key，用于 `Authorization: Bearer <KEY>`；界面配置优先，仅当界面未配置时回退 |
| `VITE_ZHIPU_MODEL` | 否 | `glm-4.5-flash` | 模型编码，可用下方免费 GLM-4 级编码覆盖 |
| `VITE_ZHIPU_BASE_URL` | 否 | `/zhipu/api/paas/v4/chat/completions` | 接口完整地址；生产环境改为自建后端代理地址 |

`.env.example` 为不含真实密钥的模板；`.gitignore` 已忽略 `node_modules`、`dist`、`.env`、`.env.local`、`.env*.local` 与根目录密钥文件 `myApiKey.txt`。

### 模型与官方文档（2026-11-15 核对）

`glm-4-flash` 已从 API 参考的可用模型列表中移除，默认模型改为 **`glm-4.5-flash`**。官方标注为「免费文本模型」的 GLM-4 级编码：

| 模型编码 | 上下文 / 最大输出 |
| --- | --- |
| `glm-4-flash-250414` | 128K / 16K |
| `glm-4.5-flash`（默认） | 128K / 96K |
| `glm-4.7-flash` | 200K / 128K |

- 模型概览：https://docs.bigmodel.cn/cn/guide/start/model-overview
- 对话补全 API 参考：https://docs.bigmodel.cn/api-reference
- HTTP API 调用与鉴权（Bearer / JWT）：https://docs.bigmodel.cn/cn/guide/develop

API Key 获取地址：https://bigmodel.cn/usercenter/proj-mgmt/apikeys 。若返回 HTTP 401，请先确认密钥完整复制（现行密钥通常为 `id.secret` 形式）、已启用且未过期，再更新 `.env.local` 并重启开发服务器；也可直接在界面右上角「设置」中更换密钥（保存后下一次发送立即生效），无需改文件或重启。本项目采用标准 HTTP Bearer 鉴权，不做密钥格式硬校验，也不会自动生成 JWT。

## 六步功能与实现位置

| 步骤 | 需求 | 实现位置 |
| --- | --- | --- |
| 一 | React + TS + Vite 初始化与依赖 | `package.json`、`index.html`、`vite.config.ts`、`tsconfig.json`、`tsconfig.node.json`、`tailwind.config.js`、`postcss.config.js`、`src/main.tsx` |
| 二 | `Message` 类型与流式 API 封装 | `src/types.ts`、`src/api.ts`、`src/vite-env.d.ts` |
| 三 | 微信风格聊天界面 + Markdown | `src/components/ChatInterface.tsx`、`src/components/MessageBubble.tsx`、`src/components/MarkdownRenderer.tsx`、`src/index.css` |
| 四 | 发送 / 流式追加 / 多轮历史 / 加载禁用 | `src/components/ChatInterface.tsx` 的 `handleSend`、`src/api.ts` 的 `streamChat` |
| 五 | LocalStorage 持久化与清空 | `src/storage.ts`、`src/components/ChatInterface.tsx` 的防抖保存、`beforeunload` 同步写入、流结束强制写入与 `handleClear` |
| 六 | 自动滚动 / 复制 / 代码高亮 / 错误提示 | `src/components/ChatInterface.tsx`（滚动）、`src/components/CopyButton.tsx`、`src/utils.ts`（`copyToClipboard` 降级）、`src/components/MarkdownRenderer.tsx`（`components.code` 区分 inline / block）、`src/api.ts`（中文错误与 `AbortController`） |

补充说明：

- 用户消息右对齐、气泡 `#95EC69`；AI 消息左对齐、白色气泡；页面背景 `#EDEDED`，含圆形头像与 `HH:mm` 时间戳（`src/components/MessageBubble.tsx`）。
- AI 回答使用 `react-markdown` 渲染，围栏代码块由 `react-syntax-highlighter` 高亮并带语言标签、复制按钮；用户消息保留原始换行。
- 代码高亮使用 `PrismLight` 按需注册 25 种常用语言（默认样式 `oneDark`），避免打进全量语法包；未登记的语言标注退化为纯文本代码块，仍可复制。
- 按 `Enter` 发送、`Shift + Enter` 换行；流式期间输入框与发送按钮禁用，可点「停止」主动中断，已生成内容会保留。
- 若在首个字到达前「停止」或请求失败，未产生内容的 AI 占位气泡会被无条件移除（内存与 LocalStorage 同步清理），不会出现永久空气泡；已生成内容始终保留。
- 流式期间采用 400ms 防抖写入，流结束与页面卸载时同步写入，避免逐 chunk 写盘又不丢已完成内容。
- 右上角「设置」可在界面手动配置 / 清除 API Key（`src/settings.ts`、`src/components/ApiKeySettings.tsx`），优先级高于环境变量，保存后下一次发送即时生效；`src/api.ts` 的 `getApiKey()` 每次调用动态解析，不在模块顶层缓存。未配置时显示引导条并拦截发送，不会产生空消息。

## CORS 与代理说明（重要）

浏览器直连 `https://open.bigmodel.cn` 通常会被 CORS 拦截，且 `EventSource` 不支持 POST，因此：

- 开发环境由 `vite.config.ts` 的 `server.proxy` 把 `/zhipu` 转发到 `https://open.bigmodel.cn`（`changeOrigin: true`，`rewrite` 去掉 `/zhipu` 前缀，`strictPort: true` 固定 5173 端口），前端请求同源相对路径 `/zhipu/api/paas/v4/chat/completions`。
- `src/api.ts` 用 `fetch` + `response.body.getReader()` + `TextDecoder` 手动解析 SSE：按行处理 `data: {...}`，取 `choices[0].delta.content`，遇 `data: [DONE]` 结束；已处理跨 chunk 半行缓冲、空行 / 非 data 行、JSON 解析失败、HTTP 错误与 `AbortController` 取消。
- `npm run preview` / 生产静态托管**不会**带上 Vite 开发代理。生产环境请把 `VITE_ZHIPU_BASE_URL` 指向自建后端代理（例如 `/api/chat/completions`），由后端转发到智谱。

## 安全提示

**纯前端方案会把 `VITE_ZHIPU_API_KEY` 打进构建产物并暴露给浏览器，仅供本地开发 / 演示使用。生产环境必须由后端代理持有密钥并转发请求**，同时配置鉴权、限流与额度保护，切勿把密钥提交到仓库。

界面「设置」中的密钥仅保存在本机浏览器 `LocalStorage`，不会上传服务器、不会写入源码或构建产物，共用浏览器 / 不可信设备请勿保存；如需更换密钥，可在界面设置中直接更换并即时生效。**推荐构建 / 部署时不设置 `VITE_ZHIPU_API_KEY`，完全由界面配置，从根本上避免密钥被内联进 `dist`。**

## 已知限制

- 默认模型 `glm-4.5-flash` 与上述免费模型编码的可用性以官方模型概览页为准，可用 `VITE_ZHIPU_MODEL` 覆盖；若账号无权限或额度不足会显示中文错误提示。
- LocalStorage 容量有限且数据仅保存在当前浏览器；隐私模式或配额不足时保存会静默失败。
- 断网、代理不可用或密钥无效（HTTP 401）时会显示中文错误提示与排查指引，并清理加载状态以便重新发送；可在界面「设置」中直接更换密钥后重试。
