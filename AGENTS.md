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
- Después de seleccionar los números de cada columna, sus posiciones deben mezclarse; no deben ordenarse ascendente ni descendentemente. Los catálogos ya persistidos no se regeneran implícitamente.
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
- La extracción de balotas y la elección del desempate deben utilizar una selección uniforme basada en `crypto.randomInt()`.
- El teléfono es obligatorio para jugadores y se almacena en formato internacional E.164.
- La administración de Usuarios permite importar jugadores desde CSV UTF-8 separado por punto y coma con las columnas `nombre;celular;cartones`; la vista previa se envía por `multipart/form-data` en el campo `file`, no guarda datos y muestra errores por fila antes de confirmar.
- En la importación, los celulares colombianos de 10 dígitos o con prefijo 57 se normalizan a `+57` y se rechazan números que no tengan 10 dígitos nacionales o no comiencen por 3.
- La importación valida duplicados de celular, cartones repetidos, inexistentes u ocupados; cada jugador y todos sus cartones se guardan en una transacción independiente.
- La tabla de Usuarios permite seleccionar registros visibles o todos los resultados filtrados y enviar enlaces de acceso por WhatsApp en lote, conservando resultados individuales de enviados, fallidos y omitidos.
- Al asignar cartones se envía por WhatsApp un enlace que contiene el token de acceso del jugador.
- La vista del jugador consume el token del enlace, lo guarda en la sesión y limpia la URL inmediatamente.
- Al detectar ganadores se notifica por WhatsApp al ganador y al canal configurado de FECSUPOL.
- Utilizar exclusivamente WhatsApp Cloud API oficial; no automatizar WhatsApp Web ni usar clientes no oficiales.
- El envío a grupos depende de la elegibilidad de la cuenta de Meta; debe existir un modo alternativo de notificación individual a responsables.
- Los fallos de WhatsApp no deben revertir ni bloquear el resultado del sorteo.
- Registrar entregas y reintentos de WhatsApp de forma idempotente y no almacenar credenciales de Meta en Git.
- Si una jugada produce más de un ganador, el sorteo debe pasar automáticamente a estado de desempate y conservar los cartones candidatos.
- El desempate solo procede si los cartones ganadores pertenecen a jugadores diferentes, comparados por `userId`; varios cartones de un mismo jugador producen un único ganador, un único premio y ningún desempate.
- Cuando participan varios jugadores en un empate, cada jugador debe tener una sola candidatura, aunque posea más de un cartón ganador.
- Durante un empate, el panel administrativo debe mostrar “BINGO — EMPATE”, los números de los cartones empatados y una balotera exclusiva de desempate.
- Mientras el sorteo esté en `TIE_BREAK`, el panel de presentación debe priorizar el desempate, compactar temporalmente el histórico, mantener visibles los participantes y el botón `Desempatar` dentro de 1366x768 y restaurar automáticamente la distribución normal al finalizar.
- El administrador debe iniciar el desempate explícitamente mediante el botón “Desempatar”; únicamente participan los números de los cartones empatados y el backend elige un solo ganador al azar.
- Los jugadores empatados reciben el aviso de empate dentro de la aplicación; el ganador definitivo recibe la notificación en la aplicación y por WhatsApp, sin que un fallo de WhatsApp altere el resultado.
- La administración debe estar separada en paneles de Sorteos, Usuarios, WhatsApp y Panel de sorteo.
- Cada sorteo nuevo debe registrar un monto de premio positivo en COP; solo puede editarse antes de iniciar y los sorteos históricos pueden conservar premio nulo.
- El registro del ganador conserva una copia histórica del premio, jugador, cartón, balota ganadora y fecha de confirmación.
- El panel administrativo de Ganadores permite buscar, filtrar, ordenar, paginar y abrir el detalle sin modificar el registro histórico.
- La sesión administrativa dura 12 horas, se invalida al cerrar sesión y todos los endpoints administrativos y conexiones en tiempo real validan una sesión vigente con rol ADMIN.
- Debe ser posible crear sorteos en borrador mientras otro sorteo está activo o en desempate; el botón para iniciar permanece deshabilitado hasta que no exista otro sorteo bloqueante.
- Todos los estados, validaciones y mensajes visibles deben presentarse en español, tanto en el panel administrativo como en la vista del jugador.
- La tabla administrativa de sorteos debe mostrar completas sus columnas y acciones, sin recortar los botones.
- En escritorio, la vista del jugador conserva dos cartones por fila aunque aumente el historial de balotas; en pantallas pequeñas se adapta a una columna sin desbordamiento horizontal.
- El historial del panel de sorteo debe organizar las balotas en cinco columnas B-I-N-G-O junto a la balotera y la figura objetivo, con capacidad para los 15 números de cada letra.
- El Panel de sorteo abre en una pestaña nueva reutilizando de forma segura la sesión vigente, elige el sorteo activo o el más reciente y no muestra navegación administrativa.
- El historial B-I-N-G-O muestra primero la balota más reciente de cada letra y ajusta tamaño y separación para mantener visibles las 15 balotas sin scroll interno.
- Al confirmar un ganador definitivo se muestra una sola vez un overlay con nombre, cartón y premio; luego el ganador permanece en un resumen compacto.
- El panel de sorteo muestra por separado la cantidad de cartones jugando y la cantidad de jugadores conectados, contando una sola vez a cada jugador.
- En los cartones del jugador deben distinguirse visualmente celda normal, figura objetivo, marcada y marcada dentro de la figura, sin depender únicamente del color.
- Las asignaciones iniciales o posteriores deben aparecer automáticamente en la vista privada del jugador sin recargar ni regenerar su enlace de acceso.
- La vista privada del jugador debe permitir descargar en un único PDF todos sus cartones asignados, ordenados por número y con un máximo de cuatro cartones por hoja.
- Si todavía no existe ningún sorteo, la vista privada debe mostrar en la parte superior “Aún no hay sorteo” y presentar completos los cartones asignados, con sus encabezados B-I-N-G-O, 24 números y centro libre; la marcación manual permanece asociada a un sorteo.
- Los errores HTTP deben usar códigos apropiados, mensajes en español y un identificador de incidente; los errores internos no deben exponer detalles sensibles.
- Después de cinco intentos administrativos fallidos se bloquean nuevos intentos durante 15 minutos; la respuesta debe indicar el tiempo de reintento.
- Las operaciones de edición de jugador y cartones deben ser atómicas, y los formularios deben impedir envíos duplicados mientras una operación está en curso.
- El fallo de una fuente de datos administrativa no debe impedir que las demás secciones disponibles se carguen y sigan siendo utilizables.
- Las entregas de WhatsApp pendientes o fallidas deben poder reintentarse desde la administración; si WhatsApp no está configurado debe mostrarse un error claro sin revertir datos ya guardados.
- La interfaz debe avisar cuando se pierda la conexión en tiempo real y debe intentar reconectarse automáticamente.
