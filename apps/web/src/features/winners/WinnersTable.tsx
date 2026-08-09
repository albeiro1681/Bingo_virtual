import { formatCop } from "../../money";
import type { WinnerRecord } from "./types";

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "Sin fecha";

export function WinnersTable({
  items,
  onOpen,
}: {
  items: WinnerRecord[];
  onOpen: (winner: WinnerRecord, trigger: HTMLElement) => void;
}) {
  return (
    <div className="winners-table-wrap">
      <table className="winners-table">
        <thead>
          <tr>
            <th>Sorteo</th>
            <th>Fecha</th>
            <th>Ganador</th>
            <th>Cartón</th>
            <th className="money-column">Monto ganado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((winner) => (
            <tr key={winner.id}>
              <td data-label="Sorteo">
                <strong className="winner-game-name" title={winner.game.name}>
                  {winner.game.name}
                </strong>
              </td>
              <td data-label="Fecha">{date(winner.game.startedAt)}</td>
              <td data-label="Ganador">
                <span className="winner-player-name" title={winner.player.name}>
                  {winner.player.name}
                </span>
              </td>
              <td data-label="Cartón">
                <span className="winner-card-number">
                  #{winner.card.number}
                </span>
              </td>
              <td data-label="Monto ganado" className="money-column">
                <strong>{formatCop(winner.prizeAmount)}</strong>
              </td>
              <td data-label="Acciones">
                <button
                  type="button"
                  className="winner-detail-button"
                  onClick={(event) => onOpen(winner, event.currentTarget)}
                >
                  Ver detalle
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
