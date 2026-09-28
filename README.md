# Netteleco Todoist

Aplicación de tareas (To-Do) organizable por proyectos, colores y fechas límite.

Este proyecto es un ejercicio práctico de mi curso de **Claude Code**: sirve para aprender a usar Claude Code como asistente de desarrollo en un proyecto real, desde cero hasta una app funcional.

## Qué hace

- Crear proyectos con nombre y color propio
- Añadir tareas asignadas a un proyecto, con fecha límite y prioridad (alta/media/baja)
- Marcar tareas como completadas
- Vistas rápidas: Todas las tareas, Hoy, Vencidas
- Ordenar por fecha límite, prioridad o fecha de creación
- Guardado automático en el navegador (localStorage), sin necesidad de servidor ni base de datos

## Tecnología

HTML, CSS y JavaScript "vanilla" (sin frameworks ni build step), pensado para que cargue y funcione al instante en cualquier navegador.

## Cómo ejecutarlo

Solo hay que abrir `index.html` en el navegador, o servir la carpeta con cualquier servidor estático, por ejemplo:

```bash
python3 -m http.server 8000
```

Y luego visitar `http://localhost:8000`.

## Estructura

- `index.html` — estructura de la página
- `style.css` — estilos
- `app.js` — lógica de la aplicación (estado, renderizado, eventos)
