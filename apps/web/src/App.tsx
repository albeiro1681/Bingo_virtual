import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { io } from 'socket.io-client'
import './App.css'
import PlayerApp from './PlayerApp'
import { bingoBallLabel } from './bingo-ball'

type Cell = { row: number; column: number; number?: number | null; isFree?: boolean }
type Pattern = { id: string; name: string; cells: Cell[] }
type Player = { id: string; name: string; phone?: string; active: boolean; cards?: Array<{ id: string; number: number; serial: string }>; whatsappDeliveries?: Array<{ status: string; updatedAt: string; error?: string | null }> }
type CardTemplate = { id: string; number: number; cells: Cell[]; card?: { id: string; user: Pick<Player, 'id' | 'name'> } | null }
type Game = { id: string; name: string; status: string; winningType: string; patternName?: string | null; winningCells: Cell[]; endedManually: boolean; _count: { cards: number; drawnBalls: number; winners: number } }
type Card = { id: string; serial: string; number: number; user: Player; cells: Cell[] }
type Winner = { id: string; type: string; detectedAt: string; card: { serial: string; number?: number | null; user: Player } }
type Ball = { id: string; number: number; drawOrder: number; drawnAt: string }
type GameState = Game & { drawnBalls: Ball[]; winners: Winner[] }
type WhatsAppSettings = { accessTokenConfigured: boolean; phoneNumberId: string; businessAccountId: string; graphApiVersion: string; templateLanguage: string; playerAccessTemplate: string; cardAssignmentTemplate: string; winnerPlayerTemplate: string; winnerFundTemplate: string; fundContacts: string; publicAppUrl: string }

class HttpError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

const positions = Array.from({ length: 25 }, (_, index) => ({ row: Math.floor(index / 5), column: index % 5 }))

function PatternGrid({ cells, editable, onToggle }: { cells: Cell[]; editable?: boolean; onToggle?: (cell: Cell) => void }) {
  const keys = new Set(cells.map((cell) => `${cell.row}:${cell.column}`))
  return <div className="pattern-grid">{positions.map((cell) => { const key = `${cell.row}:${cell.column}`; const isFreeCenter = cell.row === 2 && cell.column === 2; return <button key={key} type="button" disabled={!editable || isFreeCenter} className={`${keys.has(key) ? 'selected' : ''} ${isFreeCenter ? 'free-center' : ''}`} onClick={() => { if (!isFreeCenter) onToggle?.(cell) }} aria-label={isFreeCenter ? 'Casilla libre central' : `Fila ${cell.row + 1}, columna ${cell.column + 1}`}>{isFreeCenter ? '★' : ''}</button> })}</div>
}

function AdminApp() {
  const isDrawView = window.location.pathname.startsWith('/draw')
  const [token, setToken] = useState(() => sessionStorage.getItem('fecs-admin-token') ?? '')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [cardCatalog, setCardCatalog] = useState<CardTemplate[]>([])
  const [winners, setWinners] = useState<Winner[]>([])
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [activePlayers, setActivePlayers] = useState<Player[]>([])
  const [selectedGameId, setSelectedGameId] = useState(() => new URLSearchParams(window.location.search).get('game') ?? '')
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
  const [issuedLink, setIssuedLink] = useState('')
  const [editingPlayerId, setEditingPlayerId] = useState('')
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [whatsappSettings, setWhatsappSettings] = useState<WhatsAppSettings | null>(null)
  const [whatsappToken, setWhatsappToken] = useState('')
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
      const [nextPlayers, nextPatterns, nextGames, nextCards, nextCatalog, nextWhatsapp] = await Promise.all([
        request('/api/admin/users'), request('/api/admin/patterns'), request('/api/admin/games'), request('/api/admin/cards'), request('/api/admin/cards/catalog'), request('/api/admin/whatsapp/settings'),
      ]) as [Player[], Pattern[], Game[], Card[], CardTemplate[], WhatsAppSettings]
      setPlayers(nextPlayers); setPatterns(nextPatterns); setGames(nextGames); setCards(nextCards); setCardCatalog(nextCatalog)
      setWhatsappSettings(nextWhatsapp)
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

  if (!token) return <main className="login"><form className="panel" onSubmit={(event) => { event.preventDefault(); setLoginMessage(''); void fetch('/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUsername, password: loginPassword }) }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.message ?? 'No fue posible iniciar sesión'); sessionStorage.setItem('fecs-admin-token', body.token); setLoginPassword(''); setToken(body.token) }).catch((error: unknown) => setLoginMessage(error instanceof Error ? error.message : 'No fue posible iniciar sesión')) }}><p className="organization">FECSUPOL</p><h1>Bingo Virtual</h1>{loginMessage && <p className="message" role="status">{loginMessage}</p>}<label>Usuario<input required autoComplete="username" minLength={3} value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} /></label><label>Contraseña<input required type="password" autoComplete="current-password" minLength={10} value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} /></label><button className="primary">Ingresar</button></form></main>

  const selectedGame = games.find((game) => game.id === selectedGameId)
  const editingPlayer = players.find((player) => player.id === editingPlayerId)
  const assignedNumbers = new Set(cards.map((card) => card.number))
  const beginEditPlayer = (player: Player) => { setEditingPlayerId(player.id); setEditName(player.name); setEditPhone(player.phone ?? '+57'); setEditActive(player.active); setCardPlayerId(player.id); setCardNumbers(player.cards?.map((card) => card.number) ?? []) }
  const drawBall = async () => {
    if (!selectedGame || drawingRef.current) return
    drawingRef.current = true
    setDrawing(true)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reducedMotion ? 600 : 4000
    const drawnNumbers = new Set(gameState?.drawnBalls.map((ball) => ball.number) ?? [])
    const availableNumbers = Array.from({ length: 75 }, (_, index) => index + 1).filter((number) => !drawnNumbers.has(number))
    const interval = window.setInterval(() => setRollingNumber(availableNumbers[Math.floor(Math.random() * availableNumbers.length)] ?? null), reducedMotion ? 180 : 65)
    try {
      await submit(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, duration))
        const result = await request(`/api/admin/games/${selectedGame.id}/draw`, { method: 'POST' }) as { ball: Ball }
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

  return <main className={`admin ${isDrawView ? 'draw-view' : ''}`}>
    <header><div><p className="organization">FECSUPOL</p><h1>{isDrawView ? 'Panel de sorteo' : 'Administración del Bingo Virtual'}</h1><nav className="section-nav"><a className={!isDrawView ? 'active' : ''} href="/">Administración</a><a className={isDrawView ? 'active' : ''} href="/draw">Panel de sorteo</a></nav></div><button className="secondary" onClick={() => { void request('/api/admin/auth/logout', { method: 'POST' }).finally(() => { sessionStorage.removeItem('fecs-admin-token'); setToken('') }) }}>Cerrar sesión</button></header>
    {message && <p className="message" role="status">{message}</p>}
    {issuedLink && <aside className="token-notice admin-only"><strong>Enlace de acceso del jugador:</strong><a href={issuedLink} target="_blank" rel="noreferrer">{issuedLink}</a><button type="button" onClick={() => void navigator.clipboard.writeText(issuedLink)}>Copiar enlace</button><button type="button" onClick={() => setIssuedLink('')}>Ocultar</button></aside>}
    <div className="panels admin-only">
      <section className="panel"><h2>Jugadores</h2><form onSubmit={(event: FormEvent) => { event.preventDefault(); void submit(async () => { const player = await request('/api/admin/users', { method: 'POST', body: JSON.stringify({ name: playerName, phone: playerPhone }) }) as Player & { accessLink: string }; setIssuedLink(player.accessLink); setPlayerName(''); setPlayerPhone('+57') }) }}><label>Nombre<input required minLength={2} value={playerName} onChange={(event) => setPlayerName(event.target.value)} /></label><label>WhatsApp<input required inputMode="tel" pattern="\+[1-9][0-9]{7,14}" value={playerPhone} onChange={(event) => setPlayerPhone(event.target.value)} /></label><button className="primary">Crear jugador</button></form><ul className="compact-list player-management">{players.map((player) => <li key={player.id}><span>{player.name} <small>{player.phone} · {player.cards?.length ?? 0} cartón(es)</small></span><button type="button" onClick={() => beginEditPlayer(player)}>Gestionar</button></li>)}</ul></section>

      {editingPlayer && <form className="panel" onSubmit={(event) => { event.preventDefault(); void submit(async () => { await request(`/api/admin/users/${editingPlayer.id}`, { method: 'PATCH', body: JSON.stringify({ name: editName, phone: editPhone, active: editActive }) }); await request(`/api/admin/cards/player/${editingPlayer.id}`, { method: 'PUT', body: JSON.stringify({ cardNumbers }) }) }) }}><h2>Editar jugador</h2><label>Nombre<input required minLength={2} value={editName} onChange={(event) => setEditName(event.target.value)} /></label><label>WhatsApp<input required pattern="\+[1-9][0-9]{7,14}" value={editPhone} onChange={(event) => setEditPhone(event.target.value)} /></label><label className="checkbox-label"><input type="checkbox" checked={editActive} onChange={(event) => setEditActive(event.target.checked)} /> Jugador activo</label><p>Cartones: {cardNumbers.length ? cardNumbers.sort((a, b) => a - b).join(', ') : 'ninguno'}</p><div className="number-picker">{cardCatalog.map((template) => { const owned = template.card?.user.id === editingPlayer.id; const unavailable = Boolean(template.card) && !owned; const selected = cardNumbers.includes(template.number); return <button type="button" key={template.id} className={selected ? 'selected' : ''} title={unavailable ? `Asignado a ${template.card?.user.name}` : `Cartón ${template.number}`} onClick={() => { if (unavailable && !window.confirm(`¿Reasignar el cartón ${template.number} de ${template.card?.user.name} a ${editingPlayer.name}?`)) return; setCardNumbers((current) => current.includes(template.number) ? current.filter((number) => number !== template.number) : [...current, template.number]) }}>{template.number}</button> })}</div><button className="primary">Guardar usuario y cartones</button><div className="inline-actions"><button type="button" onClick={() => void submit(async () => { const result = await request(`/api/admin/users/${editingPlayer.id}/access-link`) as { accessLink: string }; setIssuedLink(result.accessLink) })}>Ver enlace</button><button type="button" onClick={() => void submit(async () => { const result = await request(`/api/admin/users/${editingPlayer.id}/access-link/send`, { method: 'POST' }) as { accessLink: string }; setIssuedLink(result.accessLink) })}>Enviar enlace</button><button type="button" className="danger" onClick={() => { if (window.confirm('¿Regenerar el enlace? El anterior dejará de funcionar.')) void submit(async () => { const result = await request(`/api/admin/users/${editingPlayer.id}/access-link/regenerate`, { method: 'POST' }) as { accessLink: string }; setIssuedLink(result.accessLink) }) }}>Regenerar</button><button type="button" onClick={() => setEditingPlayerId('')}>Cerrar</button></div>{editingPlayer.whatsappDeliveries?.[0] && <small>Último envío: {editingPlayer.whatsappDeliveries[0].status}{editingPlayer.whatsappDeliveries[0].error ? ` · ${editingPlayer.whatsappDeliveries[0].error}` : ''}</small>}</form>}

      {whatsappSettings && <form className="panel" onSubmit={(event) => { event.preventDefault(); void submit(async () => { await request('/api/admin/whatsapp/settings', { method: 'PUT', body: JSON.stringify({ ...whatsappSettings, accessTokenConfigured: undefined, ...(whatsappToken ? { accessToken: whatsappToken } : {}) }) }); setWhatsappToken('') }) }}><h2>WhatsApp Cloud API</h2><label>Token de acceso<input type="password" placeholder={whatsappSettings.accessTokenConfigured ? 'Configurado; dejar vacío para conservar' : 'Token permanente de Meta'} value={whatsappToken} onChange={(event) => setWhatsappToken(event.target.value)} /></label><label>Phone Number ID<input required value={whatsappSettings.phoneNumberId ?? ''} onChange={(event) => setWhatsappSettings({ ...whatsappSettings, phoneNumberId: event.target.value })} /></label><label>WABA ID<input value={whatsappSettings.businessAccountId ?? ''} onChange={(event) => setWhatsappSettings({ ...whatsappSettings, businessAccountId: event.target.value })} /></label><label>URL pública<input required type="url" value={whatsappSettings.publicAppUrl ?? ''} onChange={(event) => setWhatsappSettings({ ...whatsappSettings, publicAppUrl: event.target.value })} /></label><label>Contactos FECSUPOL (E.164, separados por coma)<input value={whatsappSettings.fundContacts ?? ''} onChange={(event) => setWhatsappSettings({ ...whatsappSettings, fundContacts: event.target.value })} /></label><details><summary>Plantillas y versión</summary><label>Versión Graph API<input value={whatsappSettings.graphApiVersion} onChange={(event) => setWhatsappSettings({ ...whatsappSettings, graphApiVersion: event.target.value })} /></label><label>Idioma<input value={whatsappSettings.templateLanguage} onChange={(event) => setWhatsappSettings({ ...whatsappSettings, templateLanguage: event.target.value })} /></label><label>Plantilla de acceso<input value={whatsappSettings.playerAccessTemplate} onChange={(event) => setWhatsappSettings({ ...whatsappSettings, playerAccessTemplate: event.target.value })} /></label><label>Plantilla de asignación<input value={whatsappSettings.cardAssignmentTemplate} onChange={(event) => setWhatsappSettings({ ...whatsappSettings, cardAssignmentTemplate: event.target.value })} /></label><label>Plantilla de ganador<input value={whatsappSettings.winnerPlayerTemplate} onChange={(event) => setWhatsappSettings({ ...whatsappSettings, winnerPlayerTemplate: event.target.value })} /></label><label>Plantilla FECSUPOL<input value={whatsappSettings.winnerFundTemplate} onChange={(event) => setWhatsappSettings({ ...whatsappSettings, winnerFundTemplate: event.target.value })} /></label></details><button className="primary">Guardar configuración</button><button type="button" onClick={() => void submit(async () => { const result = await request('/api/admin/whatsapp/test') as { verifiedName?: string }; setMessage(`Conexión correcta${result.verifiedName ? `: ${result.verifiedName}` : ''}`) })}>Probar conexión</button></form>}

      <form className="panel" onSubmit={(event) => { event.preventDefault(); void submit(async () => { await request('/api/admin/patterns', { method: 'POST', body: JSON.stringify({ name: patternName, cells: selectedCells }) }); setPatternName(''); setSelectedCells([]) }) }}><h2>Programar figura</h2><label>Nombre<input required minLength={2} value={patternName} onChange={(event) => setPatternName(event.target.value)} /></label><PatternGrid cells={selectedCells} editable onToggle={toggleCell} /><button className="primary" disabled={!selectedCells.length}>Guardar figura</button></form>

      <form className="panel" onSubmit={(event) => { event.preventDefault(); void submit(async () => { await request('/api/admin/games', { method: 'POST', body: JSON.stringify({ name: gameName, winMode, ...(winMode === 'FIGURE' ? { patternId } : {}) }) }); setGameName('') }) }}><h2>Crear sorteo</h2><label>Nombre<input required minLength={2} value={gameName} onChange={(event) => setGameName(event.target.value)} /></label><label>Forma de ganar<select value={winMode} onChange={(event) => setWinMode(event.target.value as 'FULL_CARD' | 'FIGURE')}><option value="FULL_CARD">Cartón completo</option><option value="FIGURE">Figura</option></select></label>{winMode === 'FIGURE' && <label>Figura<select required value={patternId} onChange={(event) => setPatternId(event.target.value)}><option value="">Selecciona</option>{patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}</select></label>}<button className="primary">Crear sorteo</button></form>

      <form className="panel card-assignment" onSubmit={(event) => { event.preventDefault(); void submit(async () => { await request('/api/admin/cards/generate', { method: 'POST', body: JSON.stringify({ userId: cardPlayerId, cardNumbers }) }); setCardNumbers([]) }) }}><h2>Asignar cartones fijos</h2><p>La asignación será permanente y aplicará a todos los sorteos.</p>{!cardCatalog.length && <button type="button" className="secondary" onClick={() => void submit(async () => { await request('/api/admin/cards/catalog/initialize', { method: 'POST' }) })}>Generar catálogo 1–130</button>}<label>Jugador<select required value={cardPlayerId} onChange={(event) => setCardPlayerId(event.target.value)}><option value="">Selecciona</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><div className="number-picker">{cardCatalog.map((template) => { const unavailable = assignedNumbers.has(template.number); const selected = cardNumbers.includes(template.number); return <button type="button" key={template.id} disabled={unavailable} title={unavailable ? `Asignado a ${template.card?.user.name ?? 'otro jugador'}` : `Cartón ${template.number}`} className={selected ? 'selected' : ''} onClick={() => setCardNumbers((current) => current.includes(template.number) ? current.filter((number) => number !== template.number) : [...current, template.number])}>{template.number}</button> })}</div><button className="primary" disabled={!cardNumbers.length}>Asignar permanentemente {cardNumbers.length || ''} cartón(es) y enviar WhatsApp</button></form>
    </div>

    <section className="wide-panel admin-only"><h2>Sorteos</h2><div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Modalidad</th><th>Estado</th><th>Cartones</th><th>Balotas</th><th>Ganadores</th><th>Acciones</th></tr></thead><tbody>{games.map((game) => <tr key={game.id}><td>{game.name}</td><td>{game.winningType === 'CUSTOM' ? game.patternName : 'Cartón completo'}</td><td>{game.status}</td><td>{game._count.cards}</td><td>{game._count.drawnBalls}</td><td>{game._count.winners}</td><td><a className="table-action" href={`/draw?game=${game.id}`}>Abrir panel</a>{game.status === 'DRAFT' && <button onClick={() => void submit(async () => { await request(`/api/admin/games/${game.id}/start`, { method: 'POST' }) })}>Iniciar</button>}</td></tr>)}</tbody></table></div></section>

    {isDrawView && <section className="wide-panel draw-selector"><h2>Seleccionar sorteo</h2><select aria-label="Sorteo" value={selectedGameId} onChange={(event) => setSelectedGameId(event.target.value)}><option value="">Selecciona un sorteo</option>{games.map((game) => <option key={game.id} value={game.id}>{game.name} · {game.status}</option>)}</select></section>}

    {isDrawView && selectedGame && <section className="wide-panel draw-panel"><div className="draw-heading"><div><h2>Panel de sorteo: {selectedGame.name}</h2><p>{selectedGame.winningType === 'CUSTOM' ? `Figura: ${selectedGame.patternName}` : 'Objetivo: llenar el cartón'}</p>{selectedGame.endedManually && <p>Este sorteo terminó anticipadamente.</p>}</div>{selectedGame.status === 'ACTIVE' && <div className="draw-actions"><button className="draw-button" disabled={drawing} onClick={() => void drawBall()}>{drawing ? 'Balotera girando…' : 'Girar balotera'}</button><button className="danger" disabled={drawing} onClick={() => void finishGame()}>Terminar sorteo</button></div>}</div><div className="draw-layout"><div className={`last-ball ${drawing ? 'spinning' : ''}`}><span>{drawing ? 'Girando' : 'Última balota'}</span><strong>{drawing ? rollingNumber ? bingoBallLabel(rollingNumber) : '—' : gameState?.drawnBalls.at(-1) ? bingoBallLabel(gameState.drawnBalls.at(-1)!.number) : '—'}</strong><small>{gameState?.drawnBalls.length ?? 0} de 75</small></div>{winners.length > 0 && <div className="draw-winner-banner" role="alert" aria-live="assertive"><div className="fireworks" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div><span>¡GANADOR{winners.length > 1 ? 'ES' : ''}!</span><strong>{[...new Set(winners.map((winner) => winner.card.user.name))].join(' · ')}</strong></div>}<div className="draw-history"><h3>Historial</h3><div className="ball-history">{gameState?.drawnBalls.map((ball) => <span key={ball.id}>{ball.number}</span>)}</div></div><div><h3>Figura objetivo</h3>{selectedGame.winningType === 'CUSTOM' ? <PatternGrid cells={selectedGame.winningCells} /> : <p>Cartón completo</p>}</div><div className="active-players"><h3>Jugadores activos ({activePlayers.length})</h3><div className="active-players-list">{activePlayers.length ? <ul>{activePlayers.map((player) => <li key={player.id}>{player.name}</li>)}</ul> : <p>No hay jugadores conectados.</p>}</div></div><div><h3>Ganadores</h3>{winners.length ? <ul>{winners.map((winner) => <li key={winner.id}>{winner.card.user.name} — cartón #{winner.card.number ?? '—'}</li>)}</ul> : <p>Aún no hay ganadores.</p>}</div></div></section>}

    <section className="wide-panel admin-only"><h2>Cartones asignados permanentemente ({cards.length})</h2><div className="card-list">{cards.map((card) => <article key={card.id}><strong>Cartón #{card.number} · {card.user.name}</strong><span>Válido para todos los sorteos</span><small>{card.serial}</small></article>)}</div></section>
  </main>
}

function App() {
  return window.location.pathname.startsWith('/player') ? <PlayerApp /> : <AdminApp />
}

export default App
