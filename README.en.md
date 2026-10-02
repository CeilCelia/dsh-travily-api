# dsh-travily-api

[中文](README.md) | English

Tavily web search for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh). Paste an API key, flip a switch, and `web_search` runs through Tavily.

## Install

In DeepSeek Harness, open the "Plugins" panel on the left, press "Add plugin", and enter this under "Package name or address":

```
github:CeilCelia/dsh-travily-api
```

Restart DeepSeek Harness once. Then go back to "Plugins", open the "Official" group and expand "Tavily web search":

1. Get an API key from [tavily.com](https://tavily.com), paste it in and save (leave it empty to use Tavily's keyless mode).
2. Turn on "Use Tavily for web search" and save.
3. Press "Test connection" — it runs one real search.

The command line works the same way:

```sh
dsh plugin --profile desktop add github:CeilCelia/dsh-travily-api
```

While developing, a local checkout is handier — edits need no reinstall:

```sh
dsh plugin --profile desktop add "C:\path\to\dsh-travily-api"
```

Uninstall from the "Plugins" panel, or:

```sh
dsh plugin --profile desktop remove dsh-travily-api
```

## Behaviour

| Switch | API key | `web_search` uses |
| --- | --- | --- |
| Off (default) | — | the platform's own search |
| On | not set | Tavily keyless mode |
| On | set | Tavily, billed to your account |

Installing changes nothing on its own: while the switch is off the request goes to whichever search provider the deployment already has. Switch and key changes apply immediately — no restart.

## Where the API key lives

It is stored as a credential, never written into the settings file and never recorded in a session. To set it by hand, put it in `$DSH_HOME/.credentials.yaml`:

```yaml
TAVILY_API_KEY: tvly-xxxxxxxx
```

or inject it as a launch environment variable, which outranks the file.

## Settings

The Settings page writes the `web-search-tavily` row of your profile patch. You can also write it by hand:

```yaml
- id: web-search-tavily
  config:
    enabled: true
    maxResults: 8
```

| Field | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | The switch; off falls back to the platform search |
| `apiKeyEnv` | `TAVILY_API_KEY` | Credential reference the key is read from |
| `baseURL` | `https://api.tavily.com` | Tavily endpoint |
| `allowCustomBaseURL` | `false` | Allow an endpoint other than the public one |
| `maxResults` | `5` | Results per search when the request states no budget |
| `searchDepth` | `basic` | `basic` or `advanced` |
| `searchTimeoutMs` | `30000` | Timeout for one Tavily request |

## License

MIT
