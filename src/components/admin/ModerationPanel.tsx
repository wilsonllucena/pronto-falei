'use client'

import { Button, useConfig } from '@payloadcms/ui'
import React, { useCallback, useEffect, useState } from 'react'

type Comment = {
  id: string
  text: string
  url: string
  time: string
  user: { id: string; name: string }
}
type Blocked = { id: string; name: string; until: string | null }
type Data = { comments: Comment[]; blocked: Blocked[] }

const fmt = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      })
}

async function fetchRecent(api: string): Promise<Data | { error: string }> {
  try {
    const res = await fetch(`${api}/comentarios/recentes`, { credentials: 'include' })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? res.status)
    return body as Data
  } catch (e) {
    return { error: `Não deu pra ler os comentários: ${(e as Error).message}` }
  }
}

export function ModerationPanel() {
  const {
    config: {
      routes: { api },
    },
  } = useConfig()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let alive = true
    fetchRecent(api).then((r) => {
      if (!alive) return
      if ('error' in r) setError(r.error)
      else {
        setData(r)
        setError(null)
      }
    })
    return () => {
      alive = false
    }
  }, [api, version])

  const act = async (key: string, payload: Record<string, string>, confirmText: string) => {
    if (!window.confirm(confirmText)) return
    setBusy(key)
    try {
      const res = await fetch(`${api}/comentarios/moderar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.status)
      reload()
    } catch (e) {
      setError(`Falhou: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  if (error) return <p className="moderation__error">{error}</p>
  if (!data) return <p>Carregando…</p>

  return (
    <div className="moderation">
      {data.comments.length === 0 && <p>Nenhum comentário ainda.</p>}
      <ul className="moderation__list">
        {data.comments.map((c) => (
          <li key={c.id} className="moderation__item" data-comment-id={c.id}>
            <div className="moderation__meta">
              <strong>{c.user.name}</strong> · {fmt(c.time)} ·{' '}
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.url.replace(/^https?:\/\/[^/]+/, '')}
              </a>
            </div>
            <p className="moderation__text">{c.text}</p>
            <div className="moderation__actions">
              <Button
                buttonStyle="secondary"
                size="small"
                disabled={busy !== null}
                onClick={() =>
                  act(
                    `d-${c.id}`,
                    { action: 'apagar', id: c.id, url: c.url },
                    'Apagar este comentário?',
                  )
                }
              >
                Apagar
              </Button>
              <Button
                buttonStyle="secondary"
                size="small"
                disabled={busy !== null}
                onClick={() =>
                  act(
                    `b-${c.id}`,
                    { action: 'bloquear', userId: c.user.id },
                    `Bloquear ${c.user.name}?`,
                  )
                }
              >
                Bloquear autor
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <h2>Bloqueados</h2>
      {data.blocked.length === 0 ? (
        <p>Ninguém bloqueado.</p>
      ) : (
        <ul className="moderation__list">
          {data.blocked.map((u) => (
            <li key={u.id} className="moderation__item" data-blocked-id={u.id}>
              <strong>{u.name || u.id}</strong>
              <Button
                buttonStyle="secondary"
                size="small"
                disabled={busy !== null}
                onClick={() =>
                  act(
                    `u-${u.id}`,
                    { action: 'desbloquear', userId: u.id },
                    `Desbloquear ${u.name}?`,
                  )
                }
              >
                Desbloquear
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
