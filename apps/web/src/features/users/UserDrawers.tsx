import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CardAssignmentSelector } from "./CardAssignmentSelector";
import { UserForm } from "./UserForm";
import type { CardTemplate, Player, PlayerDraft } from "./types";
import {
  cardCode,
  e164Phone,
  formatDate,
  formatPhone,
  validatePlayerDraft,
} from "./user-utils";

function useDialogFocus<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  returnFocus?: HTMLElement | null,
) {
  const panelRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous =
      returnFocus ?? (document.activeElement as HTMLElement | null);
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("button, input, select")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !panel) return;
      const controls = [
        ...panel.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), [href]",
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
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("drawer-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("drawer-open");
      previous?.focus();
    };
  }, [open, returnFocus]);
  return panelRef;
}

type FormDrawerProps = {
  open: boolean;
  title: string;
  description: string;
  value: PlayerDraft;
  existingPhones: string[];
  originalPhone?: string;
  saving: boolean;
  error: string;
  returnFocus?: HTMLElement | null;
  onChange: (value: PlayerDraft) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
};

export function UserFormDrawer(props: FormDrawerProps) {
  const [errors, setErrors] = useState<{ name?: string; phoneNumber?: string }>(
    {},
  );
  const panelRef = useDialogFocus<HTMLFormElement>(
    props.open,
    props.onClose,
    props.returnFocus,
  );
  if (!props.open) return null;

  const submit = async () => {
    const nextErrors = validatePlayerDraft(props.value);
    const phone = e164Phone(props.value);
    if (phone !== props.originalPhone && props.existingPhones.includes(phone))
      nextErrors.phoneNumber = "Ya existe un jugador con este número.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await props.onSave();
  };

  return (
    <div
      className="drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <form
        className="user-drawer form-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-title"
        ref={panelRef}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <header className="drawer-header">
          <div>
            <span className="drawer-eyebrow">Usuarios</span>
            <h2 id="user-form-title">{props.title}</h2>
            <p>{props.description}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar formulario"
            onClick={props.onClose}
          >
            ×
          </button>
        </header>
        <div className="drawer-content">
          {props.error && (
            <div className="drawer-alert is-error" role="alert">
              {props.error}
            </div>
          )}
          <UserForm
            value={props.value}
            onChange={(value) => {
              setErrors({});
              props.onChange(value);
            }}
            errors={errors}
            showActive={Boolean(props.originalPhone)}
          />
        </div>
        <footer className="drawer-footer">
          <button
            type="button"
            className="secondary-action"
            disabled={props.saving}
            onClick={props.onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="primary-action"
            disabled={props.saving}
          >
            {props.saving ? "Guardando…" : "Guardar jugador"}
          </button>
        </footer>
      </form>
    </div>
  );
}

type ManagementProps = {
  player: Player | null;
  catalog: CardTemplate[];
  catalogLoading: boolean;
  catalogError: string;
  saving: boolean;
  error: string;
  returnFocus?: HTMLElement | null;
  onClose: () => void;
  onRetryCatalog: () => void;
  onInitializeCatalog: () => void;
  onSave: (input: {
    cardNumbers: number[];
    sendWhatsApp: boolean;
  }) => Promise<void>;
  onResend: (cardNumber: number) => Promise<void>;
  onOpenEdit: (player: Player, trigger: HTMLElement) => void;
};

export function UserManagementDrawer(props: ManagementProps) {
  const player = props.player;
  const requestClose = props.onClose;
  const originalNumbers = useMemo(
    () => player?.cards.map((card) => card.number) ?? [],
    [player],
  );
  const [selectedNumbers, setSelectedNumbers] =
    useState<number[]>(originalNumbers);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [resending, setResending] = useState<number | null>(null);

  useEffect(() => {
    setSelectedNumbers(originalNumbers);
    setSendWhatsApp(true);
  }, [originalNumbers, player?.id]);

  const additions = selectedNumbers.filter(
    (number) => !originalNumbers.includes(number),
  );
  const removals = originalNumbers.filter(
    (number) => !selectedNumbers.includes(number),
  );
  const changed = additions.length > 0 || removals.length > 0;
  const close = useCallback(() => {
    if (
      changed &&
      !window.confirm("Hay cambios sin guardar. ¿Cerrar de todos modos?")
    )
      return;
    requestClose();
  }, [changed, requestClose]);
  const panelRef = useDialogFocus<HTMLElement>(
    Boolean(player),
    close,
    props.returnFocus,
  );

  if (!player) return null;

  return (
    <div
      className="drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <aside
        className="user-drawer management-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="management-title"
        ref={panelRef}
      >
        <header className="drawer-header">
          <div>
            <span className="drawer-eyebrow">Administrar jugador</span>
            <h2 id="management-title">{player.name}</h2>
            <p>{formatPhone(player.phone)}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar administración"
            onClick={close}
          >
            ×
          </button>
        </header>

        <div className="drawer-content management-content">
          {props.error && (
            <div className="drawer-alert is-error" role="alert">
              {props.error}
            </div>
          )}
          <section
            className="player-summary"
            aria-labelledby="player-summary-title"
          >
            <div className="drawer-section-heading">
              <div>
                <h3 id="player-summary-title">Datos del jugador</h3>
                <p>Información de contacto y estado de la cuenta.</p>
              </div>
              <button
                type="button"
                className="secondary-action compact"
                onClick={(event) =>
                  props.onOpenEdit(player, event.currentTarget)
                }
              >
                Editar jugador
              </button>
            </div>
            <dl>
              <div>
                <dt>WhatsApp</dt>
                <dd>{formatPhone(player.phone)}</dd>
              </div>
              <div>
                <dt>Cartones</dt>
                <dd>{player.cards.length}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{player.active ? "Activo" : "Inactivo"}</dd>
              </div>
            </dl>
          </section>

          <CardAssignmentSelector
            catalog={props.catalog}
            playerId={player.id}
            selectedNumbers={selectedNumbers}
            originalNumbers={originalNumbers}
            loading={props.catalogLoading}
            error={props.catalogError}
            onChange={setSelectedNumbers}
            onRetry={props.onRetryCatalog}
            onInitialize={props.onInitializeCatalog}
          />

          <section
            className="assigned-cards"
            aria-labelledby="assigned-cards-title"
          >
            <div className="drawer-section-heading">
              <div>
                <h3 id="assigned-cards-title">Cartones asignados</h3>
                <p>Son permanentes y no pueden retirarse ni transferirse.</p>
              </div>
            </div>
            {!player.cards.length ? (
              <div className="cards-empty">
                <strong>Sin cartones asignados</strong>
                <span>Selecciona cartones disponibles para este jugador.</span>
              </div>
            ) : (
              <div className="assigned-card-list">
                {player.cards.map((card) => (
                  <article key={card.id}>
                    <div>
                      <strong>Cartón #{card.number}</strong>
                      <span>{card.serial || cardCode(card.number)}</span>
                    </div>
                    <div>
                      <small>Asignación permanente</small>
                      <small>{formatDate(card.createdAt)}</small>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      disabled={resending === card.number}
                      onClick={() => {
                        setResending(card.number);
                        void props
                          .onResend(card.number)
                          .finally(() => setResending(null));
                      }}
                    >
                      {resending === card.number
                        ? "Enviando…"
                        : "Reenviar por WhatsApp"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section
            className="assignment-summary"
            aria-labelledby="assignment-summary-title"
          >
            <h3 id="assignment-summary-title">Resumen de cambios</h3>
            <dl>
              <div>
                <dt>Nuevos por asignar</dt>
                <dd>{additions.length}</dd>
              </div>
              <div>
                <dt>Por retirar</dt>
                <dd>{removals.length}</dd>
              </div>
              <div>
                <dt>Total final</dt>
                <dd>{selectedNumbers.length}</dd>
              </div>
            </dl>
            <label className="user-checkbox">
              <input
                type="checkbox"
                checked={sendWhatsApp}
                onChange={(event) => setSendWhatsApp(event.target.checked)}
              />
              <span>Enviar los cartones por WhatsApp después de guardar</span>
            </label>
          </section>
        </div>

        <footer className="drawer-footer">
          <button
            type="button"
            className="secondary-action"
            disabled={props.saving}
            onClick={close}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={!changed || props.saving}
            onClick={() =>
              void props.onSave({ cardNumbers: selectedNumbers, sendWhatsApp })
            }
          >
            {props.saving ? "Guardando…" : "Guardar asignación"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
