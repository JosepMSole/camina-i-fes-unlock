# Camina per UNLOCK (Capacitor Starter)

App demo per la PR1: desbloquejar 5 imatges caminant (500 m per imatge), amb:
- Canvas (mosaic de tiles + placeholder pixelat)
- Geolocation (distància)
- Haptics (vibració)
- Config ⚙️ (mode nit, tile size, vibració, mode demo)
- Persistència (LocalStorage)

## Requisits
- Node.js (LTS recomanat)
- Android Studio + Android Emulator (a Windows)
- JDK instal·lat 

## Instal·lació
```bash
npm install
```

## Executar en web 
```bash
npm run dev
```

## Preparar Android (1a vegada)
```bash
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

> Si ja tens `android/` creat, no cal fer `cap add`.

## Cada cop que canvies el codi
```bash
npm run build
npx cap sync android
```

## Proves a l'emulador (GPS)
A Android Studio:
- Obre l'emulador
- **Extended Controls → Location**
- Defineix punts o una ruta per simular que camines.

## Mode demo
A ⚙️ activa “Mode demo” per sumar metres (+50m / +200m) i provar el desbloqueig sense GPS.

## Imatges
Pròpies i adaptades per a l'app, a un tamany de 1080×1080.


