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

## Despliegue en Railway con Neon

1. Cree el proyecto PostgreSQL en Neon y copie las cadenas de conexión pooled y
   directa con SSL. Use la directa para migraciones si Neon ofrece ambas.
2. Configure en Railway `DATABASE_URL`, `DATABASE_DIRECT_URL`,
   `APP_ENCRYPTION_KEY` y
   `PUBLIC_APP_URL`. Esta última debe ser la URL HTTPS definitiva del servicio,
   sin una ruta al final; será la base de todos los enlaces de acceso enviados a
   jugadores.
3. Configure las variables `WHATSAPP_*` únicamente cuando la cuenta oficial de
   WhatsApp Cloud API esté lista. No incluya secretos en el repositorio.
4. Railway compilará con Railpack, aplicará las migraciones como paso previo al
   despliegue y arrancará el único servicio Node.js mediante `railway.json`.
5. Después del primer despliegue, cree el administrador e inicialice el catálogo
   de 130 cartones mediante tareas administrativas explícitas si la base de Neon
   está vacía. No ejecute la inicialización del catálogo en cada arranque.

Variables obligatorias en producción:

```text
DATABASE_URL=postgresql://...-pooler.neon.tech/...?...sslmode=require&channel_binding=require
DATABASE_DIRECT_URL=postgresql://...neon.tech/...?...sslmode=require&channel_binding=require
APP_ENCRYPTION_KEY=<secreto estable de al menos 32 caracteres>
PUBLIC_APP_URL=https://<dominio-definitivo>
```

`DATABASE_DIRECT_URL` es opcional: si no se configura, Prisma Migrate reutiliza
`DATABASE_URL`. Railway ejecuta `npm run prisma:migrate:deploy --workspace api`
antes de activar la nueva versión y luego inicia la API con `npm start`. El
endpoint `/api/health` solo responde correctamente cuando la API puede consultar
PostgreSQL.

### Inicialización única de producción

Después de que el primer despliegue esté saludable, agregue temporalmente estas
variables al servicio de Railway:

```text
ADMIN_NAME=<nombre visible>
ADMIN_USERNAME=<usuario administrativo>
ADMIN_PASSWORD=<contraseña inicial de al menos 10 caracteres>
```

Ejecute una sola vez, desde una shell o tarea del servicio que tenga las mismas
variables de producción:

```bash
npm run admin:create --workspace api
npm run cards:initialize --workspace api
```

El primer comando falla de forma segura si ya existe un administrador y el
segundo es idempotente: conserva el catálogo existente. Al terminar, elimine
inmediatamente `ADMIN_PASSWORD` de las variables de Railway; `ADMIN_NAME` y
`ADMIN_USERNAME` también pueden retirarse porque la aplicación no los necesita
para arrancar.

### Comprobación posterior al despliegue

- Confirme que `GET /api/health` devuelve `status: ok` y
  `database: connected`.
- Inicie sesión como administrador y confirme que existen exactamente 130
  cartones maestros.
- Abra el Panel de sorteo en una pestaña nueva y compruebe la conexión en tiempo
  real, sin iniciar ni modificar un sorteo real.
- Compruebe la vista del jugador con una cuenta de prueba autorizada antes de
  enviar enlaces reales por WhatsApp.
- Configure `WHATSAPP_*` y realice envíos solamente cuando la cuenta oficial de
  Meta y los destinatarios de prueba estén autorizados.

## Validaciones

La vista privada del jugador muestra sus cartones completos desde la asignación,
aunque todavía no exista un sorteo, y permite descargarlos en un único PDF con
un máximo de cuatro cartones por página. Las asignaciones posteriores se
actualizan sin cambiar el enlace de acceso.

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
