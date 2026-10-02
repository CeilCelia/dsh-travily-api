/**
 * dsh-travily-api — browser half.
 *
 * Contributes the "Tavily web search" card to Settings → Plugins. The card owns
 * the on/off switch (the plugin's `enabled` section field), the Tavily API key
 * (a credential reference, never written into the settings document), and one
 * button that runs a real Tavily search to prove the configuration works.
 *
 * The module body runs only when the client materializes this bundle, so the
 * only require here is the platform seed module `react`; every other capability
 * arrives as a cordis service (slots, locale, remote.credentials, configForms).
 */
window.__ModuleLoader__.load({
  id: 'dsh-travily-api',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const react = require('react')
    const h = react.createElement
    const Fragment = react.Fragment

    /** Settings entry id of this plugin's host row; also its settings namespace. */
    const ENTRY_ID = 'web-search-tavily'
    /** Locale dictionary namespace owned by this card. */
    const NS = 'settings.web-search-tavily'
    /** Credential reference read when the section names none. */
    const DEFAULT_API_KEY_REF = 'TAVILY_API_KEY'
    /** Route the host plugin registers for the connection test. */
    const PROBE_PATH = '/api/tavily/probe'

    const en = {
      title: 'Tavily web search',
      description: 'Route web_search through Tavily. Off keeps the platform provider.',
      summaryOn: 'Tavily is on. web_search uses api.tavily.com.',
      summaryOff: 'Tavily is off. web_search uses the platform provider.',
      enable: 'Use Tavily for web search',
      enableHint: 'Off keeps the platform search provider; nothing is uninstalled.',
      apiKey: 'Tavily API key',
      apiKeyHint: 'Stored as a credential, never in the settings file. Leave blank to keep the current key.',
      keySet: 'Key configured',
      keyUnset: 'No key — Tavily keyless',
      keyClearing: 'Will clear key',
      keyPlaceholderSet: 'Leave blank to keep the current key.',
      keyPlaceholderEmpty: 'Optional: tvly-… Leave blank to use Tavily keyless.',
      keyPlaceholderClear: 'Saving clears the stored key and returns to keyless.',
      clearKey: 'Clear key',
      undoClear: 'Keep key',
      probe: 'Test connection',
      probing: 'Testing…',
      probeOk: 'Connected',
      probeKeyless: 'Connected (keyless)',
      probeFail: 'Failed: ',
      probeTimeout: 'timed out',
      probeInvalidKey: 'invalid key',
      probeNetwork: 'network error',
      probeUnavailable: 'test endpoint unavailable',
      probeUnknown: 'unknown error',
      probeHint: 'Runs one real Tavily search. A stored key spends one credit.',
      discard: 'Discard',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      saveFailed: 'Save failed',
      unsaved: 'Unsaved',
      enabledBadge: 'Enabled',
      readOnly: 'This deployment stores settings read-only.',
    }

    const zh = {
      title: 'Tavily 网页搜索',
      description: '让 web_search 走 Tavily。关闭时仍用平台搜索。',
      summaryOn: '已启用 Tavily，web_search 走 api.tavily.com。',
      summaryOff: '未启用 Tavily，web_search 走平台搜索。',
      enable: '使用 Tavily 进行网页搜索',
      enableHint: '关闭只是切回平台搜索提供方，不会卸载插件。',
      apiKey: 'Tavily API Key',
      apiKeyHint: '以凭证方式保存，不写入设置文件。留空表示保持当前密钥。',
      keySet: '已配置密钥',
      keyUnset: '未配置，走 keyless',
      keyClearing: '将清除密钥',
      keyPlaceholderSet: '留空表示保持当前密钥。',
      keyPlaceholderEmpty: '可选：tvly-…。留空则走 Tavily 无 Key 模式。',
      keyPlaceholderClear: '保存后将清除已存密钥，回到无 Key 模式。',
      clearKey: '清除密钥',
      undoClear: '保留密钥',
      probe: '连通测试',
      probing: '测试中…',
      probeOk: '连通正常',
      probeKeyless: '连通正常（无 Key）',
      probeFail: '失败：',
      probeTimeout: '超时',
      probeInvalidKey: '密钥无效',
      probeNetwork: '网络错误',
      probeUnavailable: '测试入口不可用',
      probeUnknown: '未知错误',
      probeHint: '会向 Tavily 发一次真实搜索；已配置 Key 时消耗 1 个额度。',
      discard: '放弃修改',
      save: '保存',
      saving: '保存中…',
      saved: '已保存',
      saveFailed: '保存失败',
      unsaved: '未保存',
      enabledBadge: '已启用',
      readOnly: '本部署的设置为只读。',
    }

    /** Card-scoped stylesheet, injected once with a version stamp. */
    const CSS = [
      '.tvapi_card{list-style:none;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-3);transition:border-color .16s,background .16s}',
      '.tvapi_card:hover{border-color:var(--dsw-alias-label-dimmed)}',
      '.tvapi_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}',
      '.tvapi_head{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px}',
      '.tvapi_head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}',
      '.tvapi_headText{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}',
      '.tvapi_name{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}',
      '.tvapi_desc{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.tvapi_pending{flex:none;border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}',
      '.tvapi_chevron{flex:none;display:block;width:14px;height:14px;color:var(--dsw-alias-label-tertiary);transition:transform .16s}',
      '.tvapi_chevronOpen{transform:rotate(180deg)}',
      '.tvapi_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}',
      '.tvapi_field{display:flex;flex-direction:column;gap:6px;padding:12px 0}',
      '.tvapi_field+.tvapi_field{border-top:1px solid var(--dsw-alias-border-l2)}',
      '.tvapi_fieldHead{display:flex;align-items:center;gap:8px}',
      '.tvapi_label{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.tvapi_badge{flex:none;border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;white-space:nowrap;font-weight:500;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}',
      '.tvapi_clear{flex:none;appearance:none;border:0;background:none;padding:0;font:inherit;font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap}',
      '.tvapi_clear:hover:not(:disabled){color:var(--dsw-alias-label-primary)}',
      '.tvapi_clear:disabled{opacity:.4;cursor:default}',
      '.tvapi_clear:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.tvapi_hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.tvapi_input{height:34px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}',
      '.tvapi_input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}',
      '.tvapi_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}',
      '.tvapi_switch{flex:none;position:relative;width:36px;height:20px;cursor:pointer;display:block}',
      '.tvapi_switchInput{position:absolute;inset:0;margin:0;opacity:0;cursor:pointer}',
      '.tvapi_switchTrack{display:block;width:36px;height:20px;border-radius:999px;background:var(--dsw-alias-bg-module-platform);transition:background .16s}',
      '.tvapi_switchTrack::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary);transition:transform .16s}',
      '.tvapi_switchInput:checked+.tvapi_switchTrack{background:var(--dsw-alias-brand-primary)}',
      '.tvapi_switchInput:checked+.tvapi_switchTrack::after{transform:translateX(16px);background:#fff}',
      '.tvapi_switchInput:focus-visible+.tvapi_switchTrack{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
      '.tvapi_switchInput:disabled+.tvapi_switchTrack{opacity:.4}',
      '.tvapi_footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:12px 0 4px;border-top:1px solid var(--dsw-alias-border-l2)}',
      '.tvapi_probe{display:flex;align-items:center;gap:8px;flex:1;min-width:0}',
      '.tvapi_probeStatus{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tvapi_probeFail{color:var(--dsw-alias-label-error)}',
      '.tvapi_probeOk{color:var(--dsw-alias-label-primary)}',
      '.tvapi_actions{display:flex;align-items:center;gap:8px;flex:none;margin-left:auto}',
      '.tvapi_failed{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-error);white-space:nowrap}',
      '.tvapi_saved{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary);white-space:nowrap}',
      '.tvapi_btn{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer}',
      '.tvapi_btnGhost{border-color:var(--dsw-alias-border-l2);background:none;color:var(--dsw-alias-label-secondary)}',
      '.tvapi_btnGhost:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}',
      '.tvapi_btnPrimary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}',
      '.tvapi_btn:disabled{opacity:.4;cursor:default}',
      '.tvapi_btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
    ].join('')

    /** Inject the card stylesheet once; returns its disposer. */
    function injectCss() {
      if (typeof document === 'undefined') return () => {}
      const previous = document.querySelector('style[data-tvapi-css]')
      if (previous !== null) previous.remove()
      const tag = document.createElement('style')
      tag.setAttribute('data-tvapi-css', '1')
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        tag.remove()
      }
    }

    /** The credential view a page reads out of a remote describe answer. */
    function credentialView(response, ref) {
      const result = response?.result ?? response
      if (result?.ok !== true) return { configured: false, writable: true }
      const map = result.value?.credentials ?? result.value ?? {}
      const view = map?.[ref]
      return {
        configured: view?.configured === true,
        writable: view?.writable !== false,
      }
    }

    /** The current value a settings form reports for one field. */
    function scopeValue(scope, field) {
      const snapshot = scope.getSnapshot()
      const value = snapshot?.value?.[field]
      return value === undefined || value === null ? undefined : value
    }

    /**
     * The card's state machine: the section's switch over `configForms`, the key
     * over the credentials Remote, and one probe round trip. Nothing is written
     * until Save, so a stray click can never change what a search does.
     */
    class TavilyCardController {
      constructor(unusedForm, ctx) {
        this.ctx = ctx
        this.scope = ctx.configForms.get(ENTRY_ID)
        this.enabled = false
        this.enabledWritable = true
        this.apiKeyRef = DEFAULT_API_KEY_REF
        this.keyConfigured = false
        this.keyWritable = true
        this.draftEnabled = false
        this.draftKey = ''
        this.clearKey = false
        this.saving = false
        this.failed = false
        this.saved = false
        this.probing = false
        this.probeStatus = 'idle'
        this.probeMode = undefined
        this.probeFail = undefined
        this.subscription = this.scope.subscribe(() => {
          this.syncFromScope()
          this.publish()
        })
        this.syncFromScope()
        this.store = createStore(this.projection())
        void this.refreshCredential()
      }

      /** Read the section fields into the effective (saved) state. */
      syncFromScope() {
        const snapshot = this.scope.getSnapshot()
        this.enabled = scopeValue(this.scope, 'enabled') === true
        this.enabledWritable = snapshot?.writable !== false
        const declared = scopeValue(this.scope, 'apiKeyEnv')
        this.apiKeyRef =
          typeof declared === 'string' && declared.length > 0 ? declared : DEFAULT_API_KEY_REF
        if (!this.dirty()) {
          this.draftEnabled = this.enabled
        }
      }

      /** Whether a save would change anything. */
      dirty() {
        return (
          this.clearKey ||
          this.draftEnabled !== this.enabled ||
          this.draftKey.trim().length > 0
        )
      }

      /** The immutable view the card renders. */
      projection() {
        return {
          available: this.scope.getSnapshot()?.status === 'ready',
          writable: this.enabledWritable,
          enabled: this.draftEnabled,
          enabledWritable: this.enabledWritable,
          keyConfigured: this.keyConfigured,
          keyWritable: this.keyWritable,
          apiKeyRef: this.apiKeyRef,
          draftKey: this.draftKey,
          clearKey: this.clearKey,
          dirty: this.dirty(),
          saving: this.saving,
          failed: this.failed,
          saved: this.saved,
          probing: this.probing,
          probeStatus: this.probeStatus,
          probeMode: this.probeMode,
          probeFail: this.probeFail,
        }
      }

      publish() {
        this.store.set(this.projection())
      }

      /** Re-read whether the reference currently holds a value. */
      async refreshCredential() {
        try {
          const response = await this.ctx.remote.credentials.describe([this.apiKeyRef])
          const view = credentialView(response, this.apiKeyRef)
          this.keyConfigured = view.configured
          this.keyWritable = view.writable
        } catch {
          this.keyConfigured = false
          this.keyWritable = true
        }
        this.publish()
      }

      /** The face the slot registration injects into the card component. */
      inject() {
        return {
          hooks: { tavilyCard: this.store },
          setEnabled: (value) => {
            this.draftEnabled = value === true
            this.failed = false
            this.saved = false
            this.resetProbe()
            this.publish()
          },
          setKey: (text) => {
            this.draftKey = text
            this.clearKey = false
            this.failed = false
            this.saved = false
            this.resetProbe()
            this.publish()
          },
          stageClearKey: () => {
            this.draftKey = ''
            this.clearKey = true
            this.failed = false
            this.saved = false
            this.resetProbe()
            this.publish()
          },
          undoClearKey: () => {
            this.clearKey = false
            this.failed = false
            this.saved = false
            this.publish()
          },
          discard: () => {
            this.draftEnabled = this.enabled
            this.draftKey = ''
            this.clearKey = false
            this.failed = false
            this.saved = false
            this.resetProbe()
            this.publish()
          },
          save: () => this.save(),
          probe: () => this.probe(),
        }
      }

      resetProbe() {
        if (this.probing) return
        this.probeStatus = 'idle'
        this.probeMode = undefined
        this.probeFail = undefined
      }

      /** Run one real Tavily search and report the outcome. */
      async probe() {
        if (this.probing || this.saving) return
        this.probing = true
        this.probeStatus = 'testing'
        this.probeMode = undefined
        this.probeFail = undefined
        this.publish()
        try {
          const draft = this.draftKey.trim()
          const body = {}
          if (draft.length > 0) body.apiKey = draft
          else if (this.clearKey) body.clearKey = true
          const response = await fetch(PROBE_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify(body),
          })
          let payload = {}
          try {
            payload = await response.json()
          } catch {
            payload = {}
          }
          if (response.status === 404) {
            this.probeStatus = 'fail'
            this.probeFail = { code: 'unavailable' }
          } else if (payload?.ok === true) {
            this.probeStatus = 'ok'
            this.probeMode = payload.mode === 'key' ? 'key' : 'keyless'
            this.probeFail = undefined
          } else {
            this.probeStatus = 'fail'
            this.probeFail = {
              code: typeof payload?.code === 'string' ? payload.code : 'other',
              status: typeof payload?.status === 'number' ? payload.status : response.status,
              error: typeof payload?.error === 'string' ? payload.error : '',
            }
          }
        } catch {
          this.probeStatus = 'fail'
          this.probeFail = { code: 'network' }
        }
        this.probing = false
        this.publish()
      }

      /** Write the staged switch, then the staged key, in that order. */
      async save() {
        if (this.saving || !this.scope.getSnapshot().writable) return
        const nextEnabled = this.draftEnabled
        const nextKey = this.draftKey.trim()
        const clearing = this.clearKey
        this.saving = true
        this.failed = false
        this.saved = false
        this.publish()
        let landed = true
        try {
          if (this.enabledWritable && nextEnabled !== this.enabled) {
            landed = (await this.scope.set('enabled', nextEnabled)) && landed
          }
          if (landed && this.keyWritable) {
            if (nextKey.length > 0) {
              const response = await this.ctx.remote.credentials.set(this.apiKeyRef, nextKey)
              landed = response?.result?.ok !== false && response?.ok !== false
            } else if (clearing && this.removableRef()) {
              const response = await this.ctx.remote.credentials.unset(this.apiKeyRef)
              landed = response?.result?.ok !== false && response?.ok !== false
            }
          }
        } catch {
          landed = false
        }
        if (landed) {
          this.draftKey = ''
          this.clearKey = false
          await this.refreshCredential()
          this.syncFromScope()
          this.draftEnabled = this.enabled
          this.saved = true
        } else {
          this.failed = true
        }
        this.saving = false
        this.publish()
      }

      /**
       * Whether the section carries an explicit reference this card can remove.
       * Without one the reference is only the default name, so a clear stages
       * nothing: an absent key already means keyless.
       */
      removableRef() {
        const declared = scopeValue(this.scope, 'apiKeyEnv')
        return typeof declared === 'string' && declared.length > 0
      }

      dispose() {
        this.subscription?.()
      }
    }

    /** Minimal snapshot store: `useSyncExternalStore` over a cached snapshot. */
    function createStore(initial) {
      let snapshot = initial
      const listeners = new Set()
      return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        set: (next) => {
          snapshot = next
          for (const listener of [...listeners]) listener()
        },
      }
    }

    /** Localized text for one probe failure. */
    function probeFailText(t, fail) {
      const prefix = t('probeFail')
      const code = fail?.code
      if (code === 'timeout') return prefix + t('probeTimeout')
      if (code === 'invalid_key') return prefix + t('probeInvalidKey')
      if (code === 'network') return prefix + t('probeNetwork')
      if (code === 'unavailable') return prefix + t('probeUnavailable')
      if (code === 'http') return prefix + 'HTTP ' + String(fail.status ?? '')
      const extra = typeof fail?.error === 'string' ? fail.error : ''
      return prefix + (extra.length > 0 ? extra : t('probeUnknown'))
    }

    /** The chevron glyph the disclosure header uses. */
    function Chevron(open) {
      return h(
        'svg',
        {
          className: open ? 'tvapi_chevron tvapi_chevronOpen' : 'tvapi_chevron',
          width: 14,
          height: 14,
          viewBox: '0 0 14 14',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': true,
        },
        h('path', {
          d: 'M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z',
          fill: 'currentColor',
        }),
      )
    }

    /** One labelled row inside the expanded card. */
    function Field(label, control, badge, action) {
      return h(
        'div',
        { className: 'tvapi_field' },
        h(
          'div',
          { className: 'tvapi_fieldHead' },
          h('span', { className: 'tvapi_label' }, label),
          badge === undefined ? null : h('span', { className: 'tvapi_badge' }, badge),
          action === undefined ? null : action,
        ),
        control,
      )
    }

    /** The "Tavily web search" card. */
    function TavilyCard(props) {
      const t = props.t
      const state = props.useTavilyCard((snapshot) => snapshot)
      const [open, setOpen] = react.useState(false)
      if (props.view === 'summary') {
        return h(
          'span',
          null,
          t('description') + ' ' + (state.enabled ? t('summaryOn') : t('summaryOff')),
        )
      }

      const blocked = !state.dirty || state.saving || !state.writable
      const keyPlaceholder = state.clearKey
        ? t('keyPlaceholderClear')
        : state.keyConfigured
          ? t('keyPlaceholderSet')
          : t('keyPlaceholderEmpty')
      const keyBadge = state.clearKey
        ? t('keyClearing')
        : state.keyConfigured
          ? t('keySet')
          : t('keyUnset')

      const switchControl = h(
        'label',
        { className: 'tvapi_switch', title: t('enable') },
        h('input', {
          className: 'tvapi_switchInput',
          type: 'checkbox',
          role: 'switch',
          'aria-checked': state.enabled,
          'aria-label': t('enable'),
          checked: state.enabled,
          disabled: !state.enabledWritable,
          onChange: (event) => {
            props.setEnabled(event.target.checked)
          },
        }),
        h('span', { className: 'tvapi_switchTrack', 'aria-hidden': true }),
      )

      const keyField = Field(
        t('apiKey'),
        h(
          Fragment,
          null,
          h('input', {
            className: 'tvapi_input',
            type: 'password',
            autoComplete: 'new-password',
            placeholder: keyPlaceholder,
            value: state.draftKey,
            disabled: !state.keyWritable,
            onChange: (event) => {
              props.setKey(event.target.value)
            },
          }),
          h(
            'p',
            { className: 'tvapi_hint' },
            state.clearKey ? t('keyPlaceholderClear') : t('apiKeyHint'),
          ),
        ),
        keyBadge,
        state.clearKey
          ? h(
              'button',
              {
                type: 'button',
                className: 'tvapi_clear',
                disabled: state.saving,
                onClick: props.undoClearKey,
              },
              t('undoClear'),
            )
          : state.keyConfigured && state.keyWritable
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'tvapi_clear',
                  disabled: state.saving,
                  onClick: props.stageClearKey,
                },
                t('clearKey'),
              )
            : null,
      )

      const probeStatus =
        state.probeStatus === 'ok'
          ? h(
              'p',
              { className: 'tvapi_probeStatus tvapi_probeOk', role: 'status' },
              state.probeMode === 'keyless' ? t('probeKeyless') : t('probeOk'),
            )
          : state.probeStatus === 'fail'
            ? h(
                'p',
                { className: 'tvapi_probeStatus tvapi_probeFail', role: 'status' },
                probeFailText(t, state.probeFail),
              )
            : null

      const footer = h(
        'div',
        { className: 'tvapi_footer' },
        h(
          'div',
          { className: 'tvapi_probe' },
          h(
            'button',
            {
              type: 'button',
              className: 'tvapi_btn tvapi_btnGhost',
              disabled: state.probing || state.saving,
              title: t('probeHint'),
              onClick: props.probe,
            },
            state.probing ? t('probing') : t('probe'),
          ),
          probeStatus,
        ),
        h(
          'div',
          { className: 'tvapi_actions' },
          state.failed
            ? h('p', { className: 'tvapi_failed', role: 'status' }, t('saveFailed'))
            : state.saved && !state.dirty
              ? h('p', { className: 'tvapi_saved', role: 'status' }, t('saved'))
              : null,
          h(
            'button',
            {
              type: 'button',
              className: 'tvapi_btn tvapi_btnGhost',
              disabled: !state.dirty || state.saving,
              onClick: props.discard,
            },
            t('discard'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'tvapi_btn tvapi_btnPrimary',
              disabled: blocked,
              onClick: props.save,
            },
            state.saving ? t('saving') : t('save'),
          ),
        ),
      )

      return h(
        'li',
        { className: open ? 'tvapi_card tvapi_cardOpen' : 'tvapi_card' },
        h(
          'button',
          {
            type: 'button',
            className: 'tvapi_head',
            'aria-expanded': open,
            onClick: () => {
              setOpen(!open)
            },
          },
          h(
            'span',
            { className: 'tvapi_headText' },
            h('span', { className: 'tvapi_name' }, t('title')),
            h('span', { className: 'tvapi_desc' }, t('description')),
          ),
          state.dirty
            ? h('span', { className: 'tvapi_pending' }, t('unsaved'))
            : state.enabled
              ? h('span', { className: 'tvapi_pending' }, t('enabledBadge'))
              : null,
          Chevron(open),
        ),
        open
          ? h(
              'div',
              { className: 'tvapi_body' },
              !state.writable ? h('p', { className: 'tvapi_hint' }, t('readOnly')) : null,
              !state.available ? h('p', { className: 'tvapi_hint' }, t('probeUnavailable')) : null,
              Field(t('enable'), h('p', { className: 'tvapi_hint' }, t('enableHint')), undefined, switchControl),
              keyField,
              footer,
            )
          : null,
      )
    }

    const inject = ['slots', 'locale', 'remote', 'remote.credentials', 'configForms']

    function apply(ctx) {
      ctx.effect(() => injectCss(), 'dsh-travily-api: card styles')
      const t = ctx.locale.bind(NS)
      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        'dsh-travily-api: dictionaries',
      )
      const card = new TavilyCardController(undefined, ctx)
      ctx.effect(() => () => card.dispose(), 'dsh-travily-api: form subscription')
      ctx.effect(
        () =>
          ctx.remote.$on('credentials/reference-updated', (ref) => {
            if (ref !== card.apiKeyRef) return
            void card.refreshCredential()
          }),
        'dsh-travily-api: credential invalidations',
      )
      ctx.effect(
        () =>
          ctx.configForms.whileServed([ENTRY_ID], () =>
            ctx.slots.inject('plugins.item', () =>
              ctx.slots.register(
                {
                  name: 'plugins.item',
                  id: 'tavily',
                  key: ENTRY_ID,
                  order: 45,
                  label: () => t('title'),
                  locale: NS,
                  inject: () => card.inject(),
                },
                TavilyCard,
              ),
            ),
          ),
        'dsh-travily-api: settings card',
      )
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
