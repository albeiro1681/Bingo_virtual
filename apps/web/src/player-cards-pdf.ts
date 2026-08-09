import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const CARDS_PER_PDF_PAGE = 4;

type PdfCell = {
  row: number;
  column: number;
  number: number | null;
  isFree: boolean;
};

export type PrintablePlayerCard = {
  number?: number | null;
  serial: string;
  cells: PdfCell[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 24;
const GAP = 14;
const CARD_WIDTH = (PAGE_WIDTH - MARGIN * 2 - GAP) / 2;
const CARD_HEIGHT = (PAGE_HEIGHT - MARGIN * 2 - GAP) / 2;
const GREEN = rgb(0.09, 0.42, 0.33);
const LIGHT_GREEN = rgb(0.91, 0.96, 0.94);
const BORDER = rgb(0.55, 0.68, 0.63);
const TEXT = rgb(0.06, 0.14, 0.12);

function printableText(value: string): string {
  return value.replace(/[^\u0020-\u00ff]/g, "?");
}

export function playerCardsPdfFilename(playerName: string): string {
  const slug = playerName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `cartones-fecsupol-${slug || "jugador"}.pdf`;
}

export async function createPlayerCardsPdf(input: {
  playerName: string;
  cards: PrintablePlayerCard[];
}): Promise<Uint8Array> {
  if (input.cards.length === 0)
    throw new Error("No hay cartones asignados para generar el PDF.");

  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const cards = [...input.cards].sort(
    (first, second) => (first.number ?? 0) - (second.number ?? 0),
  );

  cards.forEach((card, index) => {
    const position = index % CARDS_PER_PDF_PAGE;
    const page =
      position === 0 ? document.addPage([PAGE_WIDTH, PAGE_HEIGHT]) : document.getPages().at(-1)!;
    const column = position % 2;
    const row = Math.floor(position / 2);
    const x = MARGIN + column * (CARD_WIDTH + GAP);
    const y = PAGE_HEIGHT - MARGIN - CARD_HEIGHT - row * (CARD_HEIGHT + GAP);

    page.drawRectangle({ x, y, width: CARD_WIDTH, height: CARD_HEIGHT, borderColor: BORDER, borderWidth: 1.2 });
    page.drawRectangle({ x, y: y + CARD_HEIGHT - 58, width: CARD_WIDTH, height: 58, color: LIGHT_GREEN });
    page.drawText("FECSUPOL", { x: x + 14, y: y + CARD_HEIGHT - 22, size: 12, font: bold, color: GREEN });
    page.drawText(`Cartón #${card.number ?? "—"}`, { x: x + 14, y: y + CARD_HEIGHT - 43, size: 16, font: bold, color: TEXT });
    page.drawText(printableText(input.playerName), { x: x + 14, y: y + CARD_HEIGHT - 55, size: 8, font: regular, color: TEXT, maxWidth: CARD_WIDTH - 28 });
    page.drawText(card.serial, { x: x + CARD_WIDTH - 84, y: y + CARD_HEIGHT - 20, size: 7, font: regular, color: TEXT });

    const gridX = x + 14;
    const gridWidth = CARD_WIDTH - 28;
    const cellSize = gridWidth / 5;
    const gridY = y + 38;
    const letters = ["B", "I", "N", "G", "O"];
    letters.forEach((letter, cellColumn) => {
      const letterWidth = bold.widthOfTextAtSize(letter, 13);
      page.drawText(letter, {
        x: gridX + cellColumn * cellSize + (cellSize - letterWidth) / 2,
        y: gridY + cellSize * 5 + 9,
        size: 13,
        font: bold,
        color: GREEN,
      });
    });

    for (let cellRow = 0; cellRow < 5; cellRow += 1) {
      for (let cellColumn = 0; cellColumn < 5; cellColumn += 1) {
        const cell = card.cells.find(
          (candidate) => candidate.row === cellRow && candidate.column === cellColumn,
        );
        const cellX = gridX + cellColumn * cellSize;
        const cellY = gridY + (4 - cellRow) * cellSize;
        page.drawRectangle({
          x: cellX,
          y: cellY,
          width: cellSize,
          height: cellSize,
          color: cell?.isFree ? GREEN : undefined,
          borderColor: BORDER,
          borderWidth: 0.8,
        });
        const label = cell?.isFree ? "LIBRE" : String(cell?.number ?? "");
        const font = cell?.isFree ? bold : regular;
        const size = cell?.isFree ? 7 : 12;
        const labelWidth = font.widthOfTextAtSize(label, size);
        page.drawText(label, {
          x: cellX + (cellSize - labelWidth) / 2,
          y: cellY + (cellSize - size) / 2 + 2,
          size,
          font,
          color: cell?.isFree ? rgb(1, 1, 1) : TEXT,
        });
      }
    }
    page.drawText("Cartón personal e intransferible", { x: x + 14, y: y + 15, size: 7, font: regular, color: GREEN });
  });

  document.setTitle(`Cartones de ${printableText(input.playerName)}`);
  document.setAuthor("FECSUPOL");
  document.setSubject("Cartones de Bingo Virtual");
  return document.save();
}
