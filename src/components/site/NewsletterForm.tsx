'use client'

import React, { useId, useState } from 'react'

type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'ok' | 'error'; message: string }

/** Formulário de inscrição (confirmação dupla pelo Listmonk). */
export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const id = useId()
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setState({ kind: 'sending' })
    try {
      const res = await fetch('/api/newsletter/inscrever', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), website: data.get('website') }),
      })
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      if (res.ok) setState({ kind: 'ok', message: body.message ?? 'Pronto! Confira seu e-mail.' })
      else setState({ kind: 'error', message: body.error ?? 'Não deu certo. Tente de novo.' })
    } catch {
      setState({ kind: 'error', message: 'Sem conexão. Tente de novo.' })
    }
  }

  if (state.kind === 'ok') {
    return (
      <p className="newsletter__done" role="status">
        {state.message}
      </p>
    )
  }

  return (
    <form
      className={`newsletter__form${compact ? ' newsletter__form--compact' : ''}`}
      onSubmit={onSubmit}
    >
      <label className="newsletter__label" htmlFor={`${id}-email`}>
        Seu e-mail
      </label>
      <div className="newsletter__row">
        <input
          id={`${id}-email`}
          className="newsletter__input"
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="voce@exemplo.com"
        />
        <button className="btn" type="submit" disabled={state.kind === 'sending'}>
          {state.kind === 'sending' ? 'Enviando…' : 'Assinar'}
        </button>
      </div>
      {/* isca pra robôs: fica fora da tela e fora da navegação */}
      <div className="newsletter__trap" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Site</label>
        <input id={`${id}-website`} type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.kind === 'error' && (
        <p className="newsletter__error" role="alert">
          {state.message}
        </p>
      )}
      <p className="newsletter__fine">
        Confirmação dupla: só entra quem clicar no link do e-mail. Dá pra sair com um clique em
        qualquer edição.
      </p>
    </form>
  )
}
