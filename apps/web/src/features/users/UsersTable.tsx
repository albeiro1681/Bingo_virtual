import type { Player } from "./types";
import { formatDate, formatPhone } from "./user-utils";

type Props = {
  players: Player[];
  totalPlayers: number;
  loading: boolean;
  hasQuery: boolean;
  onManage: (player: Player, trigger: HTMLElement) => void;
  onEdit: (player: Player, trigger: HTMLElement) => void;
  onAccessLink: (player: Player) => void;
  onSendAccessLink: (player: Player, trigger: HTMLElement) => void;
  onToggleActive: (player: Player) => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onToggleVisible: () => void;
};

export function UsersTable({
  players,
  totalPlayers,
  loading,
  hasQuery,
  onManage,
  onEdit,
  onAccessLink,
  onSendAccessLink,
  onToggleActive,
  selectedIds,
  onToggleSelected,
  onToggleVisible,
}: Props) {
  if (loading)
    return (
      <div className="users-state" role="status" aria-live="polite">
        <span className="users-spinner" aria-hidden="true" />
        <strong>Cargando jugadores…</strong>
        <span>Estamos preparando el listado.</span>
      </div>
    );

  if (!players.length)
    return (
      <div className="users-state">
        <span className="users-state-icon" aria-hidden="true">
          {totalPlayers ? "⌕" : "+"}
        </span>
        <strong>
          {hasQuery ? "No encontramos coincidencias" : "Aún no hay jugadores"}
        </strong>
        <span>
          {hasQuery
            ? "Prueba con otro nombre, teléfono o filtro."
            : "Crea el primer jugador para comenzar a asignar cartones."}
        </span>
      </div>
    );

  return (
    <div className="users-table-wrap">
      <table className="users-table">
        <thead>
          <tr>
            <th className="users-selection-column">
              <input
                type="checkbox"
                aria-label="Seleccionar todos los jugadores visibles"
                checked={players.every((player) => selectedIds.has(player.id))}
                ref={(element) => {
                  if (element)
                    element.indeterminate =
                      players.some((player) => selectedIds.has(player.id)) &&
                      !players.every((player) => selectedIds.has(player.id));
                }}
                onChange={onToggleVisible}
              />
            </th>
            <th>Jugador</th>
            <th>WhatsApp</th>
            <th>Cartones</th>
            <th className="users-date-column">Creado</th>
            <th>Estado</th>
            <th className="users-actions-column">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td className="users-selection-column" data-label="Seleccionar">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar a ${player.name}`}
                  checked={selectedIds.has(player.id)}
                  onChange={() => onToggleSelected(player.id)}
                />
              </td>
              <td data-label="Jugador">
                <strong className="user-name">{player.name}</strong>
              </td>
              <td data-label="WhatsApp">
                <a
                  className="phone-link"
                  href={`https://wa.me/${player.phone.slice(1)}`}
                >
                  {formatPhone(player.phone)}
                </a>
              </td>
              <td data-label="Cartones">
                <span className="card-count-badge">
                  {player.cards.length}{" "}
                  {player.cards.length === 1 ? "cartón" : "cartones"}
                </span>
              </td>
              <td className="users-date-column" data-label="Creado">
                {formatDate(player.createdAt)}
              </td>
              <td data-label="Estado">
                <span
                  className={`user-status ${player.active ? "is-active" : "is-inactive"}`}
                >
                  <span aria-hidden="true">{player.active ? "●" : "○"}</span>
                  {player.active ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="users-actions-column" data-label="Acciones">
                <div className="row-actions">
                  <button
                    className="manage-user-button"
                    type="button"
                    onClick={(event) => onManage(player, event.currentTarget)}
                  >
                    Administrar
                  </button>
                  <details className="row-action-menu">
                    <summary aria-label={`Más acciones para ${player.name}`}>
                      ⋮
                    </summary>
                    <div role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(event) => onEdit(player, event.currentTarget)}
                      >
                        Editar datos
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => onAccessLink(player)}
                      >
                        Ver enlace de acceso
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(event) =>
                          onSendAccessLink(player, event.currentTarget)
                        }
                      >
                        Enviar enlace
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => onToggleActive(player)}
                      >
                        {player.active
                          ? "Desactivar jugador"
                          : "Activar jugador"}
                      </button>
                    </div>
                  </details>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
