# Proyecto Bingo Virtual

## Objetivo

Aplicación web de bingo virtual para aproximadamente 50 usuarios concurrentes y 120 cartones.

## Arquitectura acordada

- Frontend: React + Vite + TypeScript
- Backend: NestJS + TypeScript
- Tiempo real: Socket.IO
- Base de datos: PostgreSQL
- ORM: Prisma
- Desarrollo local: WSL 2 + Docker Desktop
- Publicación: Railway
- Base de datos de producción: Neon PostgreSQL
- Producción: un único servicio Node.js que entrega frontend, API REST y Socket.IO

## Vistas

1. Panel administrativo:
   - usuarios
   - generación y asignación de cartones
   - creación e inicio de sorteos
   - consulta de ganadores

2. Panel de sorteo:
   - balotera virtual
   - última balota
   - historial
   - jugadores activos
   - ganadores

3. Vista del jugador:
   - acceso mediante token
   - cartones asignados
   - marcación manual
   - última balota
   - notificación de ganador

## Reglas fundamentales

- El backend es la autoridad del sorteo.
- El navegador no genera balotas.
- El navegador no determina ganadores.
- El backend detecta ganadores aunque el jugador esté desconectado.
- No exponer PostgreSQL públicamente.
- No almacenar secretos en Git.
- Utilizar transacciones para registrar balotas y ganadores.
- No agregar Redis ni microservicios en el MVP.
- Escribir pruebas para las reglas del motor de bingo.
- Antes de cambios grandes, explicar el plan y esperar aprobación.
- No eliminar datos, migraciones ni volúmenes Docker sin aprobación.
