export const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCop(value?: string | number | null): string {
  if (value === null || value === undefined || value === "")
    return "PREMIO NO REGISTRADO";
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0
    ? copFormatter.format(amount).replace(/\s/g, "")
    : "PREMIO NO REGISTRADO";
}

export function formatPrizeInput(value: string): string {
  if (!value) return "";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(
    Number(value),
  );
}

export function validatePrizeAmount(value: string): string {
  if (!value) return "Ingresa el monto del premio.";
  if (!/^\d+$/.test(value)) return "Usa solamente números enteros.";
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) return "El monto es demasiado alto.";
  if (amount <= 0) return "El monto debe ser mayor que cero.";
  return "";
}
