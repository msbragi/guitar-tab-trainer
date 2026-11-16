# Guitar Tab Trainer — Session handoff

Aggiornato il **16 novembre 2026**, dopo M4 e la finalizzazione Track Mixer/UI.
**L'utente ha provato l'app e riferito: «It seems all ok». M4 è accettata
operativamente come baseline per iniziare l'analisi M5 nella prossima sessione.**
Questo riscontro non rende verdi i test falliti e non certifica latenze,
sincronizzazione o qualità timbrica. M5 non è stata implementata.

## 1. Ripartire da qui

1. Leggere `AGENTS.md`, `TODO.md`, questo documento, `docs/ARCHITECTURE.md`,
   `docs/M4_PLAYBACK.md` e **`docs/M5_START.md`**.
2. Controllare branch/HEAD e working tree senza sovrascrivere le modifiche.
3. Iniziare analisi e proposta M5: confronto PCM/MIDI/prerendering,
   autorità temporale, vincoli e misure. Non scegliere implicitamente un
   Audio Engine o un runtime desktop; concordare il percorso prima di implementarlo.
4. Non riprendere automaticamente la lunga campagna di test M4: l'utente
   ha chiesto di fermarla e preferisce provare l'app personalmente.

Il prompt pronto per la nuova conversazione è in `M5_START.md`.

## 2. Preferenze e autorizzazioni dell'utente

- Per correzioni semplici di UI/CSS, procedere dopo l'analisi senza chiedere
  ogni volta conferma. Chiedere conferma per modifiche a core, librerie o
  moduli quando non siano già esplicitamente autorizzate dal task.
- Rispettare le fasi di AGENTS.md; evitare richieste ripetute per attività
  già autorizzate. M5 richiede un piano per le decisioni audio/clock.
- L'utente ha interrotto le verifiche automatiche del mixer e ha preferito
  il test manuale. Dopo la prova ha dato riscontro positivo e chiesto questo handoff.
- Non rilanciare suite browser estese solo per consolidare la sessione.
  Per M5 concordare verifiche mirate coerenti con le misure di sincronizzazione.
- Nessun commit/push. Non fermare il server hot reload dell'utente sulla 4200.
- Qualità timbrica della SoundFont fuori dall'attività appena conclusa.

## 3. Repository e ambiente

Workspace: `/workspace/tools/guitar-practice`, Debian WSL2 / ambiente Linux.
Branch di riferimento `main`; HEAD verificato **`e318e26` — First stage completed**.
Le modifiche M4 e mixer/UI sono ancora nella working tree, incluse numerose
aggiunte non tracciate. Nessuno staging, commit o push eseguito dall'agente.
Non fare reset/clean e non confondere queste modifiche con lavoro estraneo.
`55ed3af` nei vecchi riepiloghi è un riferimento storico.

Versioni fissate: Node 22.22.0, pnpm 10.34.9, Angular 21.2.26,
CLI/build 21.2.30, TypeScript 5.9.3, alphaTab **1.9.0**, Transloco 8.4.0,
Playwright 1.65.1. Nessuna dipendenza aggiunta/aggiornata per M4 o mixer.
Manifest e lockfile non sono stati cambiati da queste attività.

In questa sessione pnpm era disponibile tramite
`/tmp/guitar-practice-tooling/node_modules/.bin/pnpm`; è tooling temporaneo,
non presumere che sopravviva al riavvio. Preferire pnpm/Corepack già presenti;
non reinstallare o aggiornare dipendenze per abitudine.

L'app è Angular nel browser, servibile localmente. Non ci sono backend,
SQLite, runtime desktop, Audio Engine esterno o backing sincronizzata.
Il target Windows resta futuro. `audio-engine` e `study-project` sono directory
riservate, non pacchetti attivi con responsabilità già stabilite.

## 4. Stato implementato e confini

| Modulo | Responsabilità |
|---|---|
| `packages/core` | TypeScript puro: `ScoreController`, `TransportController`, `MixerController`, contratti ed eventi applicativi. Nessun Angular, alphaTab, DOM o storage concreto. |
| `packages/alphatab-adapter` | Unico accesso diretto alle API pubbliche di alphaTab: parsing, rendering, player, mixer del synth, risorse e lifecycle. Nessun fork. |
| `apps/web` | `ScoreSession` compone controller e adapter e proietta snapshot readonly in signal; componenti per presentazione/interazione, lingua e tema. |

Dipendenze: UI → core/adapter; adapter → core/alphaTab. Il core riceve i port
per composizione; nessun modello alphaTab attraversa il confine UI.
File GP originali intatti. Il controllo dei confini è `pnpm check:boundaries`.

### Caricamento e UI M0–M3

- File GP locali, parsing, metadati, rendering SVG di tutte le tracce,
  gestione errori e caricamenti successivi.
- Score & Tab / Tab Only / Notation Only, zoom 75–150%, fullscreen browser.
  Tracce senza corde mantengono la notazione anche in Tab Only.
- Shell responsive, pannelli collassabili e navigazione locale senza router URL.
  Il viewer resta montato passando alle altre sezioni.
- Transloco EN/IT locale; tema System/Light/Dark. Solo lingua e tema persistono
  in localStorage; storage vietato non blocca la UI. Il reload perde il GP.
- Library, Projects, Virtual Rig, recenti e preferiti restano predisposizioni
  esplicitamente non disponibili.

### Playback M4

- Synth forzato con `PlayerMode.EnabledSynthesizer`, anche con backing incorporata.
- Play/pausa, stop, seek, velocità 25–200%, loop A/B modificabile in esecuzione.
  Stop torna ad A se il loop è attivo, altrimenti all'inizio del brano.
- A/B usano tick della sequenza eseguita; B è esclusivo. Un nuovo range valido
  mantiene la posizione se interna, altrimenti rientra ad A. Intervalli invalidi
  sono rifiutati dal core senza sostituire il precedente range.
- Il core possiede lo stato applicativo; il player è l'autorità temporale
  della singola sorgente. Nessun timer applicativo simula il clock.
- Tick di esecuzione, coordinate di notazione e millisecondi alla velocità
  corrente sono distinti. Non usare battuta/BPM iniziale come conversione generale.
- Da fermo il core ignora notifiche di campioni tardivi (`isSeek=false`) e
  accetta seek espliciti. I test dei seek ammettono arrotondamento di 2 tick.
- Preparazione audio dopo rendering, timeout 30 s. Errori audio conservano la
  partitura. Reset/destroy chiudono output, eventi, timer e worker tramite API pubbliche.
- `Environment.initializeMain` configura factory con URL locali espliciti;
  nessun plugin Vite aggiunto. Rendering main thread, synth worker e AudioWorklet.
- Font, SONiVOX SF2, licenze e script originali copiati da Angular in
  `assets/alphatab/`; nessuna CDN. Offline con server locale, senza PWA.

### Feedback visivo e centratura

I cursori si muovevano ma erano trasparenti: aggiunti CSS globali circoscritti
in `apps/web/src/styles.css` per `.at-cursor-bar`, `.at-cursor-beat` e
`.at-highlight *`. L'utente ne ha confermato il funzionamento. La carta resta
chiara anche col tema dark. Le dimensioni/trasformazioni del cursore restano
controllate da alphaTab.

Nell'analisi precedente il resize nativo risultava funzionante e lo scroll
verticale interno seguiva il playback. La centratura non è stata modificata:
il foglio ha minimo 720 px e overflow interno. Con Score + Tab e molte tracce,
un sistema può superare l'altezza visibile; Continuous può spostare la vista
anche dopo rerender a playback fermo. Questi aspetti restano osservazioni UI,
non una modifica autorizzata/implementata né una prova di sync audio.

### Mixer e finalizzazione UI

- `MixerController`/`MixerPort` nel core; mute/unmute, solo/unsolo cumulativo,
  volume traccia e master nel pannello destro/barra inferiore.
- Il mute esplicito prevale sul solo; rimuovere l'ultimo solo ripristina le
  altre tracce non mute. `excluded` è derivato nel core.
- Volume tracce 0–100%, default da `PlaybackInformation.volume / 16`;
  master 100%. Nuovo file azzera mute/solo e ripristina i default. Cambio vista,
  zoom, tema, lingua o sezione mantiene lo stato del documento corrente.
- Adapter: `changeTrackMute`, `changeTrackSolo`, `changeTrackVolume`, `masterVolume`.
  Nessun mixer audio personalizzato. I comandi aggiornano lo stato dopo invio
  riuscito; queste API non offrono un ack acustico per ogni variazione.
- Canali condivisi: `mixer-tracks.ts` raggruppa gli indici collegati, anche
  transitivamente. I controlli sono sincronizzati e mostrano un avviso;
  il primo volume del gruppo è il default comune. L'isolamento per traccia
  non è garantito quando il motore usa gli stessi canali MIDI.
- Tooltip nativi `title` tradotti con Transloco; label/testi e `aria-pressed`
  restano separati. Aggiornamento dinamico EN/IT verificato nei test passati.
- Trasporto compatto orizzontale desktop, wrapping responsive, pulsanti mobili
  44×44 px. Placeholder precedente rimosso, BPM readonly, guida A/B accessibile.

## 5. Verifiche: distinguere stato attuale e risultati storici

| Verifica più recente | Risultato |
|---|---|
| Build produzione | Passata; output `apps/web/dist/web/browser`, circa 1,50 MB raw / 314 kB compressi stimati. |
| Typecheck produzione | Passato per core, adapter e UI. |
| Confini | Passati. |
| Vitest | **66 test passati in 12 file**. |
| Browser dopo mixer/UI | **30 passati, 4 falliti su 34**; non dichiarare suite verde. |
| Prova manuale utente | Riscontro generale positivo: «It seems all ok»; accettata baseline M4 per avviare M5. |

I precedenti 57 test Node / 27 browser e i sei scenari dev sulla 4174 erano
verdi prima dell'aggiunta del mixer. Sono risultati storici, non sostituiscono
l'esito attuale 30/34. Typecheck separato dei sorgenti di produzione;
Vitest trasforma i test, senza un typecheck completo separato dei test stessi.

### Quattro scenari browser aperti

1. `mixer.e2e.ts` — fixture canali condivisi: manca l'avviso atteso. Ispezione
   via parser pubblico ha mostrato che `m4-mixer-linked.gp` rientra con canali
   distinti 0/1, 2/3, 4/5, nonostante il generatore richieda condivisione.
   La fixture non esercita il caso dichiarato. Il mapper è coperto da test Node.
2. `mixer.e2e.ts` — segnale dopo unmute: il segnale iniziale c'è, tutti i mute
   producono silenzio, ma riattivare la prima traccia non ripristina il segnale
   atteso. Causa non chiusa; non attribuirla con certezza al prodotto o al test.
   Ispezione della fixture ha rilevato note/voci duplicate fra tracce e programma
   letto 25 invece dell'80 richiesto. Il generatore usa più `loadAlphaTex()`:
   questi reset degli ID sono una possibile origine delle collisioni all'export.
3. Responsive 1024 px: l'helper `open()` cerca un pulsante tramite ruolo dentro
   il pannello tracce collassato, quindi nascosto; fallisce prima delle misure layout.
4. Responsive 390 px: stesso problema nell'helper. Non è una prova di overflow
   o di errata altezza della barra; queste misure non sono state raggiunte.

File: `tests/browser/mixer.e2e.ts`,
`packages/alphatab-adapter/test/generate-m4-mixer.mjs`,
`tests/fixtures/m4-mixer.gp`, `tests/fixtures/m4-mixer-linked.gp`.
I file sono nuovi del progetto, non corpus GP upstream. Il generatore e le
fixture non sono stati corretti dopo l'interruzione richiesta dall'utente.
Non rigenerare/sostituire dati né modificare alphaTab per far passare questi test.
Un'eventuale ripresa deve separare errori delle fixture da difetti riprodotti su GP reali.

Questi casi sono debito di verifica documentato, non un motivo per riaprire
automaticamente M4 prima dell'analisi M5 richiesta dall'utente.

## 6. Limiti che restano aperti

Nessuna sincronizzazione multisorgente, misurazione drift/latency o garanzia
sample-accurate. Nessun supporto certificato Windows/ASIO, altri browser,
output ScriptProcessor o prove prolungate sotto carico. GP4/GPX e prestazioni
su file grandi non coperti. Qualità timbrica ed effetti non certificati;
SoundFont fuori dall'attività di finalizzazione.

Il riscontro manuale è generale: non inventare dispositivo/browser usati,
soglie numeriche o esecuzione di ogni punto della checklist specialistica.
Licenza applicativa ancora da scegliere; licenze e attribuzione upstream preservate.

## 7. Tooling e comandi per la prossima sessione

Non eseguire tutto automaticamente: sono riferimenti operativi.

```sh
pnpm dev
pnpm build
pnpm typecheck
pnpm check:boundaries
pnpm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm exec playwright test --reporter=line
```

La 4200 è riservata al dev server dell'utente: non fermarlo e controllare prima
se esiste già. Test di produzione sulla 4173, prove isolate su altra porta.
`GUITAR_PRACTICE_TEST_DEV=1` usa la 4200 e può confliggere col server attivo.
Le porte/browser possono richiedere permessi estesi nel sandbox. Il server di
Playwright attende stdout di avvio: non ripristinare il vecchio probe HTTP.

Log temporanei, se ancora disponibili:
`/tmp/guitar-practice-m4-finalize-build.log`,
`/tmp/guitar-practice-m4-finalize-typecheck.log`,
`/tmp/guitar-practice-m4-finalize-unit.log`.
Trace/error-context/screenshot in `test-results/` sono artefatti ignorati e
possono essere sovrascritti. La configurazione `/tmp/guitar-practice-m4-dev.config.ts`
era diagnostica e non è una configurazione supportata da riusare alla cieca.
I server di test precedenti erano gestiti dalla suite; quello isolato 4174
rimasto dopo SIGTERM era stato chiuso. Non presumere lo stato delle porte domani.

Nessun install, build, test, commit o push eseguito durante questo aggiornamento
finale della documentazione. Sono preservate le modifiche applicative della sessione.
