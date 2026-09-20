import { useCallback, useEffect, useState } from "react";

type Delivery = {
  id: string;
  kind: string;
  status: string;
  recipientMasked: string;
  attempts: number;
  createdAt: string;
  providerStatusAt: string | null;
  error: string | null;
  user: { name: string } | null;
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  SENT: "Aceptado por Meta",
  DELIVERED: "Entregado",
  READ: "Leído",
  FAILED: "Fallido",
};

const kindLabels: Record<string, string> = {
  PLAYER_ACCESS: "Enlace de acceso",
  CARD_ASSIGNMENT: "Asignación de cartones",
  WINNER_PLAYER: "Aviso al ganador",
  WINNER_GROUP: "Aviso a FECSUPOL",
  WINNER_CONTACT: "Aviso a FECSUPOL",
};

export function WhatsAppDeliveries({
  request,
}: {
  request: (path: string) => Promise<unknown>;
}) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDeliveries(
        (await request("/api/admin/whatsapp/deliveries")) as Delivery[],
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible consultar las entregas de WhatsApp.",
      );
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section
      className="panel whatsapp-deliveries"
      aria-label="Entregas de WhatsApp"
    >
      <h2>Entregas de WhatsApp</h2>
      <p>
        «Aceptado por Meta» no confirma que el mensaje haya llegado al teléfono.
        La entrega y la lectura se actualizan cuando Meta envía sus avisos al
        webhook configurado.
      </p>
      <button type="button" onClick={() => void refresh()} disabled={loading}>
        {loading ? "Actualizando…" : "Actualizar entregas"}
      </button>
      {error && <p role="alert">{error}</p>}
      {!loading && !error && deliveries.length === 0 && (
        <p>Aún no hay mensajes registrados.</p>
      )}
      {deliveries.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Mensaje</th>
                <th>Destinatario</th>
                <th>Estado</th>
                <th>Intentos</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td>
                    {new Date(delivery.createdAt).toLocaleString("es-CO")}
                  </td>
                  <td>{kindLabels[delivery.kind] ?? delivery.kind}</td>
                  <td>
                    {delivery.user?.name ?? "Contacto"} ·{" "}
                    {delivery.recipientMasked}
                  </td>
                  <td>
                    {statusLabels[delivery.status] ?? delivery.status}
                    {delivery.providerStatusAt && (
                      <small className="delivery-error">
                        {new Date(delivery.providerStatusAt).toLocaleString("es-CO")}
                      </small>
                    )}
                    {delivery.error && (
                      <small className="delivery-error">{delivery.error}</small>
                    )}
                  </td>
                  <td>{delivery.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <small>Se muestran los 50 envíos más recientes.</small>
    </section>
  );
}
