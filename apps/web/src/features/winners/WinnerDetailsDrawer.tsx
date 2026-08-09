import { useEffect, useRef } from "react";
import { formatCop } from "../../money";
import type { WinnerRecord } from "./types";

const dateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-CO", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(value))
    : "Sin fecha";

export function WinnerDetailsDrawer({
  winner,
  loading,
  error,
  returnFocus,
  onClose,
}: {
  winner: WinnerRecord | null;
  loading: boolean;
  error: string;
  returnFocus: HTMLElement | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!winner && !loading) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab" || !ref.current) return;
      const controls = [
        ...ref.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)",
        ),
      ];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("button, a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      returnFocus?.focus();
    };
  }, [loading, returnFocus, winner]);
  if (!winner && !loading && !error) return null;
  return (
    <div
      className="winner-drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={ref}
        className="winner-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="winner-detail-title"
      >
        <header>
          <div>
            <span>Ganador registrado</span>
            <h2 id="winner-detail-title">
              {winner?.player.name ?? "Detalle del ganador"}
            </h2>
          </div>
          <button type="button" aria-label="Cerrar detalle" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="winner-drawer-content">
          {loading && (
            <div className="winners-state" role="status">
              Cargando detalle…
            </div>
          )}
          {error && (
            <div className="winners-state is-error" role="alert">
              <strong>Error al abrir el detalle</strong>
              <span>{error}</span>
            </div>
          )}
          {winner && (
            <>
              <section>
                <h3>Ganador</h3>
                <dl>
                  <div>
                    <dt>Nombre</dt>
                    <dd>{winner.player.name}</dd>
                  </div>
                  {winner.player.phone && (
                    <div>
                      <dt>Contacto</dt>
                      <dd>{winner.player.phone}</dd>
                    </div>
                  )}
                </dl>
              </section>
              <section>
                <h3>Sorteo y premio</h3>
                <dl>
                  <div>
                    <dt>Sorteo</dt>
                    <dd>{winner.game.name}</dd>
                  </div>
                  <div>
                    <dt>Fecha del sorteo</dt>
                    <dd>{dateTime(winner.game.startedAt)}</dd>
                  </div>
                  <div>
                    <dt>Monto ganado</dt>
                    <dd className="winner-prize-detail">
                      {formatCop(winner.prizeAmount)}
                    </dd>
                  </div>
                  <div>
                    <dt>Registrado</dt>
                    <dd>{dateTime(winner.detectedAt)}</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h3>Cartón ganador</h3>
                <dl>
                  <div>
                    <dt>Número</dt>
                    <dd>#{winner.card.number}</dd>
                  </div>
                  <div>
                    <dt>Código</dt>
                    <dd>{winner.card.serial}</dd>
                  </div>
                  <div>
                    <dt>Patrón</dt>
                    <dd>
                      {winner.game.winningType === "CUSTOM"
                        ? (winner.game.patternName ?? "Figura")
                        : "Cartón completo"}
                    </dd>
                  </div>
                  <div>
                    <dt>Balota ganadora</dt>
                    <dd>{winner.winningBallNumber ?? "No registrada"}</dd>
                  </div>
                </dl>
              </section>
              <a
                className="winner-game-link"
                href={`/draw?game=${winner.game.id}`}
              >
                Abrir panel del sorteo
              </a>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
