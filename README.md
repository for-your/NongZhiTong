# 农智通 · NongZhiTong

面向农业生产全过程的 AI Agent 智能服务平台前端。项目把农业问题拆成三个专家入口——**农业智能预警、农业智能诊断、农产品智能销售**，并配套实时天气、知识空间和农事计算工具。

这是一个可复现、可解释的比赛 Demo：没有平台凭据时，`pnpm dev` 即可进入 Demo 模式；配置同源网关后，可通过女娲平台的会话、SSE、历史和文件接口接入真实智能体。仓库不把平台提示词、知识库、插件配置或模型效果写成已验证事实。

## 功能

- **三个专家智能体**：按预警 / 诊断 / 销售分栏，各自维护会话画布、历史与排队消息，互不串台。
- **完整聊天生命周期**：SSE 流式输出、思考进度、停止生成、重新生成、编辑重发、历史加载竞态保护，以及超时 / 断流 / 业务失败的明确终态。
- **附件链路**：图片与文档上传、失败重试、发送前校验；Demo 模式只做本地预览，不声称模型识别了图片。
- **知识空间**：农业农村部「部要闻」原文聚合 + 本地专栏补齐，按主题筛选、搜索和阅读。
- **真实数据小工具**：Open-Meteo 天气、二十四节气、农药稀释计算器、种植收益测算器。
- **诚实的降级状态**：演示 / 真实模式、远程原文 / 本地资料、实时 / 示例天气都有可见标识。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 界面 | React 18、TypeScript 5、Vite 5、Tailwind CSS 3、framer-motion、lucide-react |
| 状态 | Zustand 5（`src/store/chatStore.ts`） |
| 平台接入 | `src/lib/nuwax.ts`：会话、SSE、历史、上传契约 |
| 外部数据 | Open-Meteo（天气）、农业农村部官网（新闻，开发代理 `/moa-news`） |
| 质量 | Vitest、Testing Library、ESLint、TypeScript、GitHub Actions |

项目**不自带后端**。Demo 模式完全运行在浏览器；真实模式需要部署者提供同源网关，浏览器不持有平台密钥。

## 快速开始

环境要求：Node.js 20+、pnpm 11+。

```bash
pnpm install
pnpm dev
```

打开终端输出的地址即可体验。默认 `VITE_NUWAX_MODE=demo`，不需要任何密钥。

## 模式与环境变量

复制 `.env.example` 为 `.env.local`，按需修改：

```dotenv
# 本地开发默认走 Vite 代理（/nuwax-api → 女娲平台）
VITE_NUWAX_BASE_URL=/nuwax-api

# demo：本地预设回复；real：调用同源网关
VITE_NUWAX_MODE=demo

# 只给 Vite 开发代理 / 生产网关读取，不能加 VITE_ 前缀
# NUWAX_API_KEY=
```

开启真实模式至少需要 `VITE_NUWAX_MODE=real`、可用的 `VITE_NUWAX_BASE_URL` 和服务端密钥。`NUWAX_API_KEY` 没有 `VITE_` 前缀，浏览器代码不会读取它；不要把旧配置 `VITE_NUWAX_API_KEY` 放回前端环境。修改 `.env.local` 后需要重启 Vite。

| 模式 | 可用内容 | 数据边界 |
| --- | --- | --- |
| Demo | 三个专家的预设对话、附件本地预览、知识卡片、农事工具 | 回复带「预设演示内容」标识，不调用模型 |
| Real | 同源网关转发后的会话、SSE 回复、历史和文件上传 | 依赖平台 Agent ID、权限和额度；失败会显示错误 |
| 外部数据 | Open-Meteo 天气、农业农村部原文新闻 | 标记来源与获取状态；离线补齐内容标为「本地资料」 |

真实平台是否可用，还取决于 Agent ID、SSE 契约、文件权限和额度，本仓库没有这些外部状态的证明。

## 常用脚本

```bash
pnpm dev         # 启动开发服务器
pnpm build       # 生产构建
pnpm preview     # 预览 dist
pnpm type-check  # TypeScript 检查
pnpm test        # Vitest 单次运行
pnpm lint        # ESLint
pnpm check       # 提交门禁：type-check + lint + test
```

## 目录结构

```text
.
├─ src/
│  ├─ components/
│  │  ├─ assistant/   对话界面、消息气泡、Markdown、会话侧栏
│  │  ├─ layout/      导航、页脚、页面过渡与加载态
│  │  └─ ui/          共享 UI 原语与动画
│  ├─ lib/            平台契约、天气、新闻、演示内容、工具函数
│  ├─ pages/          首页、智能助手、知识空间、关于、404
│  ├─ router/         Hash Router 与路由懒加载
│  └─ store/          聊天画布、队列、会话和上传状态
├─ public/            favicon、manifest、字体等静态资源
├─ docs/
│  ├─ architecture.md 架构、聊天生命周期与部署边界
│  └─ competition/    比赛演示脚本
├─ .github/workflows/ CI：安装、检查、构建
└─ 构建与检查配置（Vite / Tailwind / ESLint / Vitest / tsconfig）
```

`docs/` 只保留面向读者的架构和演示文档；开发过程日志不入库。

配置文件的用途：Vite 负责开发代理与打包，Tailwind / PostCSS 负责样式，TypeScript / ESLint / Vitest 负责检查和测试；`pnpm-workspace.yaml` 允许 esbuild 安装脚本运行。`.editorconfig` / `.prettierrc` 供编辑器统一格式，`.env.example` 是接入配置模板。`node_modules/` 是安装依赖，`dist/` 是构建产物，均不上传 GitHub；本地 `.env.local` 按需保留，也不入库。

## 测试与 CI

测试覆盖聊天终态分流、请求取消、历史乱序、Demo 排队、上传失败重试、新闻来源标记和工具函数。提交前运行：

```bash
pnpm check
pnpm build
```

CI 使用 `pnpm install --frozen-lockfile`，随后执行 `pnpm check` 和 `pnpm build`。

## 比赛演示

推荐按「拍照 / 选择附件 → 说明依据 → 使用农事工具 → 演示失败恢复」的顺序讲解。完整脚本见 [`docs/competition/demo-script.md`](docs/competition/demo-script.md)，架构与部署边界见 [`docs/architecture.md`](docs/architecture.md)。

## 已知限制

- 真实女娲平台、生产网关、天气服务和新闻代理尚未在本仓库内做端到端验收。
- 仓库只包含开发用 Vite 代理，不包含生产认证、限流、租户隔离和审计能力。
- Demo 回复、示例天气和补齐专栏都是演示内容，不构成农业诊断、实时行情或用药建议。
- 新闻抓取依赖农业农村部页面结构；页面改版时可能回落到本地资料。

## 贡献与安全

请先阅读 [`CONTRIBUTING.md`](CONTRIBUTING.md)。不要在 Issue、截图、日志或构建产物中提交 API Key、用户图片或平台响应原文。安全问题请使用代码托管平台的私下报告入口，详见 [`SECURITY.md`](SECURITY.md)。

## 许可证

本项目暂未声明开源许可证。如需复用代码或素材，请先联系维护者确认授权范围。
