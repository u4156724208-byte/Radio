
# Blackout - Solo /party - Versione Finale Verificata

## Cosa fixa:
1. DUPLICATI: cancella tutti i comandi globali e di gilda, registra solo /party x1
2. AUDIO MUTO: rimette ffmpeg-static + opus (necessari per audio)
3. "The operation was aborted": fix con destroy vecchia connessione + attesa 20s READY + gestione disconnect Render

## Deploy su Render:
- Build Command: npm install
- Start Command: node index.js
- Env: TOKEN=il tuo token
- Node version: 18 o superiore (impostato in package.json)

## Dopo deploy:
1. Logs devono dire: [CLEAN] FINITO - Ora esiste SOLO /party x1
2. Su Discord: CTRL+R per svuotare cache
3. Entra in vocale > /party

Se vedi ancora 2 volte /party, hai 2 bot accesi (Discloud + Render). Spegni Discloud.
