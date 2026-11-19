# Guitar Tab Trainer — Storico essenziale

Questo documento conserva decisioni e risultati delle fasi concluse.
La roadmap attiva è in [TODO.md](../TODO.md).

## M0–M3 — Completate

| Milestone | Risultato e decisioni conservate |
|---|---|
| M0 | Approvati monorepo pnpm, UI Angular, core TypeScript e adapter alphaTab. Dipendenze orientate verso contratti e libreria trattata come black box. |
| M1 | Workspace operativo, export pubblici dei pacchetti compilati, build/typecheck e controllo dei confini. Smoke test Chromium passato. |
| M2 | Contratto di caricamento sui byte, lettura asincrona indipendente dal filesystem, snapshot e codici errore. Una richiesta alla volta, copia difensiva e scarto dei risultati tardivi. Nove test core passati. |
| M3 | Importazione e rendering di GP locali tramite API pubbliche alphaTab 1.9.0. Asset font locali, cleanup e recupero dopo errori. Ventidue test Node e tre scenari Chromium passati. |

Decisioni tecniche ancora utili

- Core compilabile senza Angular, DOM o alphaTab.
- Rendering browser nel dedicato adapter, inizialmente con player disabilitato.
- Rendering sul main thread per il prototipo. Worker di rendering e prestazioni
  su partiture grandi rimasti da valutare.
- angular.json alla root configura l'app web. I pacchetti TypeScript usano tsc.
- Prebundling del dev server disabilitato per la risoluzione delle dipendenze pnpm.
- ESNext.Disposable abilitato nella compilazione dell'adapter, preservando
  tipi pubblici di presentazione indipendenti dalla libreria.
- Byte originali preservati e corpus GP3/GP5/GP7 con provenienza, hash e licenze.
- Risorse servite localmente. L'offline provato richiede un server locale.

Rinomina Guitar Tab Trainer, localizzazione EN/IT e shell modulare sono
state completate prima del playback. Lingua/tema persistiti in localStorage,
viewer mantenuto montato durante la navigazione, temi System/Light/Dark
e layout responsive. Risultati registrati per fasi successive

| Fase | Node | Chromium |
|---|---:|---:|
| Localizzazione | 35 passati | 14 passati |
| Shell UI | 45 passati | 21 passati |
| Prima implementazione playback M4 | 57 passati | 27 passati, più 6 scenari su server dev isolato |
| Mixer/UI, 16 novembre 2026 | 66 passati | 30 passati e 4 falliti su 34 |

Questi conteggi appartengono a revisioni diverse. I risultati successivi
e i debiti ancora aperti sono in [M4_PLAYBACK.md](M4_PLAYBACK.md).

## Evoluzione M4

Il player integrato alphaTab 1.9.0 è stato scelto come riferimento temporale
della singola sorgente sintetizzata. Sono seguiti mixer, cursori visibili,
seek bidirezionale e recupero della sessione corrente. L'utente ha approvato
una copia dell'ultimo GP in IndexedDB, mantenendo aperta la futura decisione
sullo storage dei progetti.

Le successive rifiniture hanno introdotto cartelle dedicate ai componenti,
controlli di visibilità/reset, dettagli del brano nella sidebar e fretboard.
La fretboard è evoluta da marker delle note attive a nomi delle note,
riferimenti del manico, simboli degli effetti e anteprime con avanzamento
di slide, bending/release e H/P. Il GP5 dell'utente ha evidenziato l'assenza
iniziale di H/P, poi aggiunti tramite i collegamenti pubblici alphaTab.
L'utente ha confermato il risultato nel browser.

## Pianificazione M5–M6 precedente, superata

La precedente M5 proponeva un prototipo audio esterno con trasporto condiviso.
La precedente M6 prevedeva la backing track sincronizzata. Il confronto
PCM del synth alphaTab, generazione MIDI con synth esterno e prerendering
era stato pianificato, senza scelta o implementazione di un percorso.

Restano utili i criteri tecnici emersi

- Distinguere posizione nella notazione, occorrenza eseguita, tempo del media
  e campioni audio.
- Unica autorità temporale e comportamento esplicito di seek, loop e velocità.
- Misurare offset iniziale, drift e discontinuità con configurazioni e soglie
  concordate quando il flusso richiede più sorgenti.
- Verificare API effettivamente pubbliche della release installata.
- La sintesi integrata e i suoi eventi non certificano scheduling sample-accurate.
- La sintesi e una backing audio separata richiedono una verifica d'integrazione.

Queste informazioni costituiscono contesto per le analisi audio necessarie
alla nuova M5 Guitar Capture & Play Session. Il relativo lavoro sarà scelto
in funzione del flusso di acquisizione concordato.

SQLite e filesystem locale comparivano come storage previsto nei primi
documenti. La roadmap aggiornata lascia aperta la tecnologia di M6
Storage & Projects. La scelta IndexedDB M4 riguarda il solo recupero corrente.

L'[analisi alphaTab](ALPHATAB_ANALYSIS.md) conserva l'esame statico di un
checkout 1.10.0. La dipendenza GTT verificata durante M3/M4 è la 1.9.0.
Le due evidenze hanno ambiti distinti.
