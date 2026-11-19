# Guitar Tab Trainer — Requisiti

## Obiettivo

Ambiente modulare per studiare parti di chitarra attraverso tablatura,
playback, visualizzazione del manico e propria esecuzione sullo strumento.
Lo sviluppo assistito da agenti IA mantiene supervisione umana sulle scelte
architetturali e sulla validazione. [Roadmap](../TODO.md)

## M0–M4 — Funzionalità disponibili

- Apertura di GP locali, metadati, notazione/tablatura, zoom e gestione errori.
- Playback sintetizzato con trasporto, velocità e loop A/B.
- Mixer, visibilità indipendente delle parti e reset tracce.
- Posizione coerente fra playback, timeline e score anche dopo seek da fermo.
- Recupero del GP corrente e delle impostazioni dopo refresh, senza autoplay.
- Fretboard per la traccia selezionata, note e articolazioni rappresentate
  con simboli, collegamenti e avanzamento.
- UI responsive EN/IT, temi e pannelli collassabili.

M4 è funzionalmente completata e resta soggetta a rifiniture e verifiche manuali.
Copertura e limiti effettivi sono in [M4_PLAYBACK.md](M4_PLAYBACK.md).

## M5 — Guitar Capture & Play Session

- Selezionare un intervallo di battute e creare una sessione di lavoro
  con l'accompagnamento originale.
- Permettere il playback da una posizione precedente al segmento scelto.
- Registrare la chitarra reale limitando la registrazione all'intervallo.
- Convertire l'audio acquisito in eventi musicali e tablatura.
- Usare un motore Audio → MIDI sostituibile, valutando Hendrix come primo candidato.
- Verificare e correggere le note attraverso la fretboard.
- Mantenere separate frase originale e varianti.

Il lavoro procederà per incrementi. Target di acquisizione, allineamento
temporale, qualità della conversione e modalità di correzione richiedono
analisi e prove prima di stabilizzare i contratti.

## M6 — Storage & Projects

Progettare la gestione persistente di brani, sessioni di lavoro,
registrazioni e varianti. La tecnologia di storage resta aperta.
Il recupero corrente IndexedDB M4 mantiene il proprio perimetro limitato.

## Vincoli trasversali

- Uso locale/offline, con requisiti dei candidati esterni da verificare.
- Conservazione dei file GP originali e separazione delle varianti.
- Core indipendente da UI e runtime, alphaTab attraverso API pubbliche.
- Processing audio indipendente dai componenti UI.
- Moduli piccoli, test mirati e nuove dipendenze motivate.
- Sviluppo Debian WSL2. Runtime browser attuale, target Windows e packaging
  desktop da valutare quando necessari.

## Esigenze future da rivalutare

Backing audio locali separati, sync point, time stretching/pitch shifting,
monitoring avanzato, ASIO, virtual rig e VST3 rimangono esigenze possibili.
La loro priorità verrà stabilita rispetto ai flussi M5/M6.
La vecchia sequenza obbligata audio esterno → backing sincronizzata è
conservata nello [storico](HISTORY.md).
