# dsh-travily-api

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）提供 **Tavily 网页搜索**：在「设置 → 插件」里填 API Key、打开一个开关，`web_search` 就走 Tavily；关掉开关就回到平台自带的搜索。

本插件按当前 dsh（**0.2.0-rc.2**）的插件接口重写：配置节用 volatile 字段、设置卡片注册到 `plugins.item` 槽并用 `configForms` 读写、连通测试走 `webServer` 路由、Key 走 credentials。原 `dsh-tavily` 仓库的接口已与现在的 dsh 差别很大，不能直接使用。

## 行为

| 开关 | API Key | `web_search` 走 |
| --- | --- | --- |
| 关（默认） | — | 平台搜索提供方（`deepseek-official`） |
| 开 | 未填 | Tavily keyless |
| 开 | 已填 | Tavily 账号（`Authorization: Bearer`） |

- 提供方 id：`tavily`。
- 安装插件**不修改**组合里的 `web.searchProvider`（默认 `deepseek-official`），所以装完不配置也不影响现有搜索：开关关闭时 `tavily` 提供方把请求转交给平台上已注册的搜索提供方。
- 想彻底固定走 Tavily，可以把 profile patch 里 `web` 行的 `searchProvider` 改成 `tavily`。

## 安装

```sh
# 本地目录安装（开发）
dsh plugin --profile desktop add "C:\path\to\dsh-travily-api"
```

装完需要**重启一次 DeepSeek Harness**：新增 profile bundle 要到下次启动才会装载。之后设置页的改动能即时生效（`patchReload: live` + volatile 字段）。

卸载：

```sh
dsh plugin --profile desktop remove dsh-travily-api
```

## 使用

1. 打开 **设置 → 插件**，找到「Tavily 网页搜索」卡片并展开。
2. **Tavily API Key**：可选。填入 `tvly-…` 后点「保存」；留空即走 Tavily keyless。Key 以 credential 方式保存，**不会写进设置文件**。
3. **使用 Tavily 进行网页搜索**：打开开关并保存。
4. **连通测试**：真打一次 Tavily 搜索（`max_results: 1`）确认可用；已配置 Key 时消耗 1 个额度。

Key 也可以直接放在 `$DSH_HOME/.credentials.yaml`：

```yaml
TAVILY_API_KEY: tvly-xxxxxxxx
```

或作为启动环境变量注入（凭证服务里环境变量优先级高于凭证文件）。凭证引用名可在设置节 `apiKeyEnv` 中修改，默认 `TAVILY_API_KEY`。

## 配置节

设置页写入 profile patch 中的 `web-search-tavily` 行：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `false` | 开关。关闭即回退平台搜索 |
| `apiKeyEnv` | `TAVILY_API_KEY` | API Key 的凭证引用名 |
| `baseURL` | `https://api.tavily.com` | Tavily 地址 |
| `allowCustomBaseURL` | `false` | 是否允许非官方 `https://` 地址 |
| `maxResults` | `5` | 请求未给预算时的结果条数 |
| `searchDepth` | `basic` | `basic` / `advanced` |
| `searchTimeoutMs` | `30000` | 单次请求超时 |

也可以直接写 profile patch：

```yaml
- id: web-search-tavily
  config:
    enabled: true
    maxResults: 8
```

## 仓库结构

```
lib/index.js        宿主侧：provider 注册、设置节 Config、/api/tavily/probe 路由
lib/client.js       浏览器侧：设置页卡片（开关 / API Key / 连通测试）
cordis.patch.yml    profile patch：插入 web-search-tavily 行
package.json        dsh.bundle.patch + dsh.client（声明浏览器半）
```

`lib/client.js` 是手写的浏览器 bundle，只 require 平台种子模块（`react`、`react/jsx-runtime`），其余能力通过 cordis 服务取得（`configForms`、`remote.credentials`、`slots`、`locale`），因此**不需要构建步骤**，也没有 `dsh.client.external` 依赖。

## 自检

```sh
npm test                         # selftest + integration + client-harness（离线，不联网）
node .tools/verify-install.mjs   # 端到端：临时 profile + 备用端口真启动一次
node .tools/live-search.mjs      # 用已保存的开关与 Key 真搜一次（消耗额度）
```

| 脚本 | 覆盖 |
| --- | --- |
| `.tools/selftest.mjs` | 设置节 schema（含 volatile）、开关语义、失败分类、Tavily 响应映射 |
| `.tools/integration.mjs` | 真挂到 Cordis Context：注册/卸载、开关关闭回退、开关打开直连、探测路由 |
| `.tools/client-harness.mjs` | 在 `vm` 中像内核一样执行 `lib/client.js`，断言 `plugins.item` 注册，并用 react-dom/server 渲染两种视图、跑通 save/probe |
| `.tools/schema-check.mjs` | 用真实 `@deepseek-ai/dsh-settings` 复核配置节可被设置页投影 |
| `.tools/verify-install.mjs` | 端到端：行能组合、宿主半真连 Tavily、浏览器半进入启动图并能被取出 |
| `.tools/live-search.mjs` | 读取 desktop profile 里保存的开关与凭证，走真实 provider 搜一次 |

- 前五个脚本依赖仓库根的 `node_modules`（`@deepseek-ai/schemastery` 是运行依赖，其余为开发依赖）。
- `verify-install.mjs` 会在 `$DSH_HOME/profiles/travily-verify` 建临时 profile、在备用端口起实例，验证完删除该 profile 并只关掉自己启动的进程（不碰 desktop profile）；可用 `--port`、`--dir` 调整。
- `live-search.mjs` 会真的打 Tavily API（有 Key 时消耗额度）。

`.tools/dsh-src/`（从安装包 `app.asar` 解出的 dsh 源码，用于离线查阅）与 `node_modules/` 不入库。

## License

MIT
