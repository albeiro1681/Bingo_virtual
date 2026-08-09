export type WinnerRecord = {
  id: string;
  prizeAmount?: string | null;
  currencyCode: string;
  winningBallNumber?: number | null;
  detectedAt: string;
  type: string;
  game: {
    id: string;
    name: string;
    startedAt?: string | null;
    finishedAt?: string | null;
    patternName?: string | null;
    winningType?: string;
  };
  player: { id: string; name: string; phone?: string | null };
  card: { id: string; number: number; serial: string };
};

export type WinnersResponse = {
  items: WinnerRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
  summary: {
    totalWinners: number;
    totalPrizeAmount?: string | null;
    gamesWithWinner: number;
  };
};
