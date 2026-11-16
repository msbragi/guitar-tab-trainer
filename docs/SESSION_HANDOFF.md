# Guitar Tab Trainer — Session handoff

Aggiornato il **16 novembre 2026**. Consolidamento prima di M4: nessuna nuova
funzionalità, nessun commit o push eseguito durante questa attività.

## 1. Stato attuale

M0–M3, rinomina in **Guitar Tab Trainer**, localizzazione EN/IT e UI shell
responsive sono completate. **M4 non è iniziata**: il player alphaTab è
disabilitato e tutti i controlli di playback/mixer della shell sono inattivi.

L'applicazione corrente è client Angular nel browser, servibile localmente.
Non sono presenti backend, SQLite, runtime desktop o Audio Engine nativo.
Il target desktop Windows descritto in ARCHITECTURE.md resta una direzione
futura, non una capacità del prototipo attuale.

Git all'inizio del consolidamento: branch `main`, HEAD
`55ed3af44b0f99782b187d635fc7ab0e52552c6f` (`UI disposition`), working tree e
indice puliti. Non risultavano modifiche non pertinenti. Questa attività
aggiorna soltanto TODO.md, README.md e questo handoff; il codice resta invariato.
Commit e push sono riservati all'utente.

Stato finale verificato, senza staging:

```text
 M README.md
 M TODO.md
?? docs/SESSION_HANDOFF.md
```

Nessuna modifica non pertinente o artefatto generato incluso nelle modifiche.

## 2. Architettura e decisioni consolidate

| Modulo | Responsabilità e confini |
|---|---|
| `packages/core` | TypeScript puro: `ScoreController`, contratti `ScoreLoader`/`ScoreSource`, stato e metadati. Nessuna dipendenza Angular, alphaTab, DOM o storage concreto. |
| `packages/alphatab-adapter` | Unico accesso diretto ad alphaTab. Parsing, rendering, ciclo di vita e impostazioni di vista tramite API pubbliche. Espone metadati e `ScoreViewMode`, senza esportare il modello alphaTab alla UI. |
| `apps/web` | Componenti standalone, composizione della sessione, layout, preferenze, localizzazione e API browser. `ScoreSession` collega core e adapter; i componenti di presentazione non interpretano dati musicali. |

Direzione delle dipendenze: UI → core e adapter; adapter → core e alphaTab.
Il core riceve il proprio port tramite composizione, senza importare l'adapter.

Decisioni operative:

- Monorepo pnpm con `workspace:*`, lockfile unico e pacchetti privati.
  Gli scope tecnici `@guitar-practice/*` e la cartella del repository sono
  intenzionalmente conservati dopo la rinomina del prodotto.
- `angular.json` alla root configura soltanto `apps/web`; i pacchetti TS
  vengono compilati con `tsc` ed espongono l'entry point pubblico in `dist`.
- Prebundling del dev server disabilitato per la risoluzione delle dipendenze
  dichiarate nei singoli pacchetti pnpm. Nessun hoisting aggiuntivo.
- alphaTab stabile **1.9.0**, esterno e non modificato. L'analisi storica in
  [ALPHATAB_ANALYSIS.md](ALPHATAB_ANALYSIS.md) riguarda un checkout **1.10.0**:
  non considerarla una verifica di parità della release installata. I link
  `packages/alphatab/...` in quel documento sono riferimenti al checkout esterno.
- Rendering sul main thread (`useWorkers: false`), lazy loading disabilitato,
  player disabilitato. `load()` ricrea l'istanza del renderer; `setView()`
  aggiorna la presentazione del documento in memoria. File GP originali intatti.
- Le modalità usano proprietà pubbliche `Staff.showStandardNotation` e
  `Staff.showTablature`; lo zoom usa `settings.display.scale`, `updateSettings()`
  e `render()`. Nessun uso del deprecato `display.staveProfile`.
- Navigazione locale di shell, senza router URL. Il viewer resta montato
  passando fra sezioni, conservando il documento caricato.
- Nessun framework UI aggiuntivo; CSS variables condivise e icone SVG locali.
  Foglio della notazione sempre chiaro, larghezza minima 720px e scroll interno
  quando il viewport è stretto.
- Errori di dominio tramite `ScoreLoadError` e codici neutrali; la UI traduce
  i codici. `ScoreState.message` è diagnostica, non testo da mostrare direttamente.

## 3. Funzionalità implementate e verificate

- Lettura di file selezionati dall'utente, parsing, titolo/artista/tracce/battute
  e rendering SVG. Stati idle/loading/ready/error, recupero dopo errori,
  sostituzione delle istanze e protezione dei byte originali.
- Tre modalità Score & Tab / Tab Only / Notation Only e zoom 75–150%.
  Tracce senza corde mantengono la notazione in Tab Only. Fullscreen browser
  disponibile dove supportato.
- Header con logo/nome/versione, navigazione e lingua; pannelli laterali
  collassabili; menu mobile; tracce esclusivamente dal documento reale.
- Library, Projects e Virtual Rig dichiarati non disponibili. Nessun dato
  dimostrativo presentato come reale. Recenti/preferiti, mute/solo/volumi e
  barra di trasporto sono solo predisposizioni disabilitate.
- Transloco **8.4.0** confinato alla UI; cataloghi locali
  `apps/web/public/i18n/en.json` e `it.json`, distribuiti in `assets/i18n/`.
  Priorità: preferenza salvata → prima lingua browser supportata → EN.
  Inglese default/fallback, cambio runtime senza reload, contenuti e metadati
  della tablatura non tradotti.
- Temi System (default), Light e Dark. Script sincrono nel `<head>` prima di
  CSS/Angular e servizio Angular per mantenere il tema. System segue anche
  i cambiamenti del sistema durante la sessione.
- Soltanto preferenze UI in localStorage: `guitar-practice.language` e
  `guitar-tab-trainer.theme`. Storage bloccato non impedisce il cambio nella
  sessione. Nessuna persistenza dei file o dei progetti di studio.
- Font Bravura, licenze e JSON serviti localmente; nessuna CDN richiesta.

## 4. Verifiche del consolidamento

Eseguite dalla root sulla revisione sopra indicata, senza modifiche al codice:

| Comando | Esito |
|---|---|
| `pnpm build` | Passato; output in `apps/web/dist/web/browser`. |
| `pnpm typecheck` | Passato per core, adapter e UI; verifica i sorgenti di produzione. |
| `pnpm test` | 45 test passati in 7 file; include i controlli dei confini. |
| `pnpm check:boundaries` | Passato anche come controllo separato di manifest e import dei sorgenti. |
| `pnpm exec playwright test --reporter=line` | 21 test Chromium passati sulla build di produzione, in 41,4 s. |
| `git diff --check` | Passato al controllo iniziale e finale. |

Vitest esegue i test TS tramite trasformazione; il typecheck non è un controllo
separato dei file di test. I test Node coprono core, parsing, lifecycle,
cataloghi, preferenze linguistiche/tema e visibilità degli staff.

La suite browser comprende 21 scenari: corpus GP reale, errori e caricamenti
ripetuti, EN/IT, storage, fallback, navigazione, pannelli, temi prima di Angular,
modalità, zoom, fullscreen quando supportato e layout mobile.
Corpus di quattro fixture GP3/GP5/GP7 con provenienza, licenza e hash in
[tests/fixtures/alphatab/README.md](../tests/fixtures/alphatab/README.md).
Le prove non certificano la fedeltà musicale di ogni effetto.

## 5. Problemi conosciuti e limiti

Nessun errore bloccante rilevato dalle suite eseguite. Restano questi limiti:

- Nessun playback o audio verificato: non è ancora implementato. Non abilitare
  i controlli della shell prima di collegarli a funzionalità reali.
- Performance di rendering su partiture grandi non misurate; elaborazione sul
  main thread. Build iniziale circa 1,48 MB raw / 310 kB compressi stimati.
- Test browser in Chromium Linux; altri browser, Windows, driver/dispositivi
  audio e prestazioni native non verificati. GP4 e GPX fuori dal corpus attuale.
- Fullscreen dipende dal browser. Dialogo file nativo nella lingua del sistema.
- Navigazione senza URL, pannelli non persistiti, documento solo in memoria:
  il reload perde la tablatura caricata e conserva le sole preferenze UI.
- Offline significa app servita localmente con i propri asset, non PWA con
  avvio offline da un sito remoto. Nessun accesso filesystem desktop persistente.
- Dev server su 4200 usato dall'utente con hot reload: non fermarlo. I test
  browser del consolidamento usano un server statico separato sulla 4173.
  `GUITAR_PRACTICE_TEST_DEV=1` tenta di avviare un nuovo server e confligge se
  la 4200 è già occupata; non usarlo sulla sessione attiva dell'utente.
- Le API/audio dell'analisi 1.10.0 vanno ricontrollate sulla dipendenza 1.9.0.
  Eventi di posizione non sono una garanzia di scheduling audio preciso;
  player synth e backing track non costituiscono un mixer multisorgente.
- Licenza del progetto applicativo ancora da scegliere; licenze e attribuzione
  alphaTab/asset restano quelle upstream.

## 6. Prossima milestone: M4, playback sintetizzato di riferimento

**Solo per pianificare la prossima sessione; questo consolidamento non autorizza
l'avvio di M4.** Riprendere le fasi di AGENTS.md e concordare il perimetro prima
dell'implementazione. Le decisioni ordinarie sono delegate; cambiamenti
architetturali rilevanti richiedono approvazione esplicita.

Perimetro già previsto in TODO.md:

1. Definire nel core comandi, stato e contratto minimo del trasporto,
   indipendenti da Angular e dal modello alphaTab. Distinguere coordinate della
   notazione, tick di esecuzione e tempo, incluse ripetizioni e cambi di tempo.
2. Implementare attraverso l'adapter le API pubbliche di playback sintetizzato:
   play, pausa, stop, seek, velocità e loop. Chiarire autorità del trasporto e
   lifecycle su caricamento di un nuovo documento e distruzione della vista.
3. Distribuire localmente SoundFont e risorse worker/worklet necessarie;
   verificare l'integrazione con il builder Angular e il contesto sicuro browser.
   Non assumere che il plugin Vite sia direttamente applicabile al dev server Angular.
4. Collegare soltanto i controlli effettivamente implementati, mantenendo gli
   altri disabilitati. Conservare UI, temi, lingue, caricamento e rendering M3.
5. Testare comandi/eventi e stati; verificare playback udibile dopo gesto utente,
   disponibilità degli asset locali, stop/seek/velocità/loop e cleanup.

Esclusi da M4: backing track e sintesi simultanee, clock multisorgente, Audio
Engine nativo, acquisizione chitarra/ASIO, SQLite, runtime desktop, VST3,
pitch detection e DSP avanzato. M5 valuta PCM/MIDI/prerendering e clock condiviso;
M6 implementa la backing sincronizzata sul percorso validato.

## 7. Ripartenza e riferimenti per la prossima sessione

Leggere [AGENTS.md](../AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[ALPHATAB_ANALYSIS.md](ALPHATAB_ANALYSIS.md), [TODO.md](../TODO.md) e questo file.
ARCHITECTURE.md descrive anche componenti futuri: lo stato implementato è quello
riassunto qui e nel [README.md](../README.md).

Versioni: Node 22.22.0, pnpm 10.34.9, Angular 21.2.26, CLI/build 21.2.30,
TypeScript 5.9.3, alphaTab 1.9.0, Transloco 8.4.0, Playwright 1.65.1.
Controllare `.nvmrc`, `packageManager` e lockfile; non aggiornare dipendenze
incidentalmente per iniziare M4.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm check:boundaries
pnpm exec playwright install chromium  # solo se il browser non è già disponibile
pnpm test:browser
pnpm dev
```

In questo ambiente gestito pnpm è disponibile tramite
`/tmp/guitar-practice-tooling/node_modules/.bin/pnpm`; è tooling temporaneo,
non una dipendenza del repository. Usare il pnpm installato/Corepack nella
sessione successiva se quella directory non esiste più. Nessuna installazione
aggiuntiva è stata necessaria per questo consolidamento.

Per il Chromium di sistema, la suite è stata lanciata con:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm exec playwright test --reporter=line
```

Porte/browser possono richiedere permessi estesi nel sandbox. Il test server
attende il messaggio di avvio su stdout: il probe preliminare di una porta
chiusa restava sospeso nell'ambiente. Non ripristinare quel probe senza verifica.

`node_modules`, `dist`, `.angular`, `test-results` e report Playwright sono
ignorati; screenshot e trace vengono rigenerati. Lo schizzo `docs/GTT-UI.png`
e i fixture del corpus sono invece versionati. Non pulire o aggiungere artefatti
generati al commit. Verificare `git status` e lasciare commit/push all'utente.
