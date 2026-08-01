# Proyecto Bingo Virtual

## Objetivo

Aplicación web de bingo virtual para aproximadamente 50 usuarios concurrentes y 130 cartones.

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

## Requisitos funcionales actualizados

- La organización propietaria de la aplicación es el Fondo de Empleados FECSUPOL.
- Debe existir un catálogo global e inmutable de 130 cartones maestros, numerados del 1 al 130.
- El catálogo maestro se genera una sola vez mediante una acción administrativa explícita y se conserva en PostgreSQL; reiniciar la aplicación no debe regenerarlo.
- La generación del catálogo debe ser pseudoaleatoria, reproducible y globalmente balanceada por columna B-I-N-G-O.
- En las columnas B, I, G y O cada número debe aparecer 43 o 44 veces en el catálogo completo; en N debe aparecer 34 o 35 veces debido al centro libre.
- Dentro de cada columna la diferencia entre la frecuencia mínima y máxima de sus números no puede superar una aparición.
- Cada cartón debe contener 24 números, respetar los rangos B-I-N-G-O, no repetir números y ser diferente de los demás cartones maestros.
- Cada cartón se asigna globalmente a un único jugador y conserva ese propietario para todos los sorteos presentes y futuros.
- El administrador asigna los números de cartón escogidos por el comprador y no genera cartones nuevos durante la venta.
- Un número de cartón no puede asignarse a más de un jugador ni cambiarse entre sorteos.
- La asignación se realiza antes de iniciar un sorteo y no depende de la creación de sorteos.
- Un sorteo activo puede terminarse anticipadamente desde el panel administrativo mediante una acción con confirmación; después no se pueden extraer más balotas.
- Un sorteo puede ganarse llenando el cartón o completando una figura 5x5 programada por el administrador.
- Las figuras se evalúan exactamente en las coordenadas y orientación guardadas; no se aceptan rotaciones, reflejos ni desplazamientos.
- Números sorteados fuera de la figura no invalidan un ganador.
- La extracción debe presentarse como una balotera animada, pero la balota definitiva siempre la determina el backend.
- El teléfono es obligatorio para jugadores y se almacena en formato internacional E.164.
- Al asignar cartones se envía por WhatsApp un enlace que contiene el token de acceso del jugador.
- La vista del jugador consume el token del enlace, lo guarda en la sesión y limpia la URL inmediatamente.
- Al detectar ganadores se notifica por WhatsApp al ganador y al canal configurado de FECSUPOL.
- Utilizar exclusivamente WhatsApp Cloud API oficial; no automatizar WhatsApp Web ni usar clientes no oficiales.
- El envío a grupos depende de la elegibilidad de la cuenta de Meta; debe existir un modo alternativo de notificación individual a responsables.
- Los fallos de WhatsApp no deben revertir ni bloquear el resultado del sorteo.
- Registrar entregas y reintentos de WhatsApp de forma idempotente y no almacenar credenciales de Meta en Git.
