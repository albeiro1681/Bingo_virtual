import { useEffect, useRef, useState } from "react";
import type { AdminRequest, CsvImportPreview } from "./types";
import {
  downloadCsv,
  parseUsersCsv,
  type ParsedCsvPlayer,
} from "./csv-utils";

export function CsvImportDialog({
  open,
  request,
  onClose,
  onImported,
}: {
  open: boolean;
  request: AdminRequest;
  onClose: () => void;
  onImported: (imported: number, failed: number) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<ParsedCsvPlayer[]>([]);
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const reset = () => {
    setRows([]);
    setPreview(null);
    setFileName("");
    setError("");
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const selectFile = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const parsed = parseUsersCsv(await file.text());
      if (!parsed.length) throw new Error("El archivo no contiene jugadores.");
      const formData = new FormData();
      formData.append("file", file, file.name);
      let result: CsvImportPreview;
      try {
        result = (await request("/api/admin/users/import/preview", {
          method: "POST",
          body: formData,
        })) as CsvImportPreview;
      } catch (requestError) {
        console.error(
          "Error al solicitar la vista previa del CSV",
          requestError,
        );
        throw new Error(
          "No fue posible procesar el archivo. Verifica el formato o intenta nuevamente.",
        );
      }
      setRows(parsed);
      setPreview(result);
      setFileName(file.name);
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error ? cause.message : "No fue posible leer el archivo.",
      );
    } finally {
      setLoading(false);
    }
  };

  const importValid = async () => {
    if (!preview?.summary.validUsers || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = (await request("/api/admin/users/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      })) as { imported: number; failed: number };
      await onImported(result.imported, result.failed);
      reset();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No fue posible importar los jugadores.",
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadErrors = () => {
    if (!preview) return;
    const lines = preview.rows
      .filter((row) => !row.valid)
      .map((row) =>
        [row.line, row.name, row.phone ?? "", row.errors.map((item) => item.message).join(" | ")]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(";"),
      );
    downloadCsv("errores-importacion.csv", `fila;nombre;celular;errores\n${lines.join("\n")}\n`);
  };

  return (
    <dialog
      ref={dialogRef}
      className="csv-import-dialog"
      aria-labelledby="csv-import-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <div className="csv-dialog-header">
        <div>
          <h2 id="csv-import-title">Importar usuarios</h2>
          <p>Selecciona un CSV UTF-8 separado por punto y coma.</p>
        </div>
        <button type="button" aria-label="Cerrar importación" onClick={close}>×</button>
      </div>

      <label className="csv-file-control">
        <span>{fileName || "Seleccionar archivo CSV"}</span>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={loading}
          onChange={(event) => void selectFile(event.target.files?.[0])}
        />
      </label>
      <p className="csv-help">Columnas requeridas: nombre;celular;cartones</p>
      {error && <div className="csv-error" role="alert">{error}</div>}
      {loading && <div className="csv-loading" role="status">Procesando archivo…</div>}

      {preview && (
        <>
          <div className="csv-summary" aria-label="Resumen de importación">
            <span><strong>{preview.summary.validUsers}</strong> usuarios válidos</span>
            <span><strong>{preview.summary.invalidUsers}</strong> con errores</span>
            <span><strong>{preview.summary.cardsToAssign}</strong> cartones por asignar</span>
          </div>
          <div className="csv-preview-wrap">
            <table className="csv-preview-table">
              <thead><tr><th>Fila</th><th>Jugador</th><th>Celular</th><th>Cartones</th><th>Validación</th></tr></thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.line} className={row.valid ? "is-valid" : "is-invalid"}>
                    <td>{row.line}</td><td>{row.name || "Sin nombre"}</td>
                    <td>{row.phone ?? "Inválido"}</td><td>{row.cardNumbers.join(", ") || "Ninguno"}</td>
                    <td>{row.valid ? <span className="csv-valid">✓ Usuario válido</span> : <ul>{row.errors.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="csv-dialog-actions">
        {preview?.summary.invalidUsers ? <button type="button" onClick={downloadErrors}>Descargar reporte de errores</button> : null}
        <span />
        <button type="button" onClick={close} disabled={loading}>Cancelar</button>
        <button type="button" className="primary-action" disabled={!preview?.summary.validUsers || loading} onClick={() => void importValid()}>
          {loading ? "Importando…" : "Importar usuarios válidos"}
        </button>
      </div>
    </dialog>
  );
}
