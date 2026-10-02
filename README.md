# dsh-travily-api

中文 | [English](README.en.md)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）接入 Tavily 网页搜索。在设置里填一个 API Key、打开开关，`web_search` 就走 Tavily。

## 安装

在 DeepSeek Harness 里点左侧的「插件」，点「添加插件」，在「包名或地址」里填入：

```
github:CeilCelia/dsh-travily-api
```

装完重启一次 DeepSeek Harness。然后回到「插件」，在「已安装」里点开「Tavily 网页搜索」，下面就是它的设置：

1. 在 [tavily.com](https://tavily.com) 申请 API Key，填入并保存（留空则用 Tavily 无 Key 模式）。
2. 打开「使用 Tavily 进行网页搜索」并保存。
3. 点「连通测试」确认——它会真的发一次搜索。

用命令行装也可以，效果一样：

```sh
dsh plugin --profile desktop add github:CeilCelia/dsh-travily-api
```

开发时更推荐装本地目录，改代码不用重装：

```sh
dsh plugin --profile desktop add "C:\path\to\dsh-travily-api"
```

卸载在「插件」面板里点卸载，或：

```sh
dsh plugin --profile desktop remove dsh-travily-api
```

## 行为

| 开关 | API Key | `web_search` 走 |
| --- | --- | --- |
| 关（默认） | — | 平台自带的搜索 |
| 开 | 未填 | Tavily 无 Key 模式 |
| 开 | 已填 | Tavily，计入你的账号额度 |

安装本身不影响现有搜索：开关关闭时请求原样交给平台上已有的搜索提供方。开关和 Key 改完立即生效，不用重启。

## API Key 存在哪

以 credential 保存，不写入设置文件，也不进会话记录。想手动指定的话，可以放 `$DSH_HOME/.credentials.yaml`：

```yaml
TAVILY_API_KEY: tvly-xxxxxxxx
```

或用启动环境变量注入，环境变量优先级更高。

## 配置项

设置页写入 profile patch 的 `web-search-tavily` 行，也可以手写：

```yaml
- id: web-search-tavily
  config:
    enabled: true
    maxResults: 8
```

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `false` | 开关；关闭即回退平台搜索 |
| `apiKeyEnv` | `TAVILY_API_KEY` | API Key 的凭证引用名 |
| `baseURL` | `https://api.tavily.com` | Tavily 地址 |
| `allowCustomBaseURL` | `false` | 是否允许非官方 `https://` 地址 |
| `maxResults` | `5` | 请求未给预算时的结果条数 |
| `searchDepth` | `basic` | `basic` / `advanced` |
| `searchTimeoutMs` | `30000` | 单次请求超时 |

## License

MIT
