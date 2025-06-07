
---
title: Reel Creator AI
emoji: 🤖
colorFrom: cyan
colorTo: blue
sdk: static
sdk_version: 1
static_build_command: "if [ -f yarn.lock ]; then yarn install && yarn build; elif [ -f package-lock.json ] || [ -f package.json ]; then npm install && npm run build; else echo 'No lock file found, skipping build command'; fi"
static_output_dir: dist
app_file: index.html
pinned: false
---

# Reel Creator AI

Bienvenido a Reel Creator AI, tu asistente para crear Reels virales.

Esta aplicación te ayuda a:
- Generar ideas para Reels.
- Estructurar tus Reels de forma efectiva.
- Utilizar fórmulas probadas para maximizar el impacto.
- Guardar tus sesiones de chat para referencia futura.

## Despliegue en Hugging Face Spaces

Este repositorio está configurado para desplegarse como una aplicación estática en Hugging Face Spaces.

**Secrets requeridos:**
- `API_KEY`: Tu clave API de Google Gemini. Esta se inyecta durante el proceso de build.

El comando de build (`npm run build` o `yarn build`) se ejecutará automáticamente por Hugging Face, y los archivos resultantes en la carpeta `dist/` serán servidos.
