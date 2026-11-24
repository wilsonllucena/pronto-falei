'use client'

import { Button, useConfig, useDocumentInfo, useForm } from '@payloadcms/ui'
import React, { useCallback, useEffect, useRef, useState } from 'react'

type Result = { summary: string; keyPoints: string[] }
type Status =
  | { status: 'idle' }
  | { status: 'queued' | 'running'; jobId: string; startedAt: string }
  | { status: 'done'; jobId: string; result: Result & { model: string; durationMs: number } }
  | { status: 'error'; jobId: string; error: string; fallback: Result | null }

type View =
  | { kind: 'idle' }
  | { kind: 'working'; since: number }
  | { kind: 'done'; model: string; seconds: number }
  | { kind: 'error'; error: string; fallback: Result | null }
  | { kind: 'fallback-applied' }

const POLL_MS = 5000

/**
 * Botão "Gerar síntese com IA" na aba Síntese do post. Enfileira o job,
 * consulta o status a cada 5 s e, quando termina, preenche síntese e
 * pontos-chave no formulário como sugestão (origem "IA", sem revisão).
 */
export function GenerateSummary() {
  const { id } = useDocumentInfo()
  const {
    config: {
      routes: { api },
    },
  } = useConfig()
  const { addFieldRow, dispatchFields, getDataByPath, removeFieldRow, setModified } = useForm()
  const [view, setView] = useState<View>({ kind: 'idle' })
  const [now, setNow] = useState(() => Date.now())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handled = useRef<string | null>(null)
  const pollRef = useRef<((applyWhenDone: boolean) => Promise<void>) | null>(null)
  const base = id ? `${api}/posts/${id}` : null

  const apply = useCallback(
    (r: Result, source: 'ia' | 'extrativo', model: string) => {
      dispatchFields({ type: 'UPDATE', path: 'summary', value: r.summary, valid: true })
      const rows = (getDataByPath('keyPoints') as unknown[] | undefined) ?? []
      for (let i = rows.length - 1; i >= 0; i--) removeFieldRow({ path: 'keyPoints', rowIndex: i })
      r.keyPoints.forEach((text, rowIndex) =>
        addFieldRow({
          path: 'keyPoints',
          rowIndex,
          schemaPath: 'posts.keyPoints',
          subFieldState: { text: { value: text, initialValue: undefined, valid: true } },
        }),
      )
      dispatchFields({ type: 'UPDATE', path: 'summarySource', value: source, valid: true })
      dispatchFields({ type: 'UPDATE', path: 'summaryReviewed', value: false, valid: true })
      dispatchFields({ type: 'UPDATE', path: 'summaryModel', value: model, valid: true })
      dispatchFields({
        type: 'UPDATE',
        path: 'summaryGeneratedAt',
        value: new Date().toISOString(),
        valid: true,
      })
      setModified(true)
    },
    [addFieldRow, dispatchFields, getDataByPath, removeFieldRow, setModified],
  )

  const poll = useCallback(
    async (applyWhenDone: boolean) => {
      if (!base) return
      const res = await fetch(`${base}/summary-status`, { credentials: 'include' })
      if (!res.ok) {
        setView({ kind: 'error', error: `status ${res.status}`, fallback: null })
        return
      }
      const s = (await res.json()) as Status
      if (s.status === 'queued' || s.status === 'running') {
        setView((v) =>
          v.kind === 'working' ? v : { kind: 'working', since: Date.parse(s.startedAt) },
        )
        timer.current = setTimeout(() => void pollRef.current?.(true), POLL_MS)
        return
      }
      if (!applyWhenDone || handled.current === ('jobId' in s ? s.jobId : null)) {
        return
      }
      if (s.status === 'done') {
        handled.current = s.jobId
        apply(s.result, 'ia', s.result.model)
        setView({
          kind: 'done',
          model: s.result.model,
          seconds: Math.round(s.result.durationMs / 1000),
        })
      } else if (s.status === 'error') {
        handled.current = s.jobId
        setView({ kind: 'error', error: s.error, fallback: s.fallback })
      }
    },
    [apply, base],
  )

  // ao abrir o post, retoma se já tem uma síntese em andamento
  useEffect(() => {
    pollRef.current = poll
    const first = setTimeout(() => void poll(false), 0)
    return () => {
      clearTimeout(first)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [poll])

  useEffect(() => {
    if (view.kind !== 'working') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [view.kind])

  const start = async () => {
    if (!base) return
    setView({ kind: 'working', since: Date.now() })
    const res = await fetch(`${base}/generate-summary`, { method: 'POST', credentials: 'include' })
    if (res.status !== 202) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setView({ kind: 'error', error: body.error || `erro ${res.status}`, fallback: null })
      return
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void pollRef.current?.(true), 1500)
  }

  const working = view.kind === 'working'
  const elapsed = working ? Math.max(0, Math.round((now - view.since) / 1000)) : 0

  return (
    <div className="pf-ai" data-state={view.kind}>
      <div className="pf-ai__row">
        <Button
          buttonStyle="secondary"
          size="medium"
          margin={false}
          disabled={!base || working}
          onClick={() => void start()}
          className="pf-ai__button"
        >
          {working ? 'Gerando…' : 'Gerar síntese com IA'}
        </Button>
        <p className="pf-ai__hint">
          {!base
            ? 'Salve o rascunho primeiro: a IA lê o último rascunho salvo.'
            : 'IA local (só texto, roda no servidor do blog). Lê o último rascunho salvo e preenche a síntese e os pontos-chave como sugestão; nada é publicado sozinho.'}
        </p>
      </div>
      {working && (
        <p className="pf-ai__status" role="status">
          Gerando com a IA local, leva uns 2 min… ({elapsed} s)
        </p>
      )}
      {view.kind === 'done' && (
        <p className="pf-ai__status pf-ai__status--ok" role="status">
          Síntese gerada por <strong>{view.model}</strong> em {view.seconds} s. Revise o texto e
          marque “Síntese revisada” antes de publicar.
        </p>
      )}
      {view.kind === 'error' && (
        <div className="pf-ai__status pf-ai__status--error" role="alert">
          <p>A IA não conseguiu gerar a síntese: {view.error}.</p>
          {view.fallback && (
            <>
              <p>
                Dá pra começar por um resumo extrativo (linha fina e primeiro parágrafo) e editar à
                mão:
              </p>
              <Button
                buttonStyle="secondary"
                size="small"
                margin={false}
                className="pf-ai__fallback"
                onClick={() => {
                  apply(view.fallback!, 'extrativo', '')
                  setView({ kind: 'fallback-applied' })
                }}
              >
                Usar resumo extrativo
              </Button>
            </>
          )}
        </div>
      )}
      {view.kind === 'fallback-applied' && (
        <p className="pf-ai__status" role="status">
          Resumo extrativo aplicado. Ajuste o texto e marque “Síntese revisada” antes de publicar.
        </p>
      )}
    </div>
  )
}
