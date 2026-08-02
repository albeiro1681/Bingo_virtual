# API de Bingo Virtual

Backend NestJS responsable de autenticación, sorteos, cartones, ganadores, WhatsApp y comunicación Socket.IO.

## Responsabilidades

- Proteger todos los endpoints administrativos con `AdminTokenGuard`.
- Mantener el catálogo global de cartones mediante Prisma y PostgreSQL.
- Extraer balotas de forma transaccional y criptográficamente segura.
- Evaluar figuras y cartón completo sin depender del navegador.
- Registrar un único ganador definitivo y conservar el premio histórico.
- Gestionar empates únicamente entre jugadores distintos.
- Publicar actualizaciones en tiempo real y gestionar presencia por jugador único.
- Enviar y reintentar notificaciones oficiales de WhatsApp de forma idempotente.

## Comandos

```bash
npm run start:dev --workspace api
npm test --workspace api
npm run lint --workspace api
npm run build --workspace api
(cd apps/api && npx prisma migrate deploy)
npm run cards:initialize --workspace api
```

## Endpoints relevantes

- `/api/admin/auth`: autenticación administrativa.
- `/api/admin/games`: creación, edición, inicio, finalización y consulta de sorteos.
- `/api/admin/draws`: extracción y desempate.
- `/api/admin/cards`: catálogo y asignación permanente.
- `/api/admin/users`: administración de jugadores.
- `/api/admin/winners`: listado filtrado y detalle de ganadores.
- `/api/admin/whatsapp`: configuración y reintentos.
- `/api/player`: acceso y cartones del jugador.

Los contratos exactos están definidos por los controladores y DTO del código fuente. No se deben almacenar secretos de Meta ni credenciales administrativas en Git.
