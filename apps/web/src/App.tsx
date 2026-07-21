import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { io } from 'socket.io-client'
import './App.css'
import PlayerApp from './PlayerApp'

type Cell = { row: number; column: number; number?: number | null; isFree?: boolean }
type Pattern = { id: string; name: string; cells: Cell[] }
type Player = { id: string; name: string; phone?: string; active: boolean }
type CardTemplate = { id: string; number: number; cells: Cell[]; card?: { id: string; user: Pick<Player, 'id' | 'name'> } | null }
type Game = { id: string; name: string; status: string; winningType: string; patternName?: string | null; winningCells: Cell[]; endedManually: boolean; _count: { cards: number; drawnBalls: number; winners: number } }
type Card = { id: string; serial: string; number: number; user: Player; cells: Cell[] }
type Winner = { id: string; type: string; detectedAt: string; card: { serial: string; number?: number | null; user: Player } }
type Ball = { id: string; number: number; drawOrder: number; drawnAt: string }
type GameState = Game & { drawnBalls: Ball[]; winners: Winner[] }

class HttpError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

const positions = Array.from({ length: 25 }, (_, index) => ({ row: Math.floor(index / 5), column: index % 5 }))

function PatternGrid({ cells, editable, onToggle }: { cells: Cell[]; editable?: boolean; onToggle?: (cell: Cell) => void }) {
  const keys = new Set(cells.map((cell) => `${cell.row}:${cell.column}`))
  return <div className="pattern-grid">{positions.map((cell) => { const key = `${cell.row}:${cell.column}`; return <button key={key} type="button" disabled={!editable} className={keys.has(key) ? 'selected' : ''} onClick={() => onToggle?.(cell)} aria-label={`Fila ${cell.row + 1}, columna ${cell.column + 1}`} /> })}</div>
}

function AdminApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem('fecs-admin-token') ?? '')
  const [tokenDraft, setTokenDraft] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [cardCatalog, setCardCatalog] = useState<CardTemplate[]>([])
  const [winners, setWinners] = useState<Winner[]>([])
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [activePlayers, setActivePlayers] = useState<Player[]>([])
  const [selectedGameId, setSelectedGameId] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerPhone, setPlayerPhone] = useState('+57')
  const [patternName, setPatternName] = useState('')
  const [selectedCells, setSelectedCells] = useState<Cell[]>([])
  const [gameName, setGameName] = useState('')
  const [winMode, setWinMode] = useState<'FULL_CARD' | 'FIGURE'>('FULL_CARD')
  const [patternId, setPatternId] = useState('')
  const [cardPlayerId, setCardPlayerId] = useState('')
  const [cardNumbers, setCardNumbers] = useState<number[]>([])
  const [message, setMessage] = useState('')
  const [loginMessage, setLoginMessage] = useState('')
  const [issuedToken, setIssuedToken] = useState('')
  const [drawing, setDrawing] = useState(false)
  const [rollingNumber, setRollingNumber] = useState<number | null>(null)
  const drawingRef = useRef(false)

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers } })
    const body = await response.json()
    if (!response.ok) throw new HttpError(body.message ?? 'Error inesperado', response.status)
    return body
  }, [token])

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const [nextPlayers, nextPatterns, nextGames, nextCards, nextCatalog] = await Promise.all([
        request('/api/admin/users'), request('/api/admin/patterns'), request('/api/admin/games'), request('/api/admin/cards'), request('/api/admin/cards/catalog'),
      ]) as [Player[], Pattern[], Game[], Card[], CardTemplate[]]
      setPlayers(nextPlayers); setPatterns(nextPatterns); setGames(nextGames); setCards(nextCards); setCardCatalog(nextCatalog)
      setMessage('')
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'No fue posible cargar el panel'
      if (error instanceof HttpError && error.status === 401) {
        sessionStorage.removeItem('fecs-admin-token')
        setLoginMessage(nextMessage)
        setToken('')
        return
      }
      setMessage(nextMessage)
    }
  }, [request, token])

  const loadGameState = useCallback(async (gameId: string) => {
    if (!gameId) return
    const state = await request(`/api/admin/games/${gameId}/state`) as GameState
    setGameState(state)
    setWinners(state.winners)
  }, [request])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { void loadGameState(selectedGameId) }, [loadGameState, selectedGameId])
  useEffect(() => {
    if (!token) return
    const socket = io('/draws', { auth: { token } })
    const sync = () => { void refresh(); if (selectedGameId && !drawingRef.current) void loadGameState(selectedGameId) }
    socket.on('ball:drawn', sync)
    socket.on('winner:detected', sync)
    socket.on('game:updated', sync)
    socket.on('players:active', (players: Player[]) => setActivePlayers(players))
    void request('/api/admin/games/presence/current').then((players: Player[]) => setActivePlayers(players))
    return () => { socket.disconnect() }
  }, [loadGameState, refresh, request, selectedGameId, token])

  const submit = async (action: () => Promise<void>) => { try { setMessage(''); await action(); await refresh() } catch (error) { setMessage(error instanceof Error ? error.message : 'Operación fallida') } }
  const toggleCell = (cell: Cell) => setSelectedCells((current) => current.some((item) => item.row === cell.row && item.column === cell.column) ? current.filter((item) => item.row !== cell.row || item.column !== cell.column) : [...current, cell])

  if (!token) return <main className="login"><form className="panel" onSubmit={(event) => { event.preventDefault(); setLoginMessage(''); sessionStorage.setItem('fecs-admin-token', tokenDraft); setToken(tokenDraft) }}><p className="organization">FECSUPOL</p><h1>Bingo Virtual</h1>{loginMessage && <p className="message" role="status">{loginMessage}</p>}<label>Token administrativo<input required type="password" value={tokenDraft} onChange={(event) => setTokenDraft(event.target.value)} /></label><button className="primary">Ingresar</button></form></main>

  const selectedGame = games.find((game) => game.id === selectedGameId)
  const assignedNumbers = new Set(cards.map((card) => card.number))
  const drawBall = async () => {
    if (!selectedGame || drawingRef.current) return
    drawingRef.current = true
    setDrawing(true)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reducedMotion ? 600 : 4000
    const interval = window.setInterval(() => setRollingNumber(Math.floor(Math.random() * 75) + 1), reducedMotion ? 180 : 65)
    try {
      await submit(async () => {
        const [result] = await Promise.all([
          request(`/api/admin/games/${selectedGame.id}/draw`, { method: 'POST' }) as Promise<{ ball: Ball }>,
          new Promise((resolve) => window.setTimeout(resolve, duration)),
        ])
        window.clearInterval(interval)
        setRollingNumber(result.ball.number)
        await loadGameState(selectedGame.id)
      })
    } finally {
      window.clearInterval(interval)
      drawingRef.current = false
      setDrawing(false)
      setRollingNumber(null)
    }
  }
  const finishGame = async () => {
    if (!selectedGame || drawingRef.current) return
    const confirmed = window.confirm(`¿Terminar anticipadamente el sorteo "${selectedGame.name}"? Después no se podrán extraer más balotas.`)
    if (!confirmed) return
    await submit(async () => {
      await request(`/api/admin/games/${selectedGame.id}/finish`, { method: 'POST' })
      await loadGameState(selectedGame.id)
    })
  }

  return <main className="admin">
    <header><div><p className="organization">FECSUPOL</p><h1>Administración del Bingo Virtual</h1></div><button className="secondary" onClick={() => { sessionStorage.removeItem('fecs-admin-token'); setToken('') }}>Cerrar sesión</button></header>
    {message && <p className="message" role="status">{message}</p>}
    {issuedToken && <aside className="token-notice"><strong>Token del jugador (guárdalo ahora):</strong><code>{issuedToken}</code><button onClick={() => setIssuedToken('')}>Ocultar</button></aside>}
    <div className="panels">
      <form className="panel" onSubmit={(event: FormEvent) => { event.preventDefault(); void submit(async () => { const player = await request('/api/admin/users', { method: 'POST', body: JSON.stringify({ name: playerName, phone: playerPhone }) }) as Player & { accessToken: string }; setIssuedToken(player.accessToken); setPlayerName(''); setPlayerPhone('+57') }) }}><h2>Jugadores</h2><label>Nombre<input required minLength={2} value={playerName} onChange={(event) => setPlayerName(event.target.value)} /></label><label>WhatsApp<input required inputMode="tel" pattern="\+[1-9][0-9]{7,14}" value={playerPhone} onChange={(event) => setPlayerPhone(event.target.value)} /></label><button className="primary">Crear jugador</button><ul className="compact-list">{players.map((player) => <li key={player.id}>{player.name} <small>{player.phone}</small></li>)}</ul></form>

      <form className="panel" onSubmit={(event) => { event.preventDefault(); void submit(async () => { await request('/api/admin/patterns', { method: 'POST', body: JSON.stringify({ name: patternName, cells: selectedCells }) }); setPatternName(''); setSelectedCells([]) }) }}><h2>Programar figura</h2><label>Nombre<input required minLength={2} value={patternName} onChange={(event) => setPatternName(event.target.value)} /></label><PatternGrid cells={selectedCells} editable onToggle={toggleCell} /><button className="primary" disabled={!selectedCells.length}>Guardar figura</button></form>

      <form className="panel" onSubmit={(event) => { event.preventDefault(); void submit(async () => { await request('/api/admin/games', { method: 'POST', body: JSON.stringify({ name: gameName, winMode, ...(winMode === 'FIGURE' ? { patternId } : {}) }) }); setGameName('') }) }}><h2>Crear sorteo</h2><label>Nombre<input required minLength={2} value={gameName} onChange={(event) => setGameName(event.target.value)} /></label><label>Forma de ganar<select value={winMode} onChange={(event) => setWinMode(event.target.value as 'FULL_CARD' | 'FIGURE')}><option value="FULL_CARD">Cartón completo</option><option value="FIGURE">Figura</option></select></label>{winMode === 'FIGURE' && <label>Figura<select required value={patternId} onChange={(event) => setPatternId(event.target.value)}><option value="">Selecciona</option>{patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}</select></label>}<button className="primary">Crear sorteo</button></form>

      <form className="panel card-assignment" onSubmit={(event) => { event.preventDefault(); void submit(async () => { await request('/api/admin/cards/generate', { method: 'POST', body: JSON.stringify({ userId: cardPlayerId, cardNumbers }) }); setCardNumbers([]) }) }}><h2>Asignar cartones fijos</h2><p>La asignación será permanente y aplicará a todos los sorteos.</p>{!cardCatalog.length && <button type="button" className="secondary" onClick={() => void submit(async () => { await request('/api/admin/cards/catalog/initialize', { method: 'POST' }) })}>Generar catálogo 1–120</button>}<label>Jugador<select required value={cardPlayerId} onChange={(event) => setCardPlayerId(event.target.value)}><option value="">Selecciona</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><div className="number-picker">{cardCatalog.map((template) => { const unavailable = assignedNumbers.has(template.number); const selected = cardNumbers.includes(template.number); return <button type="button" key={template.id} disabled={unavailable} title={unavailable ? `Asignado a ${template.card?.user.name ?? 'otro jugador'}` : `Cartón ${template.number}`} className={selected ? 'selected' : ''} onClick={() => setCardNumbers((current) => current.includes(template.number) ? current.filter((number) => number !== template.number) : [...current, template.number])}>{template.number}</button> })}</div><button className="primary" disabled={!cardNumbers.length}>Asignar permanentemente {cardNumbers.length || ''} cartón(es) y enviar WhatsApp</button></form>
    </div>

    <section className="wide-panel"><h2>Sorteos</h2><div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Modalidad</th><th>Estado</th><th>Cartones</th><th>Balotas</th><th>Ganadores</th><th>Acciones</th></tr></thead><tbody>{games.map((game) => <tr key={game.id}><td>{game.name}</td><td>{game.winningType === 'CUSTOM' ? game.patternName : 'Cartón completo'}</td><td>{game.status}</td><td>{game._count.cards}</td><td>{game._count.drawnBalls}</td><td>{game._count.winners}</td><td><button onClick={() => { setSelectedGameId(game.id); void request(`/api/admin/games/${game.id}/winners`).then((data: Winner[]) => setWinners(data)) }}>Ver</button>{game.status === 'DRAFT' && <button onClick={() => void submit(async () => { await request(`/api/admin/games/${game.id}/start`, { method: 'POST' }) })}>Iniciar</button>}</td></tr>)}</tbody></table></div></section>

    {selectedGame && <section className="wide-panel draw-panel"><div className="draw-heading"><div><h2>Panel de sorteo: {selectedGame.name}</h2><p>{selectedGame.winningType === 'CUSTOM' ? `Figura: ${selectedGame.patternName}` : 'Objetivo: llenar el cartón'}</p>{selectedGame.endedManually && <p>Este sorteo terminó anticipadamente.</p>}</div>{selectedGame.status === 'ACTIVE' && <div className="draw-actions"><button className="draw-button" disabled={drawing} onClick={() => void drawBall()}>{drawing ? 'Balotera girando…' : 'Girar balotera'}</button><button className="danger" disabled={drawing} onClick={() => void finishGame()}>Terminar sorteo</button></div>}</div><div className="draw-layout"><div className={`last-ball ${drawing ? 'spinning' : ''}`}><span>{drawing ? 'Girando' : 'Última balota'}</span><strong>{drawing ? rollingNumber ?? '—' : gameState?.drawnBalls.at(-1)?.number ?? '—'}</strong><small>{gameState?.drawnBalls.length ?? 0} de 75</small></div><div><h3>Historial</h3><div className="ball-history">{gameState?.drawnBalls.map((ball) => <span key={ball.id}>{ball.number}</span>)}</div></div><div><h3>Figura objetivo</h3>{selectedGame.winningType === 'CUSTOM' ? <PatternGrid cells={selectedGame.winningCells} /> : <p>Cartón completo</p>}</div><div><h3>Jugadores activos ({activePlayers.length})</h3>{activePlayers.length ? <ul>{activePlayers.map((player) => <li key={player.id}>{player.name}</li>)}</ul> : <p>No hay jugadores conectados.</p>}</div><div><h3>Ganadores</h3>{winners.length ? <ul>{winners.map((winner) => <li key={winner.id}>{winner.card.user.name} — cartón #{winner.card.number ?? '—'}</li>)}</ul> : <p>Aún no hay ganadores.</p>}</div></div></section>}

    <section className="wide-panel"><h2>Cartones asignados permanentemente ({cards.length})</h2><div className="card-list">{cards.map((card) => <article key={card.id}><strong>Cartón #{card.number} · {card.user.name}</strong><span>Válido para todos los sorteos</span><small>{card.serial}</small></article>)}</div></section>
  </main>
}

function App() {
  return window.location.pathname.startsWith('/player') ? <PlayerApp /> : <AdminApp />
}

export default App
