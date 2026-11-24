'use client'

import React, { useEffect, useRef, useState } from 'react'

type Theme = 'light' | 'dark'

declare global {
  interface Window {
    remark_config?: Record<string, unknown>
    REMARK42?: { changeTheme?: (t: Theme) => void; destroy?: () => void }
  }
}

function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

type Props = { siteId: string; url: string; title: string }

/**
 * Comentários (Remark42 servido em /comentarios pelo próprio blog).
 * Lazy: o script só carrega quando a seção chega perto da tela. Segue o tema
 * claro/escuro do site, inclusive quando o leitor troca no botão.
 */
export function Comments({ siteId, url, title }: Props) {
  const section = useRef<HTMLElement>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle')

  useEffect(() => {
    const el = section.current
    if (!el) return
    let script: HTMLScriptElement | null = null
    const load = () => {
      if (script) return
      setState('loading')
      window.remark_config = {
        host: `${window.location.origin}/comentarios`,
        site_id: siteId,
        url,
        page_title: title,
        components: ['embed'],
        theme: currentTheme(),
        locale: 'bp',
        no_footer: true,
        show_email_subscription: false,
        show_rss_subscription: false,
        max_shown_comments: 20,
      }
      script = document.createElement('script')
      script.src = '/comentarios/web/embed.mjs'
      script.type = 'module'
      script.async = true
      script.onload = () => setState('ready')
      document.body.appendChild(script)
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          load()
        }
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)

    const syncTheme = () => window.REMARK42?.changeTheme?.(currentTheme())
    const mo = new MutationObserver(syncTheme)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', syncTheme)

    return () => {
      io.disconnect()
      mo.disconnect()
      mq.removeEventListener('change', syncTheme)
      window.REMARK42?.destroy?.()
      script?.remove()
    }
  }, [siteId, url, title])

  return (
    <section
      className="comments"
      id="comentarios"
      aria-labelledby="comentarios-titulo"
      ref={section}
    >
      <h2 id="comentarios-titulo" className="comments__title">
        Comentários
      </h2>
      <p className="comments__note">
        Comente só com um nome, sem cadastro. Os comentários são moderados: spam e ofensas são apagados.
      </p>
      {state !== 'ready' && (
        <p className="comments__loading" aria-live="polite">
          {state === 'loading'
            ? 'Carregando comentários…'
            : 'Os comentários carregam quando você chegar aqui.'}
        </p>
      )}
      <div id="remark42" />
    </section>
  )
}
