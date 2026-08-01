import { useCallback, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import './PlayerApp.css'
import { bingoBallLabel } from './bingo-ball'

type Ball = { id: string; number: number; drawOrder: number }
type Cell = { id: string; row: number; column: number; number: number | null; isFree: boolean }
type Winner = { id: string; cardId: string; type: string }
type PlayerCard = {
  id: string
  serial: string
  number?: number | null
  cells: Cell[]
  game: {
    id: string
    name: string
    status: string
    winningType: string
    patternName?: string | null
    winningCells: Array<{ row: number; column: number }>
    drawnBalls: Ball[]
    winners: Winner[]
  } | null
}

class HttpError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

const columns = ['B', 'I', 'N', 'G', 'O']

function PlayerApp() {
  const [token, setToken] = useState(() => {
    const linkToken = new URLSearchParams(window.location.search).get('token')
    if (linkToken) {
      sessionStorage.setItem('fecs-player-token', linkToken)
      window.history.replaceState({}, '', window.location.pathname)
      return linkToken
    }
    return sessionStorage.getItem('fecs-player-token') ?? ''
  })
  const [tokenDraft, setTokenDraft] = useState('')
  const [player, setPlayer] = useState<{ id: string; name: string } | null>(null)
  const [cards, setCards] = useState<PlayerCard[]>([])
  const [marks, setMarks] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem('fecs-bingo-marks') ?? '{}') as Record<string, string[]> } catch { return {} }
  })
  const [message, setMessage] = useState('')
  const [loginMessage, setLoginMessage] = useState('')

  const request = useCallback(async (path: string) => {
    const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } })
    const body = await response.json()
    if (!response.ok) throw new HttpError(body.message ?? 'No fue posible ingresar', response.status)
    return body
  }, [token])

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const [nextPlayer, nextCards] = await Promise.all([request('/api/player/me'), request('/api/player/cards')]) as [{ id: string; name: string }, PlayerCard[]]
      setPlayer(nextPlayer); setCards(nextCards); setMessage('')
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'No fue posible cargar los cartones'
      if (error instanceof HttpError && error.status === 401) {
        sessionStorage.removeItem('fecs-player-token')
        setLoginMessage(nextMessage)
        setToken('')
        return
      }
      setMessage(nextMessage)
    }
  }, [request, token])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (!token) return
    const socket = io('/draws', { auth: { token } })
    const sync = () => void refresh()
    socket.on('ball:drawn', sync); socket.on('winner:detected', sync); socket.on('game:updated', sync)
    return () => { socket.disconnect() }
  }, [refresh, token])

  const winningCards = useMemo(() => cards.filter((card) => card.game?.winners.some((winner) => winner.cardId === card.id)), [cards])

  const toggleMark = (cardId: string, cellId: string) => {
    setMarks((current) => {
      const cardMarks = new Set(current[cardId] ?? [])
      if (cardMarks.has(cellId)) cardMarks.delete(cellId); else cardMarks.add(cellId)
      const next = { ...current, [cardId]: [...cardMarks] }
      localStorage.setItem('fecs-bingo-marks', JSON.stringify(next))
      return next
    })
  }

  if (!token) return <main className="player-login"><form onSubmit={(event) => { event.preventDefault(); setLoginMessage(''); sessionStorage.setItem('fecs-player-token', tokenDraft); setToken(tokenDraft) }}><p className="organization">FECSUPOL</p><h1>Mis cartones</h1>{loginMessage && <p className="player-message" role="status">{loginMessage}</p>}<label>Token de acceso<input required type="password" value={tokenDraft} onChange={(event) => setTokenDraft(event.target.value)} /></label><button>Ingresar</button><a href="/">Administración</a></form></main>

  return <main className="player-view">
    <header><div><p className="organization">FECSUPOL</p><h1>Bingo Virtual</h1><p>{player ? `Hola, ${player.name}` : 'Cargando…'}</p></div><button onClick={() => { sessionStorage.removeItem('fecs-player-token'); setToken('') }}>Salir</button></header>
    {message && <p className="player-message">{message}</p>}
    {winningCards.length > 0 && <div className="winner-banner" role="alert"><strong>¡BINGO!</strong><span>Ganaste con {winningCards.length === 1 ? 'tu cartón' : `${winningCards.length} cartones`}.</span></div>}
    {!cards.length && !message && <section className="empty-state"><h2>Aún no tienes cartones asignados</h2><p>Cuando FECSUPOL te asigne un cartón aparecerá aquí.</p></section>}
    <div className="player-cards">{cards.map((card) => {
      const game = card.game
      if (!game) return <article className="player-card" key={card.id}><div className="card-top"><div><h2>Cartón #{card.number ?? '—'}</h2><span>Asignación permanente</span></div></div><p className="objective">Esperando el primer sorteo de FECSUPOL.</p></article>
      const drawn = new Set(game.drawnBalls.map((ball) => ball.number))
      const required = new Set(game.winningCells.map((cell) => `${cell.row}:${cell.column}`))
      const latest = game.drawnBalls.at(-1)
      const winner = game.winners.some((item) => item.cardId === card.id)
      return <article className={`player-card ${winner ? 'is-winner' : ''}`} key={card.id}>
        <div className="card-top"><div><h2>{game.name}</h2><span>Cartón #{card.number ?? '—'} · {game.status}</span></div><div className="latest-player-ball"><small>Última</small><strong>{latest ? bingoBallLabel(latest.number) : '—'}</strong></div></div>
        <p className="objective">{game.winningType === 'CUSTOM' ? `Figura: ${game.patternName}` : 'Objetivo: llenar el cartón'}</p>
        <div className="bingo-grid"><div className="bingo-head">{columns.map((column) => <strong key={column}>{column}</strong>)}</div>{Array.from({ length: 5 }, (_, row) => <div className="bingo-row" key={row}>{Array.from({ length: 5 }, (_, column) => card.cells.find((cell) => cell.row === row && cell.column === column)).map((cell, column) => { if (!cell) return <span key={column} />; const marked = cell.isFree || drawn.has(cell.number ?? -1) || (marks[card.id] ?? []).includes(cell.id); const target = game.winningType !== 'CUSTOM' || required.has(`${cell.row}:${cell.column}`); return <button type="button" key={cell.id} className={`${marked ? 'marked' : ''} ${target ? 'target' : ''}`} onClick={() => toggleMark(card.id, cell.id)}>{cell.isFree ? '★' : cell.number}</button> })}</div>)}</div>
        <div className="player-history"><strong>Balotas</strong><div>{game.drawnBalls.map((ball) => <span key={ball.id}>{ball.number}</span>)}</div></div>
        <small className="manual-note">La marcación es una ayuda visual. FECSUPOL valida el ganador automáticamente.</small>
      </article>
    })}</div>
  </main>
}

export default PlayerApp
