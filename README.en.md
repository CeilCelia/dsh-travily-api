# dsh-travily-api

[中文](README.md) | English

Tavily search for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh). When enabled, `web_search` runs through Tavily; when disabled, it falls back to the platform's own search.

Last updated: 2026-10-02
Built against dsh: 0.2.0-rc.2

## Install

In DeepSeek Harness, press "Add plugin" in the "Plugins" panel and enter this under "Package name or address":

```
github:CeilCelia/dsh-travily-api
```

Restart DeepSeek Harness afterwards: the plugin loads as a profile bundle, so it takes effect on the next start. The command line works the same way:

```sh
dsh plugin --profile desktop add github:CeilCelia/dsh-travily-api
```

For development, a local directory can be installed instead, and code edits need no reinstall:

```sh
dsh plugin --profile desktop add "C:\path\to\dsh-travily-api"
```

Uninstall:

```sh
dsh plugin --profile desktop remove dsh-travily-api
```

## Configuration

After the restart, open "Tavily web search" under "Installed" in the "Plugins" panel. Its settings are on that page:

1. Request an API key from [tavily.com](https://tavily.com) and enter it. Leaving it empty uses Tavily's keyless mode.
2. Enable "Use Tavily for web search".
3. Press save. "Test connection" verifies the setup by running one real search.

| Switch | API key | `web_search` provider |
| --- | --- | --- |
| Off (default) | — | the platform's own search |
| On | empty | Tavily, keyless mode |
| On | set | Tavily, billed to the account |

While disabled, the request is passed through to the search provider already registered on the platform, so installing the plugin does not change existing behaviour. Switch and API key changes apply as soon as they are saved; no restart is required.

## API key storage

The API key is stored as a credential. It is not written into the settings file and does not appear in session records. To configure it by hand, add it to `$DSH_HOME/.credentials.yaml`:

```yaml
TAVILY_API_KEY: tvly-xxxxxxxx
```

It can also be injected through a launch environment variable, which takes precedence over the credential file.

## Settings

The settings page writes the `web-search-tavily` row of the profile patch. That row can also be edited directly:

```yaml
- id: web-search-tavily
  config:
    enabled: true
    maxResults: 8
```

| Field | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | Whether searches run through Tavily; off falls back to the platform search |
| `apiKeyEnv` | `TAVILY_API_KEY` | Credential reference the API key is read from |
| `baseURL` | `https://api.tavily.com` | Tavily endpoint |
| `allowCustomBaseURL` | `false` | Whether a non-official endpoint is permitted |
| `maxResults` | `5` | Results returned when the request specifies no budget |
| `searchDepth` | `basic` | `basic` or `advanced` |
| `searchTimeoutMs` | `30000` | Timeout for one request, in milliseconds |

## License

MIT
