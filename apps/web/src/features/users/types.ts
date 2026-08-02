export type AdminRequest = (
  path: string,
  init?: RequestInit,
) => Promise<unknown>;

export type AssignedCard = {
  id: string;
  number: number;
  serial: string;
  createdAt?: string;
};

export type Player = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  createdAt: string;
  cards: AssignedCard[];
  whatsappDeliveries?: Array<{
    id: string;
    status: string;
    updatedAt: string;
    error?: string | null;
  }>;
};

export type CardTemplate = {
  id: string;
  number: number;
  createdAt?: string;
  card?: {
    id: string;
    user: { id: string; name: string };
  } | null;
};

export type PlayerDraft = {
  name: string;
  countryCode: string;
  phoneNumber: string;
  active: boolean;
};

export type Notice = {
  tone: "success" | "warning" | "error";
  message: string;
};
