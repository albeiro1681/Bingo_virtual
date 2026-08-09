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

export type CsvImportRow = {
  line: number;
  name: string;
  phone: string | null;
  cardNumbers: number[];
  valid: boolean;
  errors: Array<{ code: string; message: string }>;
};

export type CsvImportPreview = {
  validRows: CsvImportRow[];
  invalidRows: CsvImportRow[];
  rows: CsvImportRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    validUsers: number;
    invalidUsers: number;
    cardsToAssign: number;
  };
};

export type BulkSendResult = {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  results: Array<{
    userId: string;
    name?: string;
    status: "SENT" | "FAILED" | "SKIPPED";
    reason?: string;
  }>;
};
