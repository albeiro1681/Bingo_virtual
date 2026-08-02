export type ParsedCsvPlayer = {
  line: number;
  name: string;
  phone: string;
  cardNumbers: number[];
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ";" && !quoted) {
      fields.push(field.trim());
      field = "";
    } else field += character;
  }
  fields.push(field.trim());
  return fields;
}

export function parseUsersCsv(content: string): ParsedCsvPlayer[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = parseCsvLine(lines[0] ?? "").map((value) =>
    value.toLocaleLowerCase("es"),
  );
  if (header.join(";") !== "nombre;celular;cartones")
    throw new Error("El encabezado debe ser: nombre;celular;cartones");
  return lines
    .slice(1)
    .map((line, index) => ({ line, lineNumber: index + 2 }))
    .filter(({ line }) => line.trim())
    .map(({ line, lineNumber }) => {
      const fields = parseCsvLine(line);
      if (fields.length !== 3)
        throw new Error(
          `La fila ${lineNumber} debe tener exactamente tres columnas.`,
        );
      return {
        line: lineNumber,
        name: fields[0].trim().replace(/\s+/g, " "),
        phone: fields[1].trim(),
        cardNumbers: fields[2]
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => (/^\d+$/.test(value) ? Number(value) : 0)),
      };
    });
}

export function downloadCsv(name: string, content: string) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadUsersTemplate() {
  downloadCsv(
    "plantilla-jugadores.csv",
    "nombre;celular;cartones\nPedro Pérez;3001234567;1,4,15\n",
  );
}
