# dsh-travily-api

中文 | [English](README.en.md)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）提供 Tavily 搜索能力。启用后 `web_search` 通过 Tavily 执行，禁用后回退到平台自带的搜索。

最新更新时间：2026-10-02
最新更新版本：v0.1.0

## 安装

在 DeepSeek Harness 的「插件」面板中点击「添加插件」，在「包名或地址」中填入：

```
github:CeilCelia/dsh-travily-api
```

安装后需要重启 DeepSeek Harness：该插件作为 profile bundle 装载，仅在下次启动时生效。也可用命令行安装：

```sh
dsh plugin --profile desktop add github:CeilCelia/dsh-travily-api
```

开发时可安装本地目录，修改代码后无需重新安装：

```sh
dsh plugin --profile desktop add "C:\path\to\dsh-travily-api"
```

卸载：

```sh
dsh plugin --profile desktop remove dsh-travily-api
```

## 配置

重启后回到「插件」面板，在「已安装」中打开「Tavily 网页搜索」，页面中即为该插件的设置项：

1. 在 [tavily.com](https://tavily.com) 申请 API Key 并填入。留空则使用 Tavily 的无 Key 模式。
2. 启用「使用 Tavily 进行网页搜索」。
3. 修改后点击保存，可用「连通测试」验证：该操作会真实发起一次搜索。

| 开关 | API Key | `web_search` 的提供方 |
| --- | --- | --- |
| 关（默认） | — | 平台自带的搜索 |
| 开 | 未填 | Tavily，无 Key 模式 |
| 开 | 已填 | Tavily，计入账号额度 |

禁用时请求会原样转交给平台上已有的搜索提供方，因此安装本身不改变现有行为。开关与 API Key 的修改保存后立即生效，无需重启。

## API Key 的存储

API Key 以 credential 形式保存，不写入设置文件，也不会出现在会话记录中。手动配置时写入 `$DSH_HOME/.credentials.yaml`：

```yaml
TAVILY_API_KEY: tvly-xxxxxxxx
```

也可通过启动环境变量注入，其优先级高于凭证文件。

## 配置项

设置页写入 profile patch 中的 `web-search-tavily` 行。也可以直接编辑该行：

```yaml
- id: web-search-tavily
  config:
    enabled: true
    maxResults: 8
```

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `enabled` | `false` | 是否通过 Tavily 执行搜索；关闭时回退到平台搜索 |
| `apiKeyEnv` | `TAVILY_API_KEY` | 读取 API Key 的凭证引用名 |
| `baseURL` | `https://api.tavily.com` | Tavily 接口地址 |
| `allowCustomBaseURL` | `false` | 是否允许使用非官方接口地址 |
| `maxResults` | `5` | 请求未指定时返回的结果数 |
| `searchDepth` | `basic` | `basic` 或 `advanced` |
| `searchTimeoutMs` | `30000` | 单次请求超时（毫秒） |

## License

MIT
