import { BadRequestException } from '@nestjs/common';
import type { ImportPlayerRowDto } from './dto/import-players.dto';

export type UploadedCsvFile = {
  originalname: string;
  buffer: Buffer;
};

function parseLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ';' && !quoted) {
      values.push(value.trim());
      value = '';
    } else value += character;
  }
  if (quoted)
    throw new BadRequestException('El archivo contiene comillas sin cerrar.');
  values.push(value.trim());
  return values;
}

export function parseUsersCsvFile(
  file?: UploadedCsvFile,
): ImportPlayerRowDto[] {
  if (!file) throw new BadRequestException('Selecciona un archivo CSV.');
  if (!file.originalname.toLocaleLowerCase('es').endsWith('.csv'))
    throw new BadRequestException('El archivo debe tener extensión .csv.');

  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
  } catch {
    throw new BadRequestException('El archivo debe usar codificación UTF-8.');
  }
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  const header = parseLine(lines[0] ?? '').map((value) =>
    value.toLocaleLowerCase('es'),
  );
  if (header.join(';') !== 'nombre;celular;cartones')
    throw new BadRequestException(
      'El encabezado debe ser: nombre;celular;cartones',
    );

  const rows = lines
    .slice(1)
    .map((line, index) => ({ content: line, line: index + 2 }))
    .filter((row) => row.content.trim())
    .map((row) => {
      const fields = parseLine(row.content);
      if (fields.length !== 3)
        throw new BadRequestException(
          `La fila ${row.line} debe tener exactamente tres columnas.`,
        );
      return {
        line: row.line,
        name: fields[0].trim().replace(/\s+/g, ' '),
        phone: fields[1].trim(),
        cardNumbers: fields[2]
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => (/^\d+$/.test(value) ? Number(value) : 0)),
      };
    });
  if (!rows.length)
    throw new BadRequestException('El archivo no contiene jugadores.');
  return rows;
}
