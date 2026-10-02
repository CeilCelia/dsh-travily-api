# Third-party notices

This package is distributed under the MIT License (see `LICENSE`). Parts of it
derive from the following MIT-licensed projects, whose notices are reproduced
here as their licenses require.

## dsh-tavily — https://github.com/SZMY-haruhi/dsh-tavily

`lib/client.js` is a port of this plugin's settings card to the current dsh
plugin API: the card's layout and interaction model (collapsible header, on/off
switch, write-only key field, connection-test button, discard/save footer), its
stylesheet, and the credential-reference and Tavily-request helpers the card and
`lib/index.js` rely on. The port renames the stylesheet's class prefix, replaces
the slot and settings plumbing, and reworks the state handling, so no file is a
verbatim copy — but the derivation is direct and this notice is owed.

`lib/index.js` also follows this plugin's provider design: the `tavily` provider
id, delegating to the platform provider while the switch is off, resolving the
key from a credential reference with an environment fallback, and the shape of
the probe endpoint's response.

```
MIT License

Copyright (c) 2026 SZMY-haruhi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## dsh-web-search-tavily — https://github.com/renchengxiang/dsh-web-search-tavily

Consulted while porting the settings card to the current client APIs (plugin
configuration forms, the Plugins panel's slots, and the credentials Remote).
No code from this project is included.

```
MIT License

Copyright (c) 2026 renchengxiang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
