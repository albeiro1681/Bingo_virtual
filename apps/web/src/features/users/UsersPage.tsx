import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UserFormDrawer,
  UserManagementDrawer,
  WhatsAppSendDialog,
  type WhatsAppSendTarget,
} from "./UserDrawers";
import { UsersTable } from "./UsersTable";
import type {
  AdminRequest,
  CardTemplate,
  Notice,
  Player,
  PlayerDraft,
} from "./types";
import { e164Phone, emptyPlayerDraft, playerToDraft } from "./user-utils";
import { CsvImportDialog } from "./CsvImportDialog";
import { downloadUsersTemplate } from "./csv-utils";
import type { BulkSendResult } from "./types";
import "./UsersPage.css";

type PlayerFilter = "ALL" | "WITH_CARDS" | "WITHOUT_CARDS";
type PlayerSort =
  "NEWEST" | "NAME_ASC" | "NAME_DESC" | "CARDS_DESC" | "CARDS_ASC";
const PAGE_SIZE = 10;

export function UsersPage({ request }: { request: AdminRequest }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [catalog, setCatalog] = useState<CardTemplate[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [playersError, setPlayersError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PlayerFilter>("ALL");
  const [sort, setSort] = useState<PlayerSort>("NEWEST");
  const [page, setPage] = useState(1);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [formMode, setFormMode] = useState<"CREATE" | "EDIT" | null>(null);
  const [formDraft, setFormDraft] = useState<PlayerDraft>(emptyPlayerDraft());
  const [formPlayerId, setFormPlayerId] = useState("");
  const [formError, setFormError] = useState("");
  const [managementError, setManagementError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [accessLink, setAccessLink] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkSendResult | null>(null);
  const [whatsappSendTarget, setWhatsappSendTarget] =
    useState<WhatsAppSendTarget | null>(null);
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [whatsappSendError, setWhatsappSendError] = useState("");
  const formReturnFocus = useRef<HTMLElement | null>(null);
  const managementReturnFocus = useRef<HTMLElement | null>(null);
  const whatsappSendReturnFocus = useRef<HTMLElement | null>(null);
  const requestLock = useRef(false);

  const loadPlayers = useCallback(async () => {
    setPlayersLoading(true);
    setPlayersError("");
    try {
      setPlayers((await request("/api/admin/users")) as Player[]);
    } catch (error) {
      setPlayersError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar los jugadores.",
      );
    } finally {
      setPlayersLoading(false);
    }
  }, [request]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      setCatalog((await request("/api/admin/cards/catalog")) as CardTemplate[]);
    } catch (error) {
      setCatalogError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar el catálogo.",
      );
    } finally {
      setCatalogLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadPlayers();
    void loadCatalog();
  }, [loadCatalog, loadPlayers]);

  useEffect(() => setPage(1), [filter, query, sort]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const filteredPlayers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    const result = players.filter((player) => {
      const matches =
        !normalized ||
        player.name.toLocaleLowerCase("es").includes(normalized) ||
        player.phone.includes(normalized.replace(/\s/g, ""));
      if (!matches) return false;
      if (filter === "WITH_CARDS") return player.cards.length > 0;
      if (filter === "WITHOUT_CARDS") return player.cards.length === 0;
      return true;
    });
    return result.sort((a, b) => {
      if (sort === "NAME_ASC") return a.name.localeCompare(b.name, "es");
      if (sort === "NAME_DESC") return b.name.localeCompare(a.name, "es");
      if (sort === "CARDS_DESC") return b.cards.length - a.cards.length;
      if (sort === "CARDS_ASC") return a.cards.length - b.cards.length;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filter, players, query, sort]);
  const pageCount = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  const visiblePlayers = filteredPlayers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const selectedPlayer =
    players.find((player) => player.id === selectedPlayerId) ?? null;

  useEffect(() => {
    const availableIds = new Set(players.map((player) => player.id));
    setSelectedIds(
      (current) => new Set([...current].filter((id) => availableIds.has(id))),
    );
  }, [players]);

  const toggleSelected = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleVisible = () =>
    setSelectedIds((current) => {
      const next = new Set(current);
      const allVisibleSelected = visiblePlayers.every((player) =>
        next.has(player.id),
      );
      for (const player of visiblePlayers)
        if (allVisibleSelected) next.delete(player.id);
        else next.add(player.id);
      return next;
    });

  const selectFiltered = () =>
    setSelectedIds(new Set(filteredPlayers.map((player) => player.id)));

  const sendBulkLinks = async () => {
    if (!selectedIds.size || bulkSending) return;
    if (
      !window.confirm(
        `Se enviará el enlace de acceso a ${selectedIds.size} jugador${selectedIds.size === 1 ? "" : "es"}. ¿Deseas continuar?`,
      )
    )
      return;
    setBulkSending(true);
    setBulkResult(null);
    try {
      const result = (await request("/api/admin/users/access-links/send", {
        method: "POST",
        body: JSON.stringify({ userIds: [...selectedIds] }),
      })) as BulkSendResult;
      setBulkResult(result);
      await loadPlayers();
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No fue posible completar el envío masivo.",
      });
    } finally {
      setBulkSending(false);
    }
  };

  const runOnce = async (action: () => Promise<void>) => {
    if (requestLock.current) return;
    requestLock.current = true;
    setSaving(true);
    try {
      await action();
    } finally {
      requestLock.current = false;
      setSaving(false);
    }
  };

  const openCreate = (trigger: HTMLElement) => {
    formReturnFocus.current = trigger;
    setFormDraft(emptyPlayerDraft());
    setFormPlayerId("");
    setFormError("");
    setFormMode("CREATE");
  };
  const openEdit = (player: Player, trigger: HTMLElement) => {
    formReturnFocus.current = trigger.closest(".management-drawer")
      ? managementReturnFocus.current
      : trigger;
    setSelectedPlayerId("");
    setFormDraft(playerToDraft(player.name, player.phone, player.active));
    setFormPlayerId(player.id);
    setFormError("");
    setFormMode("EDIT");
  };
  const openManagement = (player: Player, trigger: HTMLElement) => {
    managementReturnFocus.current = trigger;
    setManagementError("");
    setSelectedPlayerId(player.id);
  };

  const openAccessLinkSend = (player: Player, trigger: HTMLElement) => {
    whatsappSendReturnFocus.current = trigger;
    setWhatsappSendError("");
    setWhatsappSendTarget({
      kind: "ACCESS_LINK",
      player,
      requestId: window.crypto.randomUUID(),
    });
  };

  const openCardSend = (cardNumber: number, trigger: HTMLElement) => {
    if (!selectedPlayer) return;
    whatsappSendReturnFocus.current = trigger;
    setWhatsappSendError("");
    setWhatsappSendTarget({
      kind: "CARD_ASSIGNMENT",
      player: selectedPlayer,
      cardNumber,
      requestId: window.crypto.randomUUID(),
    });
  };

  const saveForm = () =>
    runOnce(async () => {
      setFormError("");
      try {
        const phone = e164Phone(formDraft);
        if (formMode === "CREATE") {
          const player = (await request("/api/admin/users", {
            method: "POST",
            body: JSON.stringify({ name: formDraft.name.trim(), phone }),
          })) as Player & { accessLink?: string };
          setPlayers((current) => [player, ...current]);
          if (player.accessLink) setAccessLink(player.accessLink);
          setNotice({
            tone: "success",
            message: "Jugador creado correctamente.",
          });
        } else {
          const updated = (await request(`/api/admin/users/${formPlayerId}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: formDraft.name.trim(),
              phone,
              active: formDraft.active,
            }),
          })) as Pick<Player, "id" | "name" | "phone" | "active">;
          setPlayers((current) =>
            current.map((player) =>
              player.id === updated.id ? { ...player, ...updated } : player,
            ),
          );
          setNotice({
            tone: "success",
            message: "Datos del jugador actualizados.",
          });
        }
        setFormMode(null);
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : "No fue posible guardar el jugador.",
        );
      }
    });

  const saveAssignment = (input: {
    cardNumbers: number[];
    sendWhatsApp: boolean;
  }) =>
    runOnce(async () => {
      if (!selectedPlayer) return;
      setManagementError("");
      try {
        const result = (await request(
          `/api/admin/cards/player/${selectedPlayer.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              cardNumbers: input.cardNumbers,
              sendWhatsApp: input.sendWhatsApp,
            }),
          },
        )) as { whatsappStatus: string };
        await Promise.all([loadPlayers(), loadCatalog()]);
        setNotice({
          tone:
            result.whatsappStatus === "SENT" ||
            result.whatsappStatus === "SKIPPED"
              ? "success"
              : "warning",
          message:
            result.whatsappStatus === "SENT"
              ? "Asignación guardada y enviada por WhatsApp."
              : result.whatsappStatus === "SKIPPED"
                ? "Asignación guardada correctamente."
                : "Asignación guardada. El envío de WhatsApp quedó pendiente.",
        });
      } catch (error) {
        setManagementError(
          error instanceof Error
            ? error.message
            : "No fue posible guardar la asignación.",
        );
      }
    });

  const getAccessLink = (player: Player) =>
    runOnce(async () => {
      try {
        const result = (await request(
          `/api/admin/users/${player.id}/access-link`,
        )) as { accessLink: string };
        setAccessLink(result.accessLink);
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No fue posible consultar el enlace.",
        });
      }
    });

  const sendWhatsApp = async (phone?: string) => {
    if (!whatsappSendTarget || whatsappSending) return;
    setWhatsappSending(true);
    setWhatsappSendError("");
    try {
      const commonBody = {
        requestId: whatsappSendTarget.requestId,
        ...(phone ? { phone } : {}),
      };
      if (whatsappSendTarget.kind === "ACCESS_LINK") {
        const result = (await request(
          `/api/admin/users/${whatsappSendTarget.player.id}/access-link/send`,
          {
            method: "POST",
            body: JSON.stringify(commonBody),
          },
        )) as { status: string; error?: string | null };
        if (result.status !== "SENT")
          throw new Error(
            result.error ?? "WhatsApp no confirmó el envío del enlace.",
          );
        setNotice({ tone: "success", message: "Enlace enviado por WhatsApp." });
        await loadPlayers();
      } else {
        const result = (await request(
          `/api/admin/cards/player/${whatsappSendTarget.player.id}/resend`,
          {
            method: "POST",
            body: JSON.stringify({
              ...commonBody,
              cardNumbers: [whatsappSendTarget.cardNumber],
            }),
          },
        )) as { status: string };
        if (result.status !== "SENT")
          throw new Error(
            "WhatsApp no está configurado o el envío quedó pendiente.",
          );
        setNotice({
          tone: "success",
          message: `Cartón #${whatsappSendTarget.cardNumber} reenviado por WhatsApp.`,
        });
      }
      setWhatsappSendTarget(null);
    } catch (error) {
      setWhatsappSendError(
        error instanceof Error
          ? error.message
          : "No fue posible completar el envío.",
      );
    } finally {
      setWhatsappSending(false);
    }
  };

  const toggleActive = (player: Player) =>
    runOnce(async () => {
      try {
        const updated = (await request(`/api/admin/users/${player.id}`, {
          method: "PATCH",
          body: JSON.stringify({ active: !player.active }),
        })) as Pick<Player, "id" | "active">;
        setPlayers((current) =>
          current.map((item) =>
            item.id === player.id ? { ...item, active: updated.active } : item,
          ),
        );
        setNotice({
          tone: "success",
          message: updated.active
            ? "Jugador activado."
            : "Jugador desactivado.",
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No fue posible cambiar el estado.",
        });
      }
    });

  const initializeCatalog = () =>
    runOnce(async () => {
      setManagementError("");
      try {
        await request("/api/admin/cards/catalog/initialize", {
          method: "POST",
        });
        await loadCatalog();
        setNotice({
          tone: "success",
          message: "Catálogo maestro inicializado correctamente.",
        });
      } catch (error) {
        setManagementError(
          error instanceof Error
            ? error.message
            : "No fue posible inicializar el catálogo.",
        );
      }
    });

  return (
    <section className="users-page" aria-labelledby="users-page-description">
      <div className="users-page-intro">
        <p id="users-page-description">
          Crea jugadores, administra sus datos y asigna cartones permanentes.
        </p>
        <div className="users-header-actions">
          <button type="button" onClick={downloadUsersTemplate}>
            Descargar plantilla
          </button>
          <button type="button" onClick={() => setImportOpen(true)}>
            Importar usuarios
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={(event) => openCreate(event.currentTarget)}
          >
            <span aria-hidden="true">＋</span> Nuevo jugador
          </button>
        </div>
      </div>

      {notice && (
        <div className={`users-notice is-${notice.tone}`} role="status">
          <span aria-hidden="true">
            {notice.tone === "success"
              ? "✓"
              : notice.tone === "error"
                ? "!"
                : "i"}
          </span>
          {notice.message}
          <button
            type="button"
            aria-label="Cerrar notificación"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}
      {accessLink && (
        <div className="access-link-notice">
          <div>
            <strong>Enlace de acceso</strong>
            <a href={accessLink} target="_blank" rel="noreferrer">
              {accessLink}
            </a>
          </div>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(accessLink)}
          >
            Copiar
          </button>
          <button
            type="button"
            aria-label="Ocultar enlace"
            onClick={() => setAccessLink("")}
          >
            ×
          </button>
        </div>
      )}

      <div className="users-surface">
        <div className="users-toolbar">
          <label className="search-control users-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Buscar jugadores</span>
            <input
              value={query}
              placeholder="Buscar por nombre o WhatsApp"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span>Mostrar</span>
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as PlayerFilter)
              }
            >
              <option value="ALL">Todos</option>
              <option value="WITH_CARDS">Con cartones asignados</option>
              <option value="WITHOUT_CARDS">Sin cartones asignados</option>
            </select>
          </label>
          <label>
            <span>Ordenar</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as PlayerSort)}
            >
              <option value="NEWEST">Más recientes</option>
              <option value="NAME_ASC">Nombre A–Z</option>
              <option value="NAME_DESC">Nombre Z–A</option>
              <option value="CARDS_DESC">Más cartones</option>
              <option value="CARDS_ASC">Menos cartones</option>
            </select>
          </label>
        </div>

        {selectedIds.size > 0 && (
          <div
            className="bulk-actions"
            role="region"
            aria-label="Acciones masivas"
          >
            <strong>
              {selectedIds.size} seleccionado{selectedIds.size === 1 ? "" : "s"}
            </strong>
            {selectedIds.size < filteredPlayers.length && (
              <button type="button" onClick={selectFiltered}>
                Seleccionar los {filteredPlayers.length} resultados filtrados
              </button>
            )}
            <span />
            <button type="button" onClick={() => setSelectedIds(new Set())}>
              Limpiar selección
            </button>
            <button
              type="button"
              className="primary-action"
              disabled={bulkSending}
              onClick={() => void sendBulkLinks()}
            >
              {bulkSending ? "Enviando…" : "Enviar enlaces por WhatsApp"}
            </button>
          </div>
        )}

        {bulkResult && (
          <div className="bulk-result" role="status">
            <div>
              <strong>Resultado del envío</strong>
              <button
                type="button"
                aria-label="Cerrar resultado"
                onClick={() => setBulkResult(null)}
              >
                ×
              </button>
            </div>
            <p>
              {bulkResult.total} seleccionados · {bulkResult.sent} exitosos ·{" "}
              {bulkResult.failed} fallidos · {bulkResult.skipped} omitidos
            </p>
            {bulkResult.results.some((item) => item.status !== "SENT") && (
              <ul>
                {bulkResult.results
                  .filter((item) => item.status !== "SENT")
                  .map((item) => (
                    <li key={item.userId}>
                      <strong>{item.name ?? item.userId}:</strong> {item.reason}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {playersError ? (
          <div className="users-state is-error" role="alert">
            <span className="users-state-icon">!</span>
            <strong>No fue posible cargar los jugadores</strong>
            <span>{playersError}</span>
            <button type="button" onClick={() => void loadPlayers()}>
              Intentar nuevamente
            </button>
          </div>
        ) : (
          <UsersTable
            players={visiblePlayers}
            totalPlayers={players.length}
            loading={playersLoading}
            hasQuery={Boolean(query || filter !== "ALL")}
            onManage={openManagement}
            onEdit={openEdit}
            onAccessLink={(player) => void getAccessLink(player)}
            onSendAccessLink={openAccessLinkSend}
            onToggleActive={(player) => void toggleActive(player)}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onToggleVisible={toggleVisible}
          />
        )}

        {!playersLoading && !playersError && filteredPlayers.length > 0 && (
          <div className="users-pagination">
            <span>
              Mostrando {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filteredPlayers.length)} de{" "}
              {filteredPlayers.length}
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
                Página {page} de {pageCount}
              </span>
              <button
                type="button"
                disabled={page === pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      <UserFormDrawer
        open={Boolean(formMode)}
        title={formMode === "EDIT" ? "Editar jugador" : "Nuevo jugador"}
        description={
          formMode === "EDIT"
            ? "Actualiza sus datos de contacto y estado."
            : "Registra los datos básicos para asignarle cartones."
        }
        value={formDraft}
        existingPhones={players.map((player) => player.phone)}
        originalPhone={
          formMode === "EDIT"
            ? players.find((player) => player.id === formPlayerId)?.phone
            : undefined
        }
        saving={saving}
        error={formError}
        returnFocus={formReturnFocus.current}
        onChange={setFormDraft}
        onClose={() => setFormMode(null)}
        onSave={saveForm}
      />
      <CsvImportDialog
        open={importOpen}
        request={request}
        onClose={() => setImportOpen(false)}
        onImported={async (imported, failed) => {
          await Promise.all([loadPlayers(), loadCatalog()]);
          setNotice({
            tone: failed ? "warning" : "success",
            message: `${imported} jugador${imported === 1 ? "" : "es"} importado${imported === 1 ? "" : "s"}${failed ? `; ${failed} no pudieron importarse.` : "."}`,
          });
        }}
      />
      <UserManagementDrawer
        player={selectedPlayer}
        catalog={catalog}
        catalogLoading={catalogLoading}
        catalogError={catalogError}
        saving={saving}
        error={managementError}
        returnFocus={managementReturnFocus.current}
        onClose={() => setSelectedPlayerId("")}
        onRetryCatalog={() => void loadCatalog()}
        onInitializeCatalog={() => void initializeCatalog()}
        onSave={saveAssignment}
        onResend={openCardSend}
        onOpenEdit={openEdit}
      />
      {whatsappSendTarget && (
        <WhatsAppSendDialog
          target={whatsappSendTarget}
          sending={whatsappSending}
          error={whatsappSendError}
          returnFocus={whatsappSendReturnFocus.current}
          onClose={() => {
            if (whatsappSending) return;
            setWhatsappSendTarget(null);
            setWhatsappSendError("");
          }}
          onSend={sendWhatsApp}
        />
      )}
    </section>
  );
}
