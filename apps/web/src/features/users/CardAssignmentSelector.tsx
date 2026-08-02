import { useEffect, useMemo, useState } from "react";
import type { CardTemplate } from "./types";
import { cardCode } from "./user-utils";

type CardFilter = "AVAILABLE" | "SELECTED" | "OWN" | "OTHERS";

type Props = {
  catalog: CardTemplate[];
  playerId: string;
  selectedNumbers: number[];
  originalNumbers: number[];
  loading: boolean;
  error: string;
  onChange: (numbers: number[]) => void;
  onRetry: () => void;
  onInitialize: () => void;
};

const PAGE_SIZE = 24;

export function CardAssignmentSelector({
  catalog,
  playerId,
  selectedNumbers,
  originalNumbers,
  loading,
  error,
  onChange,
  onRetry,
  onInitialize,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CardFilter>("AVAILABLE");
  const [page, setPage] = useState(1);
  const selected = useMemo(() => new Set(selectedNumbers), [selectedNumbers]);
  const original = useMemo(() => new Set(originalNumbers), [originalNumbers]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase().replace(/^#/, "");
    return catalog.filter((template) => {
      const owned = template.card?.user.id === playerId;
      const assignedOther = Boolean(template.card) && !owned;
      const matches =
        !normalized ||
        String(template.number).includes(normalized) ||
        cardCode(template.number).toLowerCase().includes(normalized);
      if (!matches) return false;
      if (filter === "AVAILABLE") return !template.card;
      if (filter === "SELECTED") return selected.has(template.number);
      if (filter === "OWN") return owned;
      return assignedOther;
    });
  }, [catalog, filter, playerId, query, selected]);

  useEffect(() => setPage(1), [filter, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const available = catalog.filter((template) => !template.card);

  if (loading)
    return (
      <div className="cards-state" role="status">
        <span className="users-spinner" aria-hidden="true" />
        Cargando catálogo de cartones…
      </div>
    );
  if (error)
    return (
      <div className="cards-state is-error" role="alert">
        <strong>No fue posible cargar los cartones</strong>
        <span>{error}</span>
        <button type="button" onClick={onRetry}>
          Intentar nuevamente
        </button>
      </div>
    );
  if (!catalog.length)
    return (
      <div className="cards-state">
        <strong>El catálogo maestro todavía no existe</strong>
        <span>
          Inicialízalo una sola vez para habilitar los cartones del 1 al 130.
        </span>
        <button type="button" onClick={onInitialize}>
          Inicializar catálogo maestro
        </button>
      </div>
    );

  return (
    <section className="card-selector" aria-labelledby="permanent-cards-title">
      <div className="drawer-section-heading">
        <div>
          <h3 id="permanent-cards-title">Cartones permanentes</h3>
          <p>
            Los cartones asignados estarán disponibles para este jugador en
            todos los sorteos.
          </p>
        </div>
        <strong>{selected.size} seleccionados</strong>
      </div>

      <div className="card-selector-toolbar">
        <label className="search-control">
          <span className="sr-only">Buscar cartón</span>
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            placeholder="Buscar número o código"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="text-button"
          disabled={!available.length}
          onClick={() =>
            onChange(
              [
                ...new Set([
                  ...selectedNumbers,
                  ...available.map((card) => card.number),
                ]),
              ].sort((a, b) => a - b),
            )
          }
        >
          Seleccionar disponibles
        </button>
        <button
          type="button"
          className="text-button"
          disabled={!selectedNumbers.some((number) => !original.has(number))}
          onClick={() => onChange([...originalNumbers])}
        >
          Limpiar selección
        </button>
      </div>

      <div
        className="card-filter-tabs"
        role="group"
        aria-label="Filtrar cartones"
      >
        {(
          [
            ["AVAILABLE", "Disponibles"],
            ["SELECTED", "Seleccionados"],
            ["OWN", "De este jugador"],
            ["OTHERS", "De otros"],
          ] as Array<[CardFilter, string]>
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={filter === value ? "active" : ""}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {!visible.length ? (
        <div className="cards-empty">
          <strong>Sin cartones en esta vista</strong>
          <span>Cambia el filtro o limpia la búsqueda.</span>
        </div>
      ) : (
        <div className="card-option-grid">
          {visible.map((template) => {
            const owned = template.card?.user.id === playerId;
            const assignedOther = Boolean(template.card) && !owned;
            const isSelected = selected.has(template.number);
            const locked = owned;
            const status = assignedOther
              ? `Asignado a ${template.card?.user.name}`
              : locked
                ? "Asignado a este jugador"
                : isSelected
                  ? "Seleccionado"
                  : "Disponible";
            return (
              <label
                className={`card-option ${assignedOther ? "is-unavailable" : ""} ${locked ? "is-owned" : ""} ${isSelected && !locked ? "is-selected" : ""}`}
                key={template.id}
                title={assignedOther ? status : undefined}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={assignedOther || locked}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selectedNumbers, template.number].sort(
                            (a, b) => a - b,
                          )
                        : selectedNumbers.filter(
                            (number) => number !== template.number,
                          ),
                    )
                  }
                />
                <span className="card-option-number">#{template.number}</span>
                <small>{cardCode(template.number)}</small>
                <span className="card-option-status">
                  <span aria-hidden="true">
                    {assignedOther
                      ? "⊘"
                      : locked
                        ? "✓"
                        : isSelected
                          ? "✓"
                          : "+"}
                  </span>
                  {status}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="compact-pagination" aria-label="Páginas de cartones">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page} de {pageCount}
          </span>
          <button
            type="button"
            disabled={page === pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            Siguiente
          </button>
        </nav>
      )}
    </section>
  );
}
