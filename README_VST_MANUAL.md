# PHASE-X 5042p VST/AU Manual

## Resumen del Proyecto
Este es un procesador de distorsión de fase multibanda construido con Web Audio API. Para utilizarlo como un plugin nativo (.vst3, .au, .aax) en tu DAW (Ableton, FL Studio, Logic Pro, Pro Tools), sigue estos pasos.

## Pasos para la Exportación

### 1. Exportar el Código Fuente
En el editor de AI Studio:
- Dirígete al menú superior derecho (icono de configuración/tres puntos).
- Selecciona **"Export to ZIP"**.
- Esto descargará todo el código fuente de Phase-X (React + Web Audio Engine).

### 2. Uso de un Wrapper (Contenedor VST)
Como este plugin está escrito en TypeScript/JavaScript, necesitas un contenedor que permita ejecutar código web dentro de un plugin nativo. Los estándares de la industria son:

#### Opción A: iPlug2 (Recomendado)
Framework de código abierto que incluye **IPlugWebView**.
- Descarga el SDK de [iPlug2](https://github.com/iPlug2/iPlug2).
- Usa la plantilla `WebView` para cargar el archivo `index.html` generado por este proyecto.
- Compila el proyecto en C++ (Visual Studio para Windows o Xcode para Mac).

#### Opción B: PlugData / HVCC
Si prefieres un enfoque más visual, puedes usar este motor para traducir la lógica a formatos nativos.

#### Opción C: Blue Cat's Plug'n Script
Un plugin que permite cargar scripts de audio directamente.

## Arquitectura Técnica
Phase-X utiliza una arquitectura de **AudioWorklet** para el procesamiento de baja latencia.
- **audioEngine.ts**: Contiene toda la lógica de los algoritmos de distorsión y filtrado.
- **App.tsx**: Controla la interfaz de usuario estilo "Rack".

## Soporte
Este plugin ha sido diseñado para ser agnóstico al sistema operativo siempre que se utilice un contenedor compatible con Chromium/Webview2.
