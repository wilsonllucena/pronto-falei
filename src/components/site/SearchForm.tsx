import React from 'react'

/** Formulário da busca (GET /busca?q=). Funciona sem JavaScript. */
export function SearchForm({
  defaultValue = '',
  autoFocus = false,
  id = 'busca-q',
  compact = false,
}: {
  defaultValue?: string
  autoFocus?: boolean
  id?: string
  compact?: boolean
}) {
  return (
    <form
      action="/busca"
      method="get"
      role="search"
      className={`search-form${compact ? ' search-form--compact' : ''}`}
    >
      <label htmlFor={id} className="sr-only">
        Buscar no blog
      </label>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="search-form__icon">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </svg>
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Buscar textos, tags, assuntos…"
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
        autoFocus={autoFocus}
        className="search-form__input"
      />
      <kbd className="search-form__kbd" aria-hidden="true">
        /
      </kbd>
      <button type="submit" className="btn search-form__btn">
        Buscar
      </button>
    </form>
  )
}
