import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCop } from "../../money";
import { WinnerDetailsDrawer } from "./WinnerDetailsDrawer";
import { WinnersTable } from "./WinnersTable";
import type { WinnerRecord, WinnersResponse } from "./types";
import "./WinnersPage.css";

type Request = (path: string, init?: RequestInit) => Promise<unknown>;
type GameOption = { id: string; name: string };
const emptyResponse: WinnersResponse = {
  items: [],
  pagination: { page: 1, pageSize: 10, total: 0, pageCount: 1 },
  summary: { totalWinners: 0, totalPrizeAmount: null, gamesWithWinner: 0 },
};

export function WinnersPage({
  request,
  games,
}: {
  request: Request;
  games: GameOption[];
}) {
  const [data, setData] = useState<WinnersResponse>(emptyResponse);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [gameId, setGameId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("DATE_DESC");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<WinnerRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);
  const params = useMemo(() => {
    const value = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      sort,
    });
    if (search.trim()) value.set("search", search.trim());
    if (gameId) value.set("gameId", gameId);
    if (dateFrom)
      value.set("dateFrom", new Date(`${dateFrom}T00:00:00`).toISOString());
    if (dateTo)
      value.set("dateTo", new Date(`${dateTo}T23:59:59.999`).toISOString());
    return value.toString();
  }, [dateFrom, dateTo, gameId, page, search, sort]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        (await request(`/api/admin/winners?${params}`)) as WinnersResponse,
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "No fue posible cargar los ganadores.",
      );
    } finally {
      setLoading(false);
    }
  }, [params, request]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timeout);
  }, [load]);
  useEffect(() => setPage(1), [dateFrom, dateTo, gameId, search, sort]);
  const activeFilters = Boolean(search || gameId || dateFrom || dateTo);
  const open = async (winner: WinnerRecord, trigger: HTMLElement) => {
    returnFocus.current = trigger;
    setSelected(winner);
    setDetailLoading(true);
    setDetailError("");
    try {
      setSelected(
        (await request(`/api/admin/winners/${winner.id}`)) as WinnerRecord,
      );
    } catch (nextError) {
      setDetailError(
        nextError instanceof Error
          ? nextError.message
          : "No fue posible abrir el detalle.",
      );
    } finally {
      setDetailLoading(false);
    }
  };
  const clear = () => {
    setSearch("");
    setGameId("");
    setDateFrom("");
    setDateTo("");
    setSort("DATE_DESC");
    setPage(1);
  };

  return (
    <section className="winners-page">
      <div className="winners-intro">
        <p>
          Consulta los ganadores registrados y los premios obtenidos en cada
          sorteo.
        </p>
      </div>
      <div className="winner-summary" aria-label="Resumen de ganadores">
        <article>
          <span>Total de ganadores</span>
          <strong>{data.summary.totalWinners}</strong>
        </article>
        <article>
          <span>Total entregado</span>
          <strong>{formatCop(data.summary.totalPrizeAmount)}</strong>
        </article>
        <article>
          <span>Sorteos con ganador</span>
          <strong>{data.summary.gamesWithWinner}</strong>
        </article>
      </div>
      <div className="winners-surface">
        <div className="winners-toolbar">
          <label className="winner-search">
            <span>Buscar</span>
            <input
              value={search}
              placeholder="Nombre o cartón"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span>Sorteo</span>
            <select
              value={gameId}
              onChange={(event) => setGameId(event.target.value)}
            >
              <option value="">Todos</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Desde</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label>
            <span>Hasta</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
          <label>
            <span>Ordenar</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="DATE_DESC">Más recientes</option>
              <option value="DATE_ASC">Más antiguos</option>
              <option value="PRIZE_DESC">Mayor premio</option>
              <option value="PRIZE_ASC">Menor premio</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!activeFilters && sort === "DATE_DESC"}
            onClick={clear}
          >
            Limpiar filtros
          </button>
        </div>
        {loading ? (
          <div className="winners-state" role="status">
            <span className="winners-spinner" />
            Cargando ganadores…
          </div>
        ) : error ? (
          <div className="winners-state is-error" role="alert">
            <strong>No fue posible cargar los ganadores</strong>
            <span>{error}</span>
            <button type="button" onClick={() => void load()}>
              Intentar nuevamente
            </button>
          </div>
        ) : !data.items.length ? (
          <div className="winners-state">
            <strong>
              {activeFilters
                ? "No encontramos coincidencias"
                : "Aún no hay ganadores registrados."}
            </strong>
            <span>
              {activeFilters
                ? "Cambia o limpia los filtros para ampliar la búsqueda."
                : "Los ganadores aparecerán aquí cuando finalicen los sorteos."}
            </span>
          </div>
        ) : (
          <WinnersTable
            items={data.items}
            onOpen={(winner, trigger) => void open(winner, trigger)}
          />
        )}
        {!loading && !error && data.pagination.total > 0 && (
          <div className="winners-pagination">
            <span>
              Mostrando {(page - 1) * 10 + 1}–
              {Math.min(page * 10, data.pagination.total)} de{" "}
              {data.pagination.total}
            </span>
            <div>
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </button>
              <span>
                Página {page} de {data.pagination.pageCount}
              </span>
              <button
                type="button"
                disabled={page >= data.pagination.pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
      <WinnerDetailsDrawer
        winner={selected}
        loading={detailLoading}
        error={detailError}
        returnFocus={returnFocus.current}
        onClose={() => {
          setSelected(null);
          setDetailError("");
        }}
      />
    </section>
  );
}
