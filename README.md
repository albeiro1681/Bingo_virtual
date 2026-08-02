# Bingo Virtual FECSUPOL

Aplicación web de bingo para FECSUPOL, preparada para aproximadamente 50 jugadores concurrentes y un catálogo global de 130 cartones.

## Arquitectura

- Frontend: React, Vite y TypeScript.
- Backend: NestJS y TypeScript.
- Tiempo real: Socket.IO.
- Persistencia: PostgreSQL con Prisma.
- Producción: un servicio Node.js sirve frontend, API REST y Socket.IO.
- Despliegue previsto: Railway con Neon PostgreSQL.

## Módulos

- Administración de sorteos, usuarios, WhatsApp y ganadores.
- Importación de jugadores mediante CSV y envío masivo de enlaces de acceso.
- Panel de sorteo a pantalla completa.
- Vista del jugador mediante token de acceso.
- Catálogo inmutable y balanceado de 130 cartones maestros.
- Notificaciones idempotentes mediante WhatsApp Cloud API.

## Reglas principales

- El backend extrae las balotas con `crypto.randomInt()` y es la autoridad del sorteo y de los ganadores.
- Los cartones respetan los rangos B-I-N-G-O, tienen centro libre y posiciones internas mezcladas.
- El catálogo se inicializa explícitamente una sola vez; una asignación copia un cartón maestro existente y no lo regenera.
- Cada sorteo nuevo requiere un premio positivo en COP. El ganador conserva una copia histórica del monto ganado.
- Si varios cartones ganadores pertenecen al mismo jugador, se registra un solo ganador y un solo premio.
- El desempate se activa únicamente cuando existen jugadores ganadores diferentes y ofrece una candidatura por jugador.
- Durante el desempate, la presentación compacta el histórico para mantener visibles los participantes y controles; al confirmar el ganador recupera automáticamente la distribución normal.
- Los fallos de WhatsApp nunca revierten ni bloquean el resultado del sorteo.

El detalle completo de arquitectura y requisitos está en [AGENTS.md](./AGENTS.md).

## Configuración local

Requisitos: Node.js 24 o posterior, Docker Desktop/Compose y PostgreSQL.

```bash
cp .env.example .env
npm install
docker compose up -d
(cd apps/api && npx prisma migrate deploy)
npm run cards:initialize --workspace api
```

Para desarrollo, ejecutar en terminales separadas:

```bash
npm run dev:api
npm run dev:web
```

Para compilar y ejecutar como producción local:

```bash
npm run build
npm start
```

## Validaciones

```bash
npm run lint
npm test
npm run build
```

## Seguridad

- No se deben versionar `.env`, credenciales, tokens ni evidencias locales.
- Los endpoints administrativos y Socket.IO validan una sesión administrativa vigente.
- Los tokens de jugadores y administradores se guardan en la sesión del navegador y no se incluyen en URLs administrativas.
- PostgreSQL se publica localmente solo en `127.0.0.1` y no debe exponerse en producción.
