# dsh-travily-api

中文 | [English](README.en.md)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）提供 **Tavily 网页搜索**：装一个插件，在「设置 → 插件」里填 API Key、打开一个开关，`web_search` 就走 Tavily；关掉开关就回到平台自带的搜索。

## 快速开始

```sh
# 从 GitHub 安装
dsh plugin --profile desktop add github:CeilCelia/dsh-travily-api

# 或者用本地目录（开发用）
dsh plugin --profile desktop add "C:\path\to\dsh-travily-api"
```

装完**重启一次 DeepSeek Harness**（新增插件要到下次启动才装载），然后：

1. 打开 **设置 → 插件**，找到「Tavily 网页搜索」卡片并展开；
2. 在 [tavily.com](https://tavily.com) 拿到 API Key（`tvly-…`），填进 **Tavily API Key** 并保存；
3. 打开 **使用 Tavily 进行网页搜索** 开关并保存；
4. 点 **连通测试** 确认可用——它会真的发一次 Tavily 搜索。

不需要 API Key 也能用：留空即走 Tavily 的无 Key 模式。

## 行为

| 开关 | API Key | `web_search` 走 |
| --- | --- | --- |
| 关（默认） | — | 平台自带的搜索 |
| 开 | 未填 | Tavily（无 Key 模式） |
| 开 | 已填 | Tavily（你的账号额度） |

- **安装本身不影响你现在的搜索。** 开关关闭时，本插件会把请求原样交给平台上已有的搜索提供方，所以装完不配置也不会改变任何行为。
- 想彻底固定走 Tavily（不再依赖开关），可以把 profile patch 里 `web` 行的 `searchProvider` 改成 `tavily`。
- 开关和 Key 都改完之后立即生效，不需要重启；只有第一次安装需要重启。

## 凭证

API Key 以 **credential** 方式保存，**不会写进设置文件**，也不会出现在会话记录里。凭证文件本身由 dsh 以仅当前用户可读的权限写入。也可以直接放在 `$DSH_HOME/.credentials.yaml`：

```yaml
TAVILY_API_KEY: tvly-xxxxxxxx
```

或作为启动环境变量注入（环境变量优先级高于凭证文件）。凭证引用名默认 `TAVILY_API_KEY`，可在设置节 `apiKeyEnv` 中修改。

## 配置项

设置页写入的是 profile patch 里的 `web-search-tavily` 行，也可以直接手写：

```yaml
- id: web-search-tavily
  config:
    enabled: true
    maxResults: 8
```

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `false` | 开关。关闭即回退平台搜索 |
| `apiKeyEnv` | `TAVILY_API_KEY` | API Key 的凭证引用名 |
| `baseURL` | `https://api.tavily.com` | Tavily 地址 |
| `allowCustomBaseURL` | `false` | 是否允许非官方 `https://` 地址 |
| `maxResults` | `5` | 请求未给预算时的结果条数 |
| `searchDepth` | `basic` | `basic` / `advanced` |
| `searchTimeoutMs` | `30000` | 单次请求超时 |

## 卸载

```sh
dsh plugin --profile desktop remove dsh-travily-api
```

## 仓库结构

```
lib/index.js        搜索提供方与设置节（运行在 dsh 侧）
lib/client.js       设置页卡片（运行在浏览器侧）
cordis.patch.yml    profile patch：插入 web-search-tavily 行
package.json        插件清单
```

## 参与开发

```sh
npm install
npm test                         # 离线测试：设置节/提供方/设置卡片渲染
node .tools/verify-install.mjs   # 端到端：临时 profile + 备用端口真启动一次
node .tools/live-search.mjs      # 用已保存的开关与 Key 真搜一次（消耗额度）
```

`.tools/verify-install.mjs` 会在 `$DSH_HOME/profiles/travily-verify` 建一个临时 profile，验证完删除，并只关掉它自己启动的进程——不会碰你正在用的 profile。`.tools/live-search.mjs` 会真的调用 Tavily API。

## License

MIT
