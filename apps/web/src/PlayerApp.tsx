import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import "./PlayerApp.css";
import { bingoBallLabel } from "./bingo-ball";

type Ball = { id: string; number: number; drawOrder: number };
type Cell = {
  id: string;
  row: number;
  column: number;
  number: number | null;
  isFree: boolean;
};
type Winner = { id: string; cardId: string; type: string };
type TieBreakCard = { id: string; number: number; userId: string };
type PlayerCard = {
  id: string;
  serial: string;
  number?: number | null;
  cells: Cell[];
  game: {
    id: string;
    name: string;
    status: string;
    winningType: string;
    patternName?: string | null;
    winningCells: Array<{ row: number; column: number }>;
    drawnBalls: Ball[];
    winners: Winner[];
    finalWinnerId?: string | null;
    finalWinner?: TieBreakCard | null;
    tieBreakCandidates: Array<{ id: string; card: TieBreakCard }>;
  } | null;
};

class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const columns = ["B", "I", "N", "G", "O"];
const gameStatusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  TIE_BREAK: "Desempate",
  FINISHED: "Finalizado",
  CANCELLED: "Cancelado",
};

function gameStatusLabel(status: string): string {
  return gameStatusLabels[status] ?? "Estado desconocido";
}

function PlayerApp() {
  const [token, setToken] = useState(() => {
    const linkToken = new URLSearchParams(window.location.search).get("token");
    if (linkToken) {
      sessionStorage.setItem("fecs-player-token", linkToken);
      window.history.replaceState({}, "", window.location.pathname);
      return linkToken;
    }
    return sessionStorage.getItem("fecs-player-token") ?? "";
  });
  const [tokenDraft, setTokenDraft] = useState("");
  const [player, setPlayer] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [marks, setMarks] = useState<Record<string, string[]>>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("fecs-bingo-marks") ?? "{}",
      ) as Record<string, string[]>;
    } catch {
      return {};
    }
  });
  const [message, setMessage] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");

  const request = useCallback(
    async (path: string) => {
      const response = await fetch(path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const responseText = await response.text();
      let body: unknown = {};
      try {
        body = responseText ? JSON.parse(responseText) : {};
      } catch {
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
          : (errorBody.message ?? "No fue posible ingresar");
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
      const [nextPlayer, nextCards] = (await Promise.all([
        request("/api/player/me"),
        request("/api/player/cards"),
      ])) as [{ id: string; name: string }, PlayerCard[]];
      setPlayer(nextPlayer);
      setCards(nextCards);
      setMessage("");
    } catch (error) {
      const nextMessage =
        error instanceof Error
          ? error.message
          : "No fue posible cargar los cartones";
      if (error instanceof HttpError && error.status === 401) {
        sessionStorage.removeItem("fecs-player-token");
        setLoginMessage(nextMessage);
        setToken("");
        return;
      }
      setMessage(nextMessage);
    }
  }, [request, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!token) return;
    const socket = io("/draws", { auth: { token } });
    const sync = () => void refresh();
    socket.on("ball:drawn", sync);
    socket.on("winner:detected", sync);
    socket.on("game:updated", sync);
    socket.on("cards:updated", sync);
    socket.on("tie-break:completed", sync);
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
    return () => {
      socket.disconnect();
    };
  }, [refresh, token]);

  const tiedCards = useMemo(
    () =>
      cards.filter((card) =>
        card.game?.tieBreakCandidates.some(
          (candidate) => candidate.card.id === card.id,
        ),
      ),
    [cards],
  );
  const winningCards = useMemo(
    () =>
      cards.filter((card) => {
        if (!card.game) return false;
        if (card.game.finalWinnerId) return card.game.finalWinnerId === card.id;
        return (
          card.game.status === "FINISHED" &&
          card.game.winners.length === 1 &&
          card.game.winners[0].cardId === card.id
        );
      }),
    [cards],
  );
  const pendingTie = tiedCards.some(
    (card) => card.game?.status === "TIE_BREAK",
  );
  const finishedTieLost = tiedCards.find(
    (card) =>
      card.game?.status === "FINISHED" &&
      card.game.finalWinnerId &&
      card.game.finalWinnerId !== card.id,
  );
  const hasNoGame = cards.length > 0 && cards.every((card) => !card.game);

  const toggleMark = (cardId: string, cellId: string) => {
    setMarks((current) => {
      const cardMarks = new Set(current[cardId] ?? []);
      if (cardMarks.has(cellId)) cardMarks.delete(cellId);
      else cardMarks.add(cellId);
      const next = { ...current, [cardId]: [...cardMarks] };
      localStorage.setItem("fecs-bingo-marks", JSON.stringify(next));
      return next;
    });
  };

  const downloadCardsPdf = async () => {
    if (!player || cards.length === 0 || generatingPdf) return;
    setGeneratingPdf(true);
    setPdfMessage("");
    try {
      const { createPlayerCardsPdf, playerCardsPdfFilename } = await import(
        "./player-cards-pdf"
      );
      const bytes = await createPlayerCardsPdf({
        playerName: player.name,
        cards,
      });
      const pdfBuffer = Uint8Array.from(bytes).buffer as ArrayBuffer;
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = playerCardsPdfFilename(player.name);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setPdfMessage("No fue posible generar el PDF. Intenta nuevamente.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (!token)
    return (
      <main className="player-login">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setLoginMessage("");
            sessionStorage.setItem("fecs-player-token", tokenDraft);
            setToken(tokenDraft);
          }}
        >
          <p className="organization">FECSUPOL</p>
          <h1>Mis cartones</h1>
          {loginMessage && (
            <p className="player-message" role="status">
              {loginMessage}
            </p>
          )}
          <label>
            Token de acceso
            <input
              required
              type="password"
              value={tokenDraft}
              onChange={(event) => setTokenDraft(event.target.value)}
            />
          </label>
          <button>Ingresar</button>
          <a href="/">Administración</a>
        </form>
      </main>
    );

  return (
    <main className="player-view">
      <header>
        <div>
          <p className="organization">FECSUPOL</p>
          <h1>Bingo Virtual</h1>
          <p>{player ? `Hola, ${player.name}` : "Cargando…"}</p>
        </div>
        <div className="player-header-actions">
          <button
            type="button"
            className="download-cards-button"
            disabled={!cards.length || generatingPdf}
            onClick={() => void downloadCardsPdf()}
          >
            {generatingPdf ? "Generando PDF…" : "Descargar cartones en PDF"}
          </button>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem("fecs-player-token");
              setToken("");
            }}
          >
            Salir
          </button>
        </div>
      </header>
      {pdfMessage && (
        <p className="player-message" role="alert">
          {pdfMessage}
        </p>
      )}
      {message && <p className="player-message">{message}</p>}
      {connectionMessage && (
        <p className="player-message" role="status">
          {connectionMessage}
        </p>
      )}
      {hasNoGame && (
        <p className="player-message no-game-message" role="status">
          Aún no hay sorteo.
        </p>
      )}
      {pendingTie && (
        <div className="tie-banner" role="alert">
          <strong>¡BINGO — EMPATE!</strong>
          <span>
            Cartones empatados:{" "}
            {tiedCards[0]?.game?.tieBreakCandidates
              .map((candidate) => `#${candidate.card.number}`)
              .join(" · ")}
            . FECSUPOL realizará el desempate.
          </span>
        </div>
      )}
      {winningCards.length > 0 && (
        <div className="winner-banner" role="alert">
          <strong>¡BINGO!</strong>
          <span>
            {winningCards[0].game?.tieBreakCandidates.length
              ? `Ganaste el desempate con el cartón #${winningCards[0].number}.`
              : `Ganaste con ${winningCards.length === 1 ? "tu cartón" : `${winningCards.length} cartones`}.`}
          </span>
        </div>
      )}
      {!winningCards.length && finishedTieLost && (
        <div className="tie-result-banner" role="status">
          <strong>Desempate finalizado</strong>
          <span>
            El cartón ganador fue el #
            {finishedTieLost.game?.finalWinner?.number ?? "—"}.
          </span>
        </div>
      )}
      {!cards.length && !message && (
        <section className="empty-state">
          <h2>Aún no tienes cartones asignados</h2>
          <p>Cuando FECSUPOL te asigne un cartón aparecerá aquí.</p>
        </section>
      )}
      <div className="player-cards">
        {cards.map((card) => {
          const game = card.game;
          if (!game)
            return (
              <article className="player-card" key={card.id}>
                <div className="card-top">
                  <div>
                    <h2>Cartón #{card.number ?? "—"}</h2>
                    <span>Asignación permanente</span>
                  </div>
                </div>
                <p className="objective">
                  Cartón asignado por FECSUPOL
                </p>
                <div className="bingo-grid">
                  <div className="bingo-head">
                    {columns.map((column) => (
                      <strong key={column}>{column}</strong>
                    ))}
                  </div>
                  {Array.from({ length: 5 }, (_, row) => (
                    <div className="bingo-row" key={row}>
                      {Array.from({ length: 5 }, (_, column) =>
                        card.cells.find(
                          (cell) =>
                            cell.row === row && cell.column === column,
                        ),
                      ).map((cell, column) => (
                        <span
                          key={cell?.id ?? column}
                          className={cell?.isFree ? "free" : undefined}
                          aria-label={cell?.isFree ? "Centro libre" : undefined}
                        >
                          {cell?.isFree ? "★" : cell?.number}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </article>
            );
          const drawn = new Set(game.drawnBalls.map((ball) => ball.number));
          const required = new Set(
            game.winningCells.map((cell) => `${cell.row}:${cell.column}`),
          );
          const latest = game.drawnBalls.at(-1);
          const winner = game.finalWinnerId
            ? game.finalWinnerId === card.id
            : game.status === "FINISHED" &&
              game.winners.length === 1 &&
              game.winners[0].cardId === card.id;
          const tied =
            game.status === "TIE_BREAK" &&
            game.tieBreakCandidates.some(
              (candidate) => candidate.card.id === card.id,
            );
          return (
            <article
              className={`player-card ${winner ? "is-winner" : ""} ${tied ? "is-tied" : ""}`}
              key={card.id}
            >
              <div className="card-top">
                <div>
                  <h2>{game.name}</h2>
                  <span>
                    Cartón #{card.number ?? "—"} ·{" "}
                    {gameStatusLabel(game.status)}
                  </span>
                </div>
                <div className="latest-player-ball">
                  <small>Última</small>
                  <strong>
                    {latest ? bingoBallLabel(latest.number) : "—"}
                  </strong>
                </div>
              </div>
              <p className="objective">
                {game.winningType === "CUSTOM"
                  ? `Figura: ${game.patternName}`
                  : "Objetivo: llenar el cartón"}
              </p>
              <div className="bingo-grid">
                <div className="bingo-head">
                  {columns.map((column) => (
                    <strong key={column}>{column}</strong>
                  ))}
                </div>
                {Array.from({ length: 5 }, (_, row) => (
                  <div className="bingo-row" key={row}>
                    {Array.from({ length: 5 }, (_, column) =>
                      card.cells.find(
                        (cell) => cell.row === row && cell.column === column,
                      ),
                    ).map((cell, column) => {
                      if (!cell) return <span key={column} />;
                      const marked =
                        cell.isFree ||
                        drawn.has(cell.number ?? -1) ||
                        (marks[card.id] ?? []).includes(cell.id);
                      const target =
                        game.winningType !== "CUSTOM" ||
                        required.has(`${cell.row}:${cell.column}`);
                      return (
                        <button
                          type="button"
                          key={cell.id}
                          className={`${marked ? "marked" : ""} ${target ? "target" : ""}`}
                          onClick={() => toggleMark(card.id, cell.id)}
                        >
                          {cell.isFree ? "★" : cell.number}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="player-history">
                <strong>Balotas</strong>
                <div>
                  {game.drawnBalls.map((ball) => (
                    <span key={ball.id}>{ball.number}</span>
                  ))}
                </div>
              </div>
              <small className="manual-note">
                La marcación es una ayuda visual. FECSUPOL valida el ganador
                automáticamente.
              </small>
            </article>
          );
        })}
      </div>
    </main>
  );
}

export default PlayerApp;
