# dsh-travily-api

[中文](README.md) | English

**Tavily web search for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh).** Install the plugin, paste an API key on the Settings → Plugins page, flip one switch, and `web_search` runs through Tavily. Flip it off and the platform's own search takes over again.

## Quick start

```sh
# install from GitHub
dsh plugin --profile desktop add github:CeilCelia/dsh-travily-api

# or from a local checkout (development)
dsh plugin --profile desktop add "C:\path\to\dsh-travily-api"
```

**Restart DeepSeek Harness once** — a newly installed plugin is only mounted on the next start. Then:

1. Open **Settings → Plugins** and expand the **Tavily web search** card.
2. Get an API key (`tvly-…`) from [tavily.com](https://tavily.com), paste it into **Tavily API key**, and save.
3. Turn on **Use Tavily for web search** and save.
4. Press **Test connection** to confirm — it runs one real Tavily search.

A key is optional: leave the field empty and searches use Tavily's keyless mode.

## Behaviour

| Switch | API key | `web_search` uses |
| --- | --- | --- |
| Off (default) | — | the platform's own search |
| On | not set | Tavily (keyless) |
| On | set | Tavily (your account quota) |

- **Installing changes nothing on its own.** While the switch is off this provider hands the request straight to whichever search provider the deployment already has, so a fresh install with no configuration behaves exactly as before.
- To pin every search to Tavily regardless of the switch, point the `web` row's `searchProvider` at `tavily` in your profile patch.
- After the one-time restart, later switch and key changes take effect immediately — no further restart.

## Credentials

The API key is stored as a **credential**; it is never written into the settings file and never appears in session records, and dsh writes the credential document with owner-only permissions. You can also put it in `$DSH_HOME/.credentials.yaml`:

```yaml
TAVILY_API_KEY: tvly-xxxxxxxx
```

or inject it as an environment variable at launch (the environment outranks the file). The reference name defaults to `TAVILY_API_KEY` and can be changed with the `apiKeyEnv` setting.

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
| `enabled` | `false` | The switch. Off falls back to the platform search |
| `apiKeyEnv` | `TAVILY_API_KEY` | Credential reference the API key is read from |
| `baseURL` | `https://api.tavily.com` | Tavily endpoint |
| `allowCustomBaseURL` | `false` | Allow an endpoint other than the public one |
| `maxResults` | `5` | Results per search when the request states no budget |
| `searchDepth` | `basic` | `basic` or `advanced` |
| `searchTimeoutMs` | `30000` | Timeout for one Tavily request |

## Uninstall

```sh
dsh plugin --profile desktop remove dsh-travily-api
```

## Layout

```
lib/index.js        the search provider and the settings section (runs in dsh)
lib/client.js       the Settings card (runs in the browser)
cordis.patch.yml    profile patch: inserts the web-search-tavily row
package.json        plugin manifest
```

## Development

```sh
npm install
npm test                         # offline: settings section, provider, card rendering
node .tools/verify-install.mjs   # end to end: throwaway profile booted on a spare port
node .tools/live-search.mjs      # one real search with your saved switch and key (spends quota)
```

`.tools/verify-install.mjs` builds a throwaway profile under `$DSH_HOME/profiles/travily-verify`, deletes it afterwards, and stops only the process it started itself — it never touches the profile you are using. `.tools/live-search.mjs` does call the real Tavily API.

## License

MIT
