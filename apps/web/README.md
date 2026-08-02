# Interfaz web de Bingo Virtual

Frontend React + Vite + TypeScript para administración, presentación del sorteo y jugadores.

## Vistas

- `/admin/games`: sorteos y premios.
- `/admin/users`: jugadores y asignación permanente de cartones.
- `/admin/winners`: consulta responsive de ganadores y premios.
- `/admin/whatsapp`: configuración y seguimiento de envíos.
- `/draw`: panel de sorteo a pantalla completa.
- `/player`: cartones del jugador mediante token.

## Criterios de interfaz

- Todos los textos visibles se presentan en español.
- El panel de sorteo cabe sin scroll en 1366×768 y 1920×1080 y muestra hasta 15 balotas por letra.
- El ganador se anuncia una sola vez mediante overlay y permanece resumido al finalizar.
- La vista del jugador mantiene dos cartones por fila en PC y una columna en móvil.
- Las celdas distinguen los estados normal, figura, marcada y marcada dentro de la figura.
- Los módulos administrativos evitan scroll horizontal y adaptan tablas a tarjetas en móvil.

## Comandos

```bash
npm run dev:web
npm run lint --workspace web
npm run build --workspace web
```

La interfaz consume exclusivamente los contratos existentes del backend; no determina balotas ni ganadores.
