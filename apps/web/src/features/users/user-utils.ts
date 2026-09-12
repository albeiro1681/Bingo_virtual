import type { PlayerDraft } from "./types";

export const countryCodes = [
  { value: "+57", label: "Colombia (+57)" },
  { value: "+1", label: "Estados Unidos/Canadá (+1)" },
  { value: "+52", label: "México (+52)" },
  { value: "+54", label: "Argentina (+54)" },
  { value: "+56", label: "Chile (+56)" },
  { value: "+51", label: "Perú (+51)" },
  { value: "+593", label: "Ecuador (+593)" },
  { value: "+58", label: "Venezuela (+58)" },
  { value: "+34", label: "España (+34)" },
];

export function emptyPlayerDraft(): PlayerDraft {
  return { name: "", countryCode: "+57", phoneNumber: "", active: true };
}

export function playerToDraft(
  name: string,
  phone: string,
  active: boolean,
): PlayerDraft {
  const countryCode =
    [...countryCodes]
      .sort((a, b) => b.value.length - a.value.length)
      .find((option) => phone.startsWith(option.value))?.value ?? "+57";
  return {
    name,
    countryCode,
    phoneNumber: phone.slice(countryCode.length),
    active,
  };
}

export function e164Phone(draft: PlayerDraft): string {
  return `${draft.countryCode}${draft.phoneNumber.replace(/\D/g, "")}`;
}

export function validatePhoneDraft(draft: PlayerDraft): string | undefined {
  if (!/^\+[1-9]\d{7,14}$/.test(e164Phone(draft)))
    return "Escribe un número válido de 8 a 15 dígitos.";
  return undefined;
}

export function validatePlayerDraft(draft: PlayerDraft) {
  const errors: { name?: string; phoneNumber?: string } = {};
  if (draft.name.trim().length < 2)
    errors.name = "Escribe el nombre completo del jugador.";
  errors.phoneNumber = validatePhoneDraft(draft);
  if (!errors.phoneNumber) delete errors.phoneNumber;
  return errors;
}

export function formatPhone(phone: string): string {
  if (phone.startsWith("+57") && phone.length === 13)
    return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`;
  return phone.replace(/(\+\d{1,3})(?=\d)/, "$1 ");
}

export function formatDate(value?: string): string {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function cardCode(number: number): string {
  return `FECSUPOL-${String(number).padStart(3, "0")}`;
}
