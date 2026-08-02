import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const translations: Record<string, string> = {
  'Admin token is required': 'Se requiere una sesión administrativa',
  'Invalid or expired admin session':
    'La sesión administrativa no es válida o ha expirado',
  'Game not found': 'No se encontró el sorteo',
  'Only draft games can be started':
    'Solo se pueden iniciar sorteos en estado borrador',
  'Only draft games can be edited':
    'Solo se pueden editar sorteos en estado borrador',
  'Another game is already active': 'Ya existe otro sorteo activo',
  'At least one card must be assigned before starting a game':
    'Debe haber al menos un cartón asignado antes de iniciar el sorteo',
  'Only an active game can be finished':
    'Solo se puede finalizar un sorteo activo',
  'Full-card games cannot select a figure':
    'Un sorteo de cartón completo no puede seleccionar una figura',
  'Figure games must select a pattern':
    'Los sorteos por figura deben seleccionar una figura',
  'Active figure not found': 'No se encontró una figura activa',
  'Player not found': 'No se encontró el jugador',
  'Winner not found': 'No se encontró el ganador',
  'Player phone not found': 'El jugador no tiene teléfono registrado',
  'Active player with phone not found':
    'No se encontró un jugador activo con teléfono',
  'Player with phone not found': 'No se encontró un jugador con teléfono',
  'One or more card numbers do not exist':
    'Uno o más números de cartón no existen',
  'One or more cards do not belong to this player':
    'Uno o más cartones no pertenecen a este jugador',
  'One or more card numbers do not exist in the master catalog':
    'Uno o más números de cartón no existen en el catálogo maestro',
  'Assigned cards are permanently locked because a draw has already started':
    'Los cartones asignados están bloqueados porque ya comenzó un sorteo',
  'All balls have already been drawn': 'Ya se extrajeron todas las balotas',
  'Balls can only be drawn for an active game':
    'Solo se pueden extraer balotas de un sorteo activo',
  'This game has no pending tie-break':
    'Este sorteo no tiene un desempate pendiente',
  'Tie-break candidate is not a winner':
    'El cartón candidato al desempate no corresponde a un ganador',
  'A tie-break requires at least two candidate cards':
    'El desempate requiere al menos dos cartones candidatos',
  'The free center cell cannot be part of a figure':
    'La casilla libre central no puede formar parte de una figura',
  'A figure cannot contain duplicate cells':
    'Una figura no puede contener casillas duplicadas',
  'Bad Request': 'Solicitud incorrecta',
  Unauthorized: 'No autorizado',
  'Not Found': 'No encontrado',
  Conflict: 'Conflicto',
};

function translate(message: unknown): string {
  if (typeof message !== 'string')
    return 'No fue posible procesar la solicitud';
  if (translations[message]) return translations[message];
  const fieldLabels: Record<string, string> = {
    name: 'nombre',
    winMode: 'forma de ganar',
    patternId: 'figura',
    phone: 'teléfono',
    cardNumbers: 'números de cartón',
    prizeAmount: 'monto del premio',
    userId: 'jugador',
  };
  const field = (value: string) => fieldLabels[value] ?? value;
  const extra = message.match(/^property (.+) should not exist$/);
  if (extra) return `El campo ${field(extra[1])} no está permitido`;
  const minimum = message.match(
    /^(.+) must be longer than or equal to (\d+) characters$/,
  );
  if (minimum)
    return `El campo ${field(minimum[1])} debe tener al menos ${minimum[2]} caracteres`;
  const enumValues = message.match(
    /^(.+) must be one of the following values: (.+)$/,
  );
  if (enumValues)
    return `El campo ${field(enumValues[1])} debe tener uno de estos valores: ${enumValues[2]}`;
  const assigned = message.match(/^Cards already assigned: (.+)$/);
  if (assigned) return `Cartones ya asignados: ${assigned[1]}`;
  const minimumNumber = message.match(/^(.+) must not be less than (.+)$/);
  if (minimumNumber)
    return `El campo ${field(minimumNumber[1])} debe ser mayor o igual a ${minimumNumber[2]}`;
  const integer = message.match(/^(.+) must be an integer number$/);
  if (integer) return `El campo ${field(integer[1])} debe ser un número entero`;
  return message;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const incidentId = randomUUID();
    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttp ? exception.getResponse() : undefined;
    const source =
      typeof payload === 'string'
        ? payload
        : payload && typeof payload === 'object' && 'message' in payload
          ? (payload as { message?: unknown }).message
          : undefined;
    const messages = Array.isArray(source)
      ? source.map(translate)
      : [
          isHttp
            ? translate(source ?? exception.message)
            : 'Ocurrió un error interno. Intenta nuevamente.',
        ];

    response.setHeader('X-Incident-Id', incidentId);
    if (status === Number(HttpStatus.TOO_MANY_REQUESTS))
      response.setHeader('Retry-After', '900');
    response.status(status).json({
      statusCode: status,
      message: messages.length === 1 ? messages[0] : messages,
      incidentId,
      path: request.originalUrl,
    });

    if (!isHttp) {
      console.error(
        `[${incidentId}] ${request.method} ${request.originalUrl}`,
        exception,
      );
    }
  }
}
