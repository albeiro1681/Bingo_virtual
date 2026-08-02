import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";
import PlayerApp from "./PlayerApp";
import { bingoBallLabel } from "./bingo-ball";
import { UsersPage } from "./features/users/UsersPage";
import { WinnersPage } from "./features/winners/WinnersPage";
import { PrizeAmountInput } from "./features/games/PrizeAmountInput";
import { formatCop, validatePrizeAmount } from "./money";

type Cell = {
  row: number;
  column: number;
  number?: number | null;
  isFree?: boolean;
};
type Pattern = { id: string; name: string; cells: Cell[] };
type Player = {
  id: string;
  name: string;
  phone?: string;
  active: boolean;
  cards?: Array<{ id: string; number: number; serial: string }>;
  whatsappDeliveries?: Array<{
    id: string;
    status: string;
    updatedAt: string;
    error?: string | null;
  }>;
};
type TieBreakCard = {
  id: string;
  number: number;
  userId: string;
  user?: Pick<Player, "id" | "name">;
};
type Game = {
  id: string;
  name: string;
  status: string;
  winningType: string;
  patternName?: string | null;
  winningCells: Cell[];
  endedManually: boolean;
  prizeAmount?: string | null;
  currencyCode: string;
  startedAt?: string | null;
  finalWinnerId?: string | null;
  finalWinner?: TieBreakCard | null;
  tieBreakCandidates: Array<{ id: string; card: TieBreakCard }>;
  _count: { cards: number; drawnBalls: number; winners: number };
};
type Winner = {
  id: string;
  type: string;
  detectedAt: string;
  card: { id: string; serial: string; number?: number | null; user: Player };
};
type Ball = { id: string; number: number; drawOrder: number; drawnAt: string };
type GameState = Game & { drawnBalls: Ball[]; winners: Winner[] };
type WhatsAppSettings = {
  accessTokenConfigured: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  graphApiVersion: string;
  templateLanguage: string;
  playerAccessTemplate: string;
  cardAssignmentTemplate: string;
  winnerPlayerTemplate: string;
  winnerFundTemplate: string;
  fundContacts: string;
  publicAppUrl: string;
};

class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const positions = Array.from({ length: 25 }, (_, index) => ({
  row: Math.floor(index / 5),
  column: index % 5,
}));
const bingoHistoryColumns = [
  { letter: "B", min: 1, max: 15 },
  { letter: "I", min: 16, max: 30 },
  { letter: "N", min: 31, max: 45 },
  { letter: "G", min: 46, max: 60 },
  { letter: "O", min: 61, max: 75 },
];

function gameStatusLabel(status: string) {
  return (
    (
      {
        DRAFT: "Borrador",
        ACTIVE: "Activo",
        TIE_BREAK: "Desempate",
        FINISHED: "Finalizado",
        CANCELLED: "Cancelado",
      } as Record<string, string>
    )[status] ?? status
  );
}

function storedAnnouncedWinnerGames(): string[] {
  try {
    const stored = JSON.parse(
      sessionStorage.getItem("fecs-announced-winner-games") ?? "[]",
    ) as unknown;
    return Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function PatternGrid({
  cells,
  editable,
  onToggle,
}: {
  cells: Cell[];
  editable?: boolean;
  onToggle?: (cell: Cell) => void;
}) {
  const keys = new Set(cells.map((cell) => `${cell.row}:${cell.column}`));
  return (
    <div className="pattern-grid">
      {positions.map((cell) => {
        const key = `${cell.row}:${cell.column}`;
        const isFreeCenter = cell.row === 2 && cell.column === 2;
        return (
          <button
            key={key}
            type="button"
            disabled={!editable || isFreeCenter}
            className={`${keys.has(key) ? "selected" : ""} ${isFreeCenter ? "free-center" : ""}`}
            onClick={() => {
              if (!isFreeCenter) onToggle?.(cell);
            }}
            aria-label={
              isFreeCenter
                ? "Casilla libre central"
                : `Fila ${cell.row + 1}, columna ${cell.column + 1}`
            }
          >
            {isFreeCenter ? "★" : ""}
          </button>
        );
      })}
    </div>
  );
}

function AdminApp() {
  const isDrawView = window.location.pathname.startsWith("/draw");
  const isUsersView = window.location.pathname.startsWith("/admin/users");
  const isWinnersView = window.location.pathname.startsWith("/admin/winners");
  const isWhatsAppView = window.location.pathname.startsWith("/admin/whatsapp");
  const isGamesView =
    !isDrawView && !isUsersView && !isWinnersView && !isWhatsAppView;
  const [token, setToken] = useState(
    () => sessionStorage.getItem("fecs-admin-token") ?? "",
  );
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);
  const [selectedGameId, setSelectedGameId] = useState(
    () => new URLSearchParams(window.location.search).get("game") ?? "",
  );
  const [patternName, setPatternName] = useState("");
  const [selectedCells, setSelectedCells] = useState<Cell[]>([]);
  const [gameName, setGameName] = useState("");
  const [gamePrizeAmount, setGamePrizeAmount] = useState("");
  const [gamePrizeError, setGamePrizeError] = useState("");
  const [winMode, setWinMode] = useState<"FULL_CARD" | "FIGURE">("FULL_CARD");
  const [patternId, setPatternId] = useState("");
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editGameName, setEditGameName] = useState("");
  const [editGamePrizeAmount, setEditGamePrizeAmount] = useState("");
  const [editGamePrizeError, setEditGamePrizeError] = useState("");
  const [message, setMessage] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [whatsappSettings, setWhatsappSettings] =
    useState<WhatsAppSettings | null>(null);
  const [whatsappToken, setWhatsappToken] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [rollingNumber, setRollingNumber] = useState<number | null>(null);
  const [tieBreaking, setTieBreaking] = useState(false);
  const [rollingCardNumber, setRollingCardNumber] = useState<number | null>(
    null,
  );
  const [visibleWinnerId, setVisibleWinnerId] = useState("");
  const announcedWinnerGameIdsRef = useRef(
    new Set<string>(storedAnnouncedWinnerGames()),
  );
  const winnerTimerRef = useRef<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const drawingRef = useRef(false);

  const openDrawPanel = useCallback(
    (gameId?: string) => {
      const destination = new URL("/draw", window.location.origin);
      if (gameId) destination.searchParams.set("game", gameId);

      const panelWindow = window.open("", "_blank");
      if (!panelWindow) {
        setMessage(
          "El navegador bloqueó la nueva pestaña. Permite ventanas emergentes para abrir el panel de sorteo.",
        );
        return;
      }

      try {
        panelWindow.sessionStorage.setItem("fecs-admin-token", token);
        panelWindow.opener = null;
        panelWindow.location.replace(destination.href);
      } catch {
        panelWindow.close();
        setMessage("No fue posible abrir el panel de sorteo de forma segura.");
      }
    },
    [token],
  );

  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...init?.headers,
        },
      });
      const responseText = await response.text();
      let body: unknown = {};
      try {
        body = responseText ? JSON.parse(responseText) : {};
      } catch {
        if (!response.ok)
          throw new HttpError(
            "El servidor devolvió una respuesta que no se pudo interpretar",
            response.status,
          );
      }
      if (!response.ok) {
        const errorBody = body as {
          message?: string | string[];
          incidentId?: string;
        };
        const detail = Array.isArray(errorBody.message)
          ? errorBody.message.join(". ")
          : (errorBody.message ?? "Error inesperado");
        throw new HttpError(
          errorBody.incidentId
            ? `${detail} (incidente ${errorBody.incidentId})`
            : detail,
          response.status,
        );
      }
      return body;
    },
    [token],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const results = await Promise.allSettled([
        request("/api/admin/patterns"),
        request("/api/admin/games"),
        request("/api/admin/whatsapp/settings"),
      ]);
      const unauthorized = results.find(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof HttpError &&
          result.reason.status === 401,
      );
      if (unauthorized && unauthorized.status === "rejected")
        throw unauthorized.reason;
      const setters = [
        (value: unknown) => setPatterns(value as Pattern[]),
        (value: unknown) => setGames(value as Game[]),
        (value: unknown) => setWhatsappSettings(value as WhatsAppSettings),
      ];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") setters[index](result.value);
      });
      const failures = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      setMessage(
        failures.length
          ? `No se pudieron actualizar ${failures.length} secciones. Puedes continuar con las demás.`
          : "",
      );
    } catch (error) {
      const nextMessage =
        error instanceof Error
          ? error.message
          : "No fue posible cargar el panel";
      if (error instanceof HttpError && error.status === 401) {
        sessionStorage.removeItem("fecs-admin-token");
        setLoginMessage(nextMessage);
        setToken("");
        return;
      }
      setMessage(nextMessage);
    }
  }, [request, token]);

  const loadGameState = useCallback(
    async (gameId: string) => {
      if (!gameId) return;
      const state = (await request(
        `/api/admin/games/${gameId}/state`,
      )) as GameState;
      setGameState(state);
      setWinners(state.winners);
    },
    [request],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!isDrawView || selectedGameId || !games.length) return;
    const game =
      games.find(
        (candidate) =>
          candidate.status === "ACTIVE" || candidate.status === "TIE_BREAK",
      ) ?? games[0];
    setSelectedGameId(game.id);
    window.history.replaceState(null, "", `/draw?game=${game.id}`);
  }, [games, isDrawView, selectedGameId]);
  useEffect(() => {
    void loadGameState(selectedGameId);
  }, [loadGameState, selectedGameId]);
  useEffect(() => {
    const confirmedWinnerId = gameState?.finalWinnerId;
    const confirmedWinner = confirmedWinnerId
      ? gameState?.winners.find(
          (winner) => winner.card.id === confirmedWinnerId,
        )
      : gameState?.status === "FINISHED" && gameState.winners.length === 1
        ? gameState.winners[0]
        : undefined;
    if (
      !confirmedWinner ||
      !gameState?.id ||
      announcedWinnerGameIdsRef.current.has(gameState.id)
    )
      return;
    announcedWinnerGameIdsRef.current.add(gameState.id);
    sessionStorage.setItem(
      "fecs-announced-winner-games",
      JSON.stringify([...announcedWinnerGameIdsRef.current]),
    );
    setVisibleWinnerId(confirmedWinner.id);
    if (winnerTimerRef.current) window.clearTimeout(winnerTimerRef.current);
    winnerTimerRef.current = window.setTimeout(
      () => setVisibleWinnerId(""),
      8000,
    );
  }, [gameState]);
  useEffect(
    () => () => {
      if (winnerTimerRef.current) window.clearTimeout(winnerTimerRef.current);
    },
    [],
  );
  useEffect(() => {
    if (!token) return;
    const socket = io("/draws", { auth: { token } });
    const sync = () => {
      void refresh();
      if (selectedGameId && !drawingRef.current)
        void loadGameState(selectedGameId);
    };
    socket.on("ball:drawn", sync);
    socket.on("winner:detected", sync);
    socket.on("tie-break:completed", sync);
    socket.on("game:updated", sync);
    socket.on("connect", () => setConnectionMessage(""));
    socket.on("connect_error", () =>
      setConnectionMessage(
        "Se perdió la conexión en tiempo real. Intentando reconectar…",
      ),
    );
    socket.on("disconnect", () =>
      setConnectionMessage(
        "Se perdió la conexión en tiempo real. Intentando reconectar…",
      ),
    );
    socket.on("players:active", (players: Player[]) =>
      setActivePlayers(players),
    );
    void request("/api/admin/games/presence/current").then((players) =>
      setActivePlayers(players as Player[]),
    );
    return () => {
      socket.disconnect();
    };
  }, [loadGameState, refresh, request, selectedGameId, token]);

  const submit = async (action: () => Promise<void>) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      setMessage("");
      await action();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operación fallida");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const toggleCell = (cell: Cell) =>
    setSelectedCells((current) =>
      current.some(
        (item) => item.row === cell.row && item.column === cell.column,
      )
        ? current.filter(
            (item) => item.row !== cell.row || item.column !== cell.column,
          )
        : [...current, cell],
    );

  if (!token)
    return (
      <main className="login">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            setLoginMessage("");
            void fetch("/api/admin/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username: loginUsername,
                password: loginPassword,
              }),
            })
              .then(async (response) => {
                const body = await response.json();
                if (!response.ok)
                  throw new Error(
                    body.message ?? "No fue posible iniciar sesión",
                  );
                sessionStorage.setItem("fecs-admin-token", body.token);
                setLoginPassword("");
                setToken(body.token);
              })
              .catch((error: unknown) =>
                setLoginMessage(
                  error instanceof Error
                    ? error.message
                    : "No fue posible iniciar sesión",
                ),
              );
          }}
        >
          <p className="organization">FECSUPOL</p>
          <h1>Bingo Virtual</h1>
          {loginMessage && (
            <p className="message" role="status">
              {loginMessage}
            </p>
          )}
          <label>
            Usuario
            <input
              required
              autoComplete="username"
              minLength={3}
              value={loginUsername}
              onChange={(event) => setLoginUsername(event.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              required
              type="password"
              autoComplete="current-password"
              minLength={10}
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
            />
          </label>
          <button className="primary">Ingresar</button>
        </form>
      </main>
    );

  const selectedGame = games.find((game) => game.id === selectedGameId);
  const tieBreakCandidates =
    gameState?.tieBreakCandidates ?? selectedGame?.tieBreakCandidates ?? [];
  const finalWinnerId = gameState?.finalWinnerId ?? selectedGame?.finalWinnerId;
  const displayedWinners = finalWinnerId
    ? winners.filter((winner) => winner.card.id === finalWinnerId)
    : winners;
  const hasBlockingGame = games.some(
    (game) => game.status === "ACTIVE" || game.status === "TIE_BREAK",
  );
  const pageTitle = isDrawView
    ? "Sorteo en vivo"
    : isUsersView
      ? "Administración de usuarios"
      : isWinnersView
        ? "Ganadores"
        : isWhatsAppView
          ? "Configuración de WhatsApp"
          : "Administración de sorteos";
  const drawBall = async () => {
    if (!selectedGame || drawingRef.current) return;
    drawingRef.current = true;
    setDrawing(true);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reducedMotion ? 600 : 4000;
    const drawnNumbers = new Set(
      gameState?.drawnBalls.map((ball) => ball.number) ?? [],
    );
    const availableNumbers = Array.from(
      { length: 75 },
      (_, index) => index + 1,
    ).filter((number) => !drawnNumbers.has(number));
    const interval = window.setInterval(
      () =>
        setRollingNumber(
          availableNumbers[
            Math.floor(Math.random() * availableNumbers.length)
          ] ?? null,
        ),
      reducedMotion ? 180 : 65,
    );
    try {
      await submit(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, duration));
        const result = (await request(
          `/api/admin/games/${selectedGame.id}/draw`,
          { method: "POST" },
        )) as { ball: Ball };
        window.clearInterval(interval);
        setRollingNumber(result.ball.number);
        await loadGameState(selectedGame.id);
      });
    } finally {
      window.clearInterval(interval);
      drawingRef.current = false;
      setDrawing(false);
      setRollingNumber(null);
    }
  };
  const finishGame = async () => {
    if (!selectedGame || drawingRef.current) return;
    const confirmed = window.confirm(
      `¿Terminar anticipadamente el sorteo "${selectedGame.name}"? Después no se podrán extraer más balotas.`,
    );
    if (!confirmed) return;
    await submit(async () => {
      await request(`/api/admin/games/${selectedGame.id}/finish`, {
        method: "POST",
      });
      await loadGameState(selectedGame.id);
    });
  };
  const breakTie = async () => {
    if (!selectedGame || tieBreaking || selectedGame.status !== "TIE_BREAK")
      return;
    const candidates = tieBreakCandidates.map(
      (candidate) => candidate.card.number,
    );
    setTieBreaking(true);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reducedMotion ? 600 : 4000;
    const interval = window.setInterval(
      () =>
        setRollingCardNumber(
          candidates[Math.floor(Math.random() * candidates.length)] ?? null,
        ),
      reducedMotion ? 180 : 75,
    );
    try {
      await new Promise((resolve) => window.setTimeout(resolve, duration));
      const result = (await request(
        `/api/admin/games/${selectedGame.id}/tie-break`,
        { method: "POST" },
      )) as { cardNumber: number };
      window.clearInterval(interval);
      setRollingCardNumber(result.cardNumber);
      await loadGameState(selectedGame.id);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible realizar el desempate",
      );
    } finally {
      window.clearInterval(interval);
      setTieBreaking(false);
      setRollingCardNumber(null);
    }
  };

  return (
    <main
      aria-busy={submitting}
      className={`admin ${isDrawView ? "draw-view" : isUsersView ? "users-view" : isWinnersView ? "winners-view" : isWhatsAppView ? "whatsapp-view" : "games-view"}`}
    >
      <header>
        <div>
          <p className="organization">FECSUPOL</p>
          <h1>{pageTitle}</h1>
          <nav className="section-nav">
            <a className={isGamesView ? "active" : ""} href="/admin/games">
              Sorteos
            </a>
            <a className={isUsersView ? "active" : ""} href="/admin/users">
              Usuarios
            </a>
            <a className={isWinnersView ? "active" : ""} href="/admin/winners">
              Ganadores
            </a>
            <a
              className={isWhatsAppView ? "active" : ""}
              href="/admin/whatsapp"
            >
              WhatsApp
            </a>
            <a
              className={isDrawView ? "active" : ""}
              href="/draw"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                event.preventDefault();
                openDrawPanel();
              }}
            >
              Panel de sorteo
            </a>
          </nav>
        </div>
        <button
          className="secondary"
          onClick={() => {
            void request("/api/admin/auth/logout", { method: "POST" }).finally(
              () => {
                sessionStorage.removeItem("fecs-admin-token");
                setToken("");
              },
            );
          }}
        >
          Cerrar sesión
        </button>
      </header>
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}
      {connectionMessage && (
        <p className="message" role="status">
          {connectionMessage}
        </p>
      )}
      {isUsersView && <UsersPage request={request} />}
      {isWinnersView && <WinnersPage request={request} games={games} />}
      <div className="panels admin-only">
        {whatsappSettings && (
          <form
            className="panel whatsapp-section"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(async () => {
                await request("/api/admin/whatsapp/settings", {
                  method: "PUT",
                  body: JSON.stringify({
                    ...whatsappSettings,
                    accessTokenConfigured: undefined,
                    ...(whatsappToken ? { accessToken: whatsappToken } : {}),
                  }),
                });
                setWhatsappToken("");
              });
            }}
          >
            <h2>WhatsApp Cloud API</h2>
            <label>
              Token de acceso
              <input
                type="password"
                placeholder={
                  whatsappSettings.accessTokenConfigured
                    ? "Configurado; dejar vacío para conservar"
                    : "Token permanente de Meta"
                }
                value={whatsappToken}
                onChange={(event) => setWhatsappToken(event.target.value)}
              />
            </label>
            <label>
              Phone Number ID
              <input
                required
                value={whatsappSettings.phoneNumberId ?? ""}
                onChange={(event) =>
                  setWhatsappSettings({
                    ...whatsappSettings,
                    phoneNumberId: event.target.value,
                  })
                }
              />
            </label>
            <label>
              WABA ID
              <input
                value={whatsappSettings.businessAccountId ?? ""}
                onChange={(event) =>
                  setWhatsappSettings({
                    ...whatsappSettings,
                    businessAccountId: event.target.value,
                  })
                }
              />
            </label>
            <label>
              URL pública
              <input
                required
                type="url"
                value={whatsappSettings.publicAppUrl ?? ""}
                onChange={(event) =>
                  setWhatsappSettings({
                    ...whatsappSettings,
                    publicAppUrl: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Contactos FECSUPOL (E.164, separados por coma)
              <input
                value={whatsappSettings.fundContacts ?? ""}
                onChange={(event) =>
                  setWhatsappSettings({
                    ...whatsappSettings,
                    fundContacts: event.target.value,
                  })
                }
              />
            </label>
            <details>
              <summary>Plantillas y versión</summary>
              <label>
                Versión Graph API
                <input
                  value={whatsappSettings.graphApiVersion}
                  onChange={(event) =>
                    setWhatsappSettings({
                      ...whatsappSettings,
                      graphApiVersion: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Idioma
                <input
                  value={whatsappSettings.templateLanguage}
                  onChange={(event) =>
                    setWhatsappSettings({
                      ...whatsappSettings,
                      templateLanguage: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Plantilla de acceso
                <input
                  value={whatsappSettings.playerAccessTemplate}
                  onChange={(event) =>
                    setWhatsappSettings({
                      ...whatsappSettings,
                      playerAccessTemplate: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Plantilla de asignación
                <input
                  value={whatsappSettings.cardAssignmentTemplate}
                  onChange={(event) =>
                    setWhatsappSettings({
                      ...whatsappSettings,
                      cardAssignmentTemplate: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Plantilla de ganador
                <input
                  value={whatsappSettings.winnerPlayerTemplate}
                  onChange={(event) =>
                    setWhatsappSettings({
                      ...whatsappSettings,
                      winnerPlayerTemplate: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Plantilla FECSUPOL
                <input
                  value={whatsappSettings.winnerFundTemplate}
                  onChange={(event) =>
                    setWhatsappSettings({
                      ...whatsappSettings,
                      winnerFundTemplate: event.target.value,
                    })
                  }
                />
              </label>
            </details>
            <button className="primary" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar configuración"}
            </button>
            <button
              type="button"
              onClick={() =>
                void submit(async () => {
                  const result = (await request(
                    "/api/admin/whatsapp/test",
                  )) as { verifiedName?: string };
                  setMessage(
                    `Conexión correcta${result.verifiedName ? `: ${result.verifiedName}` : ""}`,
                  );
                })
              }
            >
              Probar conexión
            </button>
          </form>
        )}

        <form
          className="panel games-section"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(async () => {
              await request("/api/admin/patterns", {
                method: "POST",
                body: JSON.stringify({
                  name: patternName,
                  cells: selectedCells,
                }),
              });
              setPatternName("");
              setSelectedCells([]);
            });
          }}
        >
          <h2>Programar figura</h2>
          <label>
            Nombre
            <input
              required
              minLength={2}
              value={patternName}
              onChange={(event) => setPatternName(event.target.value)}
            />
          </label>
          <PatternGrid cells={selectedCells} editable onToggle={toggleCell} />
          <button
            className="primary"
            disabled={!selectedCells.length || submitting}
          >
            {submitting ? "Guardando…" : "Guardar figura"}
          </button>
        </form>

        <form
          className="panel games-section"
          onSubmit={(event) => {
            event.preventDefault();
            const prizeError = validatePrizeAmount(gamePrizeAmount);
            setGamePrizeError(prizeError);
            if (prizeError) return;
            void submit(async () => {
              await request("/api/admin/games", {
                method: "POST",
                body: JSON.stringify({
                  name: gameName,
                  prizeAmount: Number(gamePrizeAmount),
                  winMode,
                  ...(winMode === "FIGURE" ? { patternId } : {}),
                }),
              });
              setGameName("");
              setGamePrizeAmount("");
              setGamePrizeError("");
            });
          }}
        >
          <h2>Crear sorteo</h2>
          <label>
            Nombre
            <input
              required
              minLength={2}
              value={gameName}
              onChange={(event) => setGameName(event.target.value)}
            />
          </label>
          <PrizeAmountInput
            value={gamePrizeAmount}
            error={gamePrizeError}
            disabled={submitting}
            onChange={(value) => {
              setGamePrizeAmount(value);
              setGamePrizeError("");
            }}
          />
          <label>
            Forma de ganar
            <select
              value={winMode}
              onChange={(event) =>
                setWinMode(event.target.value as "FULL_CARD" | "FIGURE")
              }
            >
              <option value="FULL_CARD">Cartón completo</option>
              <option value="FIGURE">Figura</option>
            </select>
          </label>
          {winMode === "FIGURE" && (
            <label>
              Figura
              <select
                required
                value={patternId}
                onChange={(event) => setPatternId(event.target.value)}
              >
                <option value="">Selecciona</option>
                {patterns.map((pattern) => (
                  <option key={pattern.id} value={pattern.id}>
                    {pattern.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="primary" disabled={submitting}>
            {submitting ? "Creando…" : "Crear sorteo"}
          </button>
          {hasBlockingGame && (
            <small>
              Puedes crear el sorteo ahora. Quedará como borrador y solo se
              podrá iniciar cuando termine el sorteo actual.
            </small>
          )}
        </form>
      </div>

      <section className="wide-panel admin-only games-section games-table-panel">
        <h2>Sorteos</h2>
        <div className="table-wrap">
          <table className="games-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Modalidad</th>
                <th>Estado</th>
                <th>Premio</th>
                <th>Cartones</th>
                <th>Balotas</th>
                <th>Ganadores</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id}>
                  <td>{game.name}</td>
                  <td>
                    {game.winningType === "CUSTOM"
                      ? game.patternName
                      : "Cartón completo"}
                  </td>
                  <td>{gameStatusLabel(game.status)}</td>
                  <td className="game-prize-cell">
                    {formatCop(game.prizeAmount)}
                  </td>
                  <td>{game._count.cards}</td>
                  <td>{game._count.drawnBalls}</td>
                  <td>{game._count.winners}</td>
                  <td className="game-actions-cell">
                    <div className="game-actions">
                      <a
                        className="table-action"
                        href={`/draw?game=${game.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => {
                          event.preventDefault();
                          openDrawPanel(game.id);
                        }}
                      >
                        Abrir panel
                      </a>
                      {game.status === "DRAFT" && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGame(game);
                            setEditGameName(game.name);
                            setEditGamePrizeAmount(
                              game.prizeAmount ? String(game.prizeAmount) : "",
                            );
                            setEditGamePrizeError("");
                          }}
                        >
                          Editar
                        </button>
                      )}
                      {game.status === "DRAFT" && (
                        <button
                          disabled={hasBlockingGame || submitting}
                          title={
                            hasBlockingGame
                              ? "Termina el sorteo activo o su desempate antes de iniciar otro"
                              : "Iniciar sorteo"
                          }
                          onClick={() =>
                            void submit(async () => {
                              await request(
                                `/api/admin/games/${game.id}/start`,
                                { method: "POST" },
                              );
                            })
                          }
                        >
                          Iniciar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editingGame && (
        <div
          className="game-edit-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting)
              setEditingGame(null);
          }}
        >
          <form
            className="game-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-game-title"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !submitting) setEditingGame(null);
            }}
            onSubmit={(event) => {
              event.preventDefault();
              const prizeError = validatePrizeAmount(editGamePrizeAmount);
              setEditGamePrizeError(prizeError);
              if (prizeError) return;
              void submit(async () => {
                await request(`/api/admin/games/${editingGame.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    name: editGameName,
                    prizeAmount: Number(editGamePrizeAmount),
                  }),
                });
                setEditingGame(null);
              });
            }}
          >
            <header>
              <div>
                <span>Sorteo en borrador</span>
                <h2 id="edit-game-title">Editar sorteo</h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar edición"
                disabled={submitting}
                onClick={() => setEditingGame(null)}
              >
                ×
              </button>
            </header>
            <div className="game-edit-fields">
              <label>
                Nombre
                <input
                  autoFocus
                  required
                  minLength={2}
                  maxLength={120}
                  value={editGameName}
                  onChange={(event) => setEditGameName(event.target.value)}
                />
              </label>
              <PrizeAmountInput
                value={editGamePrizeAmount}
                error={editGamePrizeError}
                disabled={submitting}
                onChange={(value) => {
                  setEditGamePrizeAmount(value);
                  setEditGamePrizeError("");
                }}
              />
              <p>
                El premio solo puede modificarse antes de iniciar el sorteo.
              </p>
            </div>
            <footer>
              <button
                type="button"
                className="secondary"
                disabled={submitting}
                onClick={() => setEditingGame(null)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar cambios"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {isDrawView && (
        <section className="wide-panel draw-selector">
          <h2>Seleccionar sorteo</h2>
          <select
            aria-label="Sorteo"
            value={selectedGameId}
            onChange={(event) => setSelectedGameId(event.target.value)}
          >
            <option value="">Selecciona un sorteo</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name} · {gameStatusLabel(game.status)}
              </option>
            ))}
          </select>
        </section>
      )}

      {isDrawView && selectedGame && (
        <section className="wide-panel draw-panel">
          <div className="draw-heading">
            <div className="draw-title">
              <h2 title={selectedGame.name}>Sorteo: {selectedGame.name}</h2>
              <p>
                {selectedGame.winningType === "CUSTOM"
                  ? `Figura: ${selectedGame.patternName}`
                  : "Objetivo: llenar el cartón"}
              </p>
              <p>
                <span
                  className={`draw-status-badge status-${selectedGame.status.toLowerCase()}`}
                >
                  Estado: {gameStatusLabel(selectedGame.status)}
                </span>
              </p>
              {selectedGame.endedManually && (
                <p>Este sorteo terminó anticipadamente.</p>
              )}
            </div>
            <div
              className={`draw-prize ${selectedGame.prizeAmount ? "has-prize" : "is-missing"}`}
              aria-label={
                selectedGame.prizeAmount
                  ? `Premio ${formatCop(selectedGame.prizeAmount)}`
                  : "Premio no registrado"
              }
            >
              <span>PREMIO</span>
              <strong>{formatCop(selectedGame.prizeAmount)}</strong>
            </div>
            <div className="draw-heading-actions">
              {selectedGame.status === "ACTIVE" && (
                <div className="draw-actions">
                  <button
                    className="draw-button"
                    disabled={drawing}
                    onClick={() => void drawBall()}
                  >
                    {drawing ? "Balotera girando…" : "Girar balotera"}
                  </button>
                  <button
                    className="danger"
                    disabled={drawing}
                    onClick={() => void finishGame()}
                  >
                    Terminar sorteo
                  </button>
                </div>
              )}
              {selectedGame.status === "FINISHED" && displayedWinners[0] && (
                <div className="final-winner-summary" aria-live="polite">
                  <span>Ganador</span>
                  <strong>{displayedWinners[0].card.user.name}</strong>
                  <small>
                    Cartón #{displayedWinners[0].card.number ?? "—"}
                  </small>
                </div>
              )}
            </div>
          </div>
          <div className="draw-layout">
            <div className="draw-status-column">
              <div className={`last-ball ${drawing ? "spinning" : ""}`}>
                <span>{drawing ? "Girando" : "Última balota"}</span>
                <strong>
                  {drawing
                    ? rollingNumber
                      ? bingoBallLabel(rollingNumber)
                      : "—"
                    : gameState?.drawnBalls.at(-1)
                      ? bingoBallLabel(gameState.drawnBalls.at(-1)!.number)
                      : "—"}
                </strong>
                <small>{gameState?.drawnBalls.length ?? 0} de 75</small>
              </div>
              <div
                className="draw-presence"
                aria-label="Participación del sorteo"
              >
                <div>
                  <span>Cartones jugando</span>
                  <strong>{selectedGame._count.cards}</strong>
                </div>
                <div>
                  <span>
                    <i
                      className={connectionMessage ? "is-offline" : ""}
                      aria-hidden="true"
                    />{" "}
                    Jugadores conectados
                  </span>
                  <strong>{activePlayers.length}</strong>
                </div>
              </div>
            </div>
            {selectedGame.status === "TIE_BREAK" && (
              <div
                className="draw-tie-banner"
                role="alert"
                aria-live="assertive"
              >
                <span>¡BINGO — EMPATE!</span>
                <strong>
                  {tieBreakCandidates
                    .map((candidate) => `#${candidate.card.number}`)
                    .join(" · ")}
                </strong>
                <p>Los cartones empatados pasan al sorteo de desempate.</p>
              </div>
            )}
            {selectedGame.status === "TIE_BREAK" && (
              <div className="tie-break-panel">
                <div
                  className={`tie-break-machine ${tieBreaking ? "spinning" : ""}`}
                >
                  <span>{tieBreaking ? "Girando" : "Cartones empatados"}</span>
                  <strong>
                    {tieBreaking
                      ? rollingCardNumber
                        ? `#${rollingCardNumber}`
                        : "—"
                      : tieBreakCandidates
                          .map((candidate) => candidate.card.number)
                          .join(" · ")}
                  </strong>
                </div>
                <button
                  className="draw-button"
                  disabled={tieBreaking}
                  onClick={() => void breakTie()}
                >
                  {tieBreaking ? "Desempatando…" : "Desempatar"}
                </button>
              </div>
            )}
            {selectedGame.status !== "TIE_BREAK" &&
              displayedWinners[0] &&
              displayedWinners[0].id === visibleWinnerId && (
                <div
                  className="draw-winner-banner"
                  role="alert"
                  aria-live="assertive"
                >
                  <div className="fireworks" aria-hidden="true">
                    {Array.from({ length: 12 }, (_, index) => (
                      <i key={index} />
                    ))}
                  </div>
                  <span>¡GANADOR!</span>
                  <strong>
                    {displayedWinners[0].card.user.name} — cartón #
                    {displayedWinners[0].card.number ?? "—"}
                  </strong>
                  <small className="draw-winner-prize">
                    Premio {formatCop(selectedGame.prizeAmount)}
                  </small>
                </div>
              )}
            <div className="draw-history">
              <h3>Historial B-I-N-G-O</h3>
              <div className="bingo-history-grid">
                {bingoHistoryColumns.map((column) => (
                  <div className="bingo-history-column" key={column.letter}>
                    <strong>{column.letter}</strong>
                    <div>
                      {gameState?.drawnBalls
                        .filter(
                          (ball) =>
                            ball.number >= column.min &&
                            ball.number <= column.max,
                        )
                        .slice()
                        .sort(
                          (first, second) => second.drawOrder - first.drawOrder,
                        )
                        .map((ball) => (
                          <span key={ball.id}>{ball.number}</span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="draw-figure">
              <h3>Figura objetivo</h3>
              {selectedGame.winningType === "CUSTOM" ? (
                <PatternGrid cells={selectedGame.winningCells} />
              ) : (
                <p>Cartón completo</p>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function App() {
  return window.location.pathname.startsWith("/player") ? (
    <PlayerApp />
  ) : (
    <AdminApp />
  );
}

export default App;
