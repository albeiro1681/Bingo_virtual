import { BadRequestException } from '@nestjs/common';
import { parseUsersCsvFile } from './users-csv';

function csv(content: string, name = 'jugadores.csv') {
  return { originalname: name, buffer: Buffer.from(content, 'utf8') };
}

describe('parseUsersCsvFile', () => {
  it('reads UTF-8 semicolon CSV and comma-separated cards', () => {
    expect(
      parseUsersCsvFile(
        csv(
          '\uFEFFnombre;celular;cartones\nMaría Gómez;+573001234567;1, 4,15\n',
        ),
      ),
    ).toEqual([
      {
        line: 2,
        name: 'María Gómez',
        phone: '+573001234567',
        cardNumbers: [1, 4, 15],
      },
    ]);
  });

  it.each([
    [undefined, 'Selecciona un archivo CSV.'],
    [csv('nombre;celular;cartones', 'jugadores.txt'), 'extensión .csv'],
    [csv('name;phone;cards\nPedro;3001234567;1'), 'nombre;celular;cartones'],
  ])('rejects invalid input', (file, message) => {
    expect(() => parseUsersCsvFile(file)).toThrow(BadRequestException);
    expect(() => parseUsersCsvFile(file)).toThrow(message);
  });

  it('rejects non UTF-8 content', () => {
    expect(() =>
      parseUsersCsvFile({
        originalname: 'jugadores.csv',
        buffer: Buffer.from([0xff, 0xfe, 0xfd]),
      }),
    ).toThrow('codificación UTF-8');
  });
});
