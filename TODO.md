# Guitar Tab Trainer — TODO

## Stato corrente — chiusura operativa M4, 16 novembre 2026

M0–M4 implementate, inclusi feedback visivo, Track Mixer, tooltip EN/IT e
trasporto compatto. Dopo prova manuale l'utente ha riferito «It seems all ok»
e chiesto di preparare la ripartenza **M5**. M4 è la baseline accettata per
l'analisi M5; il riscontro generale non certifica ogni caso specialistico.

M5 non implementata. Ripartire da [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md)
e [docs/M5_START.md](docs/M5_START.md), che contiene il prompt della prossima sessione.
Non rilanciare automaticamente le lunghe suite M4: l'utente preferisce provare
l'app direttamente. Non fare commit/push né fermare il suo server sulla 4200.
Per correzioni semplici UI/CSS procedere dopo l'analisi; modifiche a core,
librerie o moduli richiedono un perimetro già autorizzato o approvazione.

### Finalizzazione — Track Mixer e UI

- [x] Implementare stato immutabile/comandi mixer nel core e API pubbliche nell'adapter.
- [x] Attivare mute/solo cumulativi, volumi traccia/master e reset al nuovo spartito.
- [x] Collegare controlli per canali condivisi e mostrare il limite nella UI.
- [x] Aggiungere tooltip nativi Transloco EN/IT con label accessibili indipendenti.
- [x] Compattare trasporto desktop/responsive preservando i controlli attivi.
- [x] Eseguire build, typecheck, confini, test Node e regressioni browser; registrare gli esiti effettivi.
- [x] Ricevere riscontro manuale positivo dell'utente e preparare documentazione di ripartenza.
- [ ] Chiarire il debito dei quattro scenari browser descritti sotto, senza riavviarlo automaticamente come prerequisito di M5.

Risultati più recenti: build, typecheck e confini passati; **66 test Node in
12 file passati**; browser **30 passati e 4 falliti su 34**. La suite non è verde.
I vecchi risultati 57/27 e i sei scenari dev verdi precedono il mixer/UI.

Debito aperto:

- Fixture `m4-mixer-linked.gp` riletta con canali distinti, non quelli condivisi
  richiesti dal generatore: il caso browser non esercita la condizione attesa.
- Segnale dopo unmute nella fixture sintetica non ripristinato come atteso;
  causa non chiusa. Rilevate note/voci duplicate e programma MIDI diverso
  dopo export/import; possibile collisione ID fra chiamate `loadAlphaTex`.
- Due scenari responsive cercano tramite ruolo pulsanti nel pannello
  collassato/nascosto (1024 e 390 px), prima di raggiungere le misure di layout.

Non cancellare i fallimenti né definirli tutti difetti del prodotto o tutti
problemi delle fixture. Dettagli, file e contesto nell'handoff. Le API mute,
solo e volume agiscono sui canali; controlli di tracce collegate restano
sincronizzati. Volume 0–100%, iniziale GP, master 100%, mute/solo azzerati a
nuovo documento. Nessun mixer audio personalizzato, fork o nuova dipendenza.

I riepiloghi M0–M3 e della prima implementazione M4 sotto sono storici.

## Consolidamento e handoff — 16 novembre 2026

- [x] Verificare stato Git iniziale, staging, modifiche non pertinenti e artefatti ignorati.
- [x] Eseguire build, typecheck, test automatici e controllo esplicito dei confini.
- [x] Completare la verifica browser sulla build di produzione.
- [x] Finalizzare risultati, attività rimanenti e `docs/SESSION_HANDOFF.md`.

Stato consolidato: M0–M3, rinomina, localizzazione EN/IT e UI shell completate.
M4 non iniziata; M5–M6 e le decisioni native/storage restano future.
Baseline Git: `main`, `55ed3af` (UI disposition), working tree e indice puliti;
nessuna modifica non pertinente rilevata. Nessun commit/push da eseguire.
Questa attività modifica soltanto la documentazione, senza nuove funzionalità.

Verifiche concluse: `pnpm build`, `pnpm typecheck`, `pnpm test`
(45 test, 7 file) e `pnpm check:boundaries` passati. Playwright: 21 test
Chromium passati sulla build di produzione, inclusi corpus GP e regressioni
M3/localizzazione/shell. `git diff --check` pulito al controllo finale.
Nessun errore bloccante rilevato; limiti di browser, corpus e rendering
riportati in [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md).

Stato Git finale: soltanto README.md e TODO.md modificati e
docs/SESSION_HANDOFF.md nuovo, senza staging. README ritoccato soltanto per
includere le preferenze tema tra i test e collegare l'handoff. Nessuna modifica
al codice, ai manifest o al lockfile; artefatti di build/test ignorati.
Nessuna modifica non pertinente, commit o push. Server hot reload non fermato.

Rimanenti: concordare M4 (contratti del trasporto, playback sintetizzato e
asset audio locali), quindi M5 (verifica clock/percorso audio esterno) e M6
(backing sincronizzata). Non sono autorizzate implementazioni di queste
milestone durante il consolidamento. Dettagli e limiti nell'handoff.

## UI shell modulare — prima di M4

Richiesta autorizzata: implementare e verificare la shell usando `docs/GTT-UI.png`
come riferimento. Nessuna attività di playback, storage musicale o audio.

- [x] Separare composizione/sessione UI, header/navigazione, sidebar, viewer,
  pannello tracce e barra di trasporto in componenti standalone.
- [x] Rendere navigabili Practice, Library, Projects, Virtual Rig e Settings;
  mostrare esplicitamente le sezioni future non disponibili.
- [x] Implementare layout responsive, menu mobile e pannelli collassabili.
- [x] Conservare caricamento, metadati, errori e renderer attraverso la navigazione.
- [x] Implementare modalità notazione/tablatura e zoom tramite API pubbliche
  dell'adapter; fullscreen browser dove disponibile.
- [x] Introdurre token CSS e temi System/Light/Dark, preferenza locale e
  inizializzazione prima del primo paint.
- [x] Localizzare tutti i nuovi testi EN/IT; disabilitare controlli playback,
  mute/solo/volume, recenti e preferiti non ancora implementati.
- [x] Eseguire build, typecheck, test esistenti e test browser della shell;
  verificare responsive e rendering di fixture GP reali.
- [x] Aggiornare README e risultati TODO; fermarsi prima di M4.

Scelte: nessuna nuova dipendenza UI o backend; navigazione di shell locale
senza introdurre un router per sezioni ancora prive di funzionalità.
Il core resta invariato. La sessione Angular compone core e adapter; i
componenti di presentazione ricevono dati/comandi senza interpretare musica.
Il viewer rimane montato per preservare il documento navigando fra sezioni.
Partitura su carta chiara anche in dark mode per mantenere leggibilità.
Rischi da verificare: ridimensionamento alphaTab con collasso dei pannelli,
stabilità del renderer su cambio lingua/tema/navigazione, fullscreen non
disponibile, storage bloccato, assenza di flash e overflow su mobile.

Risultati UI shell:

- Build, typecheck e verifica dei confini passati; core e dipendenze invariati.
- 45 test automatici passati: suite precedenti più 8 casi del tema e 2 casi
  di visibilità Staff, compresa una traccia senza corde.
- 21 test Chromium passati: tutti i 14 scenari M3/localizzazione più 7 scenari
  della shell. Corpus GP reale caricato/renderizzato; byte originali invariati.
- Verificati navigazione e sezione attiva, pagine future esplicite, trasporto
  e controlli tracce disabilitati, pannelli collassabili e renderer conservato.
- Verificati System/Light/Dark, persistenza, cambi del sistema, storage vietato
  e tema iniziale con bundle Angular bloccato (script applicato prima della UI).
- Verificati le tre modalità, zoom iniziale 100% e cambio 125%, fullscreen
  quando supportato, menu mobile e scorrimento interno della partitura.
- Screenshot desktop dark 1440×960 e mobile 390×844 ispezionati: foglio chiaro,
  controlli leggibili, nessun overflow orizzontale della pagina.
- Corrette label e selezione iniziale del controllo zoom; introdotta larghezza
  minima del foglio 720px per evitare note compresse su viewport stretti.
- Contratto `ScoreViewMode` separato dai tipi alphaTab: nessun modello della
  libreria esposto alla UI. Nessun uso di API deprecate di staveProfile.
- Nessun framework UI, backend, SQLite, runtime desktop, audio o playback aggiunto.
  Test svolti sulla porta 4173; server hot reload dell'utente non fermato.

Limiti: verifica browser in Chromium Linux; fullscreen dipende dal browser.
Navigazione locale senza routing URL, pannelli non persistiti, recenti/preferiti
e sezioni future non operativi. I limiti M3 su corpus e prestazioni restano.
Shell completata. Arresto prima di M4.

## Rinomina applicazione — prima del primo commit

- [x] Aggiornare nome UI EN/IT, titolo HTML e nome del monorepo.
- [x] Allineare intestazioni dei documenti e aspettative dei test.
- [x] Verificare build, typecheck, test e avvio della build di produzione.

Perimetro: nome prodotto Guitar Tab Trainer. Cartella, scope interni dei
pacchetti e chiave localStorage restano stabili; README già aggiornato
dall'utente. Nessun commit e nessuna attività M4 previsti.

Risultati: build, typecheck e controllo dei confini passati; 35 test
automatici passati. Smoke test Chromium sulla porta 4173 passato: titolo
della scheda e intestazione Guitar Tab Trainer, anche dopo cambio IT → EN.
README e server hot reload dell'utente lasciati invariati. Nessun commit eseguito.

M0 approvata dall'utente; implementazione e verifiche di M1, M2 e M3
autorizzate in sequenza. Arresto obbligatorio prima di M4 (playback).
Le decisioni tecniche ordinarie sono delegate; modifiche architetturali
rilevanti richiedono approvazione.

Stato: M0, M1, M2 e M3 completate e verificate. Localizzazione UI EN/IT
completata e verificata. M4 non avviata.

## Localizzazione UI — prima di M4

- [x] Verificare compatibilità Transloco/Angular installato.
- [x] Integrare Transloco 8.4.0 soltanto in `apps/web`.
- [x] Aggiungere JSON locali EN/IT, inglese default e fallback.
- [x] Rilevare la lingua del browser e ripristinare la preferenza localStorage.
- [x] Aggiungere selettore EN/IT e cambio a runtime senza ricaricamento.
- [x] Tradurre testi, messaggi, placeholder e label accessibili della UI.
- [x] Usare codici di errore di dominio per tradurre gli errori nella UI.
- [x] Conservare metadati e contenuti delle tablature senza tradurli.
- [x] Aggiornare test e README; eseguire build, typecheck e test.
- [x] Registrare risultati e limiti; arrestarsi prima di M4.

Piano approvato con la richiesta di implementazione: JSON distribuiti come
asset locali, caricati da Transloco; priorità preferenza salvata → prima
lingua browser supportata → EN. Errori dello storage non bloccano la UI.
Il core espone codici di errore neutrali, senza dipendenze di localizzazione;
l'adapter conserva i titoli vuoti e la UI traduce soltanto il placeholder.
Rischi da verificare: fallback inglese, storage non disponibile, cambio lingua
senza ricreare il renderer, regressioni di caricamento e rendering M3.

Compatibilità verificata sul manifest npm di `@jsverse/transloco@8.4.0`:
peer Angular >=16 e RxJS >=6, soddisfatti da Angular 21.2.26/RxJS 7.8.2.

Risultati localizzazione:

- `pnpm build`, `pnpm typecheck` e controllo dei confini passati.
- `pnpm test`: 35 test passati (22 core/adapter e 13 preferenze/cataloghi UI).
- Playwright sulla build di produzione: 14 test Chromium passati, inclusi
  i 3 scenari M3 e 11 nuovi scenari di localizzazione.
- Verificati EN iniziale, IT regionale, lingua non supportata, precedenza
  della preferenza salvata, persistenza dopo reload e storage bloccato.
- Cambio lingua verificato anche durante lettura pendente e con errori già
  visibili. Diagnostica tecnica non esposta nei messaggi applicativi.
- Fallback EN verificato per chiave italiana mancante e catalogo IT assente.
- Cambio EN/IT senza navigazione né ricreazione della superficie SVG;
  titolo reale, nomi delle tracce e file invariati. Placeholder del titolo
  assente tradotto esclusivamente nella UI.
- Cataloghi JSON EN/IT serviti localmente; scenario M3 con host esterni
  bloccati passato. Nessuna dipendenza Angular/Transloco nel core o adapter.
- Reinstallazione offline con lockfile congelato riuscita.
- README aggiornato conservando gli aggiornamenti contemporanei dell'utente.

Verifica aggiuntiva del server di sviluppo: non completata perché la porta
4200 era occupata dalla sessione hot reload dell'utente. L'utente ha autorizzato
di saltare ulteriori test in tale ambiente; il server esistente non è stato
fermato. I test sulla build di produzione sono stati completati.

Limiti: browser verificato Chromium Linux; il dialogo nativo di selezione file
usa la lingua del browser/sistema. Restano i limiti M3 per corpus, rendering
sul main thread e distribuzione offline. Nessuna attività M4 avviata.

## M0 — Approvazione del piano di bootstrap

- [x] Approvare struttura web/core/alphatab-adapter.
- [x] Approvare direzione delle dipendenze e proprietà dei contratti.
- [x] Fissare versioni compatibili di Node, pnpm, Angular e TypeScript.
- [x] Identificare release alphaTab e documentazione corrispondente.
- [x] Approvare dipendenze e piano di verifica.
- [x] Registrare il piano concordato in TODO.md prima dell'implementazione.

Criterio di completamento:
piano e perimetro di implementazione approvati esplicitamente.

Versioni selezionate: Node 22.22.0, pnpm 10.34.9, Angular 21.2.26,
CLI/build 21.2.30, TypeScript 5.9.3, alphaTab stabile 1.9.0.
Compatibilità Angular/Node/TypeScript verificata sulla matrice ufficiale
e sui peer dependency pubblicati. L'analisi alphaTab riguarda 1.10.0:
M3 ha verificato le API pubbliche della release 1.9.0 per parsing e rendering,
senza assumere la parità delle funzionalità audio.

## M1 — Bootstrap del monorepo

- [x] Configurare pnpm workspaces e manifest privati.
- [x] Creare app Angular client e due pacchetti TypeScript.
- [x] Configurare export pubblici e dipendenze workspace:*.
- [x] Configurare compilazione, typecheck, test e sviluppo.
- [x] Generare un unico lockfile e documentare l'avvio.

Verifica, nella fase autorizzata:
installazione con lockfile congelato, build e typecheck riusciti;
app avviabile; core compilabile senza tipi DOM o Angular.

Risultati M1: installazione con lockfile congelato e store offline riuscita;
build, typecheck e controllo automatico degli import riusciti. Smoke test
Chromium sulla build di produzione: 1 passato, nessun errore JavaScript.
In M1 non esistono ancora test funzionali del core; vengono introdotti in M2.

Criticità ambiente: registry e porte locali non accessibili nel sandbox;
download e test browser eseguiti con permessi estesi. Il controllo HTTP
preventivo di Playwright su porta chiusa rimaneva in attesa: il server di
test segnala ora la disponibilità tramite stdout. Nessun backend applicativo.
Gli script opzionali di parcel/watcher, lmdb e msgpackr-extract sono bloccati
da pnpm; build e verifiche eseguite non ne hanno richiesto l'esecuzione.

Per M2: contratto ScoreLoader sui byte e sui metadati, sorgente con lettura
asincrona indipendente dal filesystem, controller con stati e sottoscrizioni.
Una sola operazione alla volta; copia difensiva dei byte originali;
chiusura della sessione senza pubblicazione di risultati tardivi.

## M2 — Primo caso d'uso indipendente dalla UI

- [x] Definire il contratto minimo di caricamento dello spartito.
- [x] Gestire stato iniziale, caricamento, successo ed errore.
- [x] Testare l'orchestrazione con un adapter finto.
- [x] Verificare i confini degli import.

Verifica:
test del core eseguibili senza browser, Angular o alphaTab;
nessun tipo alphaTab esposto dai contratti.

Risultati M2: 9 test del core passati in ambiente Node, senza Angular,
alphaTab o DOM. Build, typecheck e verifica dei confini passati.
Coperti lettura fallita, input vuoto, errori del motore, recupero dopo errore,
richieste concorrenti, immutabilità dei byte originali e chiusura durante
lettura/caricamento. Nessuna nuova dipendenza runtime del core.

Per M3: adapter browser con player disabilitato e rendering sul main thread
tramite API pubbliche; font locale copiato dal pacchetto installato.
Il rendering sul main thread evita plugin del bundler per questo prototipo;
prestazioni su partiture grandi e worker restano da valutare separatamente.
La UI passa una lettura asincrona di File al controller e riceve solo stato
e metadati; host DOM e ciclo di vita del renderer restano nell'adapter.

## M3 — Caricamento e rendering alphaTab

- [x] Integrare alphaTab esclusivamente tramite API pubbliche.
- [x] Caricare byte da un file scelto dall'utente.
- [x] Gestire rendering, errori e distruzione dell'istanza.
- [x] Distribuire localmente font e risorse necessarie.
- [x] Validare un piccolo corpus GP con provenienza documentata.

Verifica:
rendering nella build di produzione; errore comprensibile su input
non valido; caricamenti ripetuti senza istanze residue;
file originali invariati; nessuna richiesta a CDN.

Risultati finali M3:

- Installazione offline con lockfile congelato, typecheck di produzione,
  build e controllo dei confini riusciti.
- 22 test Node passati: 9 orchestratore, 7 parser su fixture reali/input
  non validi e 6 ciclo di vita dell'adapter (API browser simulata).
- 3 test Chromium passati sulla build di produzione; gli stessi 3 scenari
  passati tramite `pnpm dev` con watcher TypeScript e server Angular.
- Corpus: quattro fixture ufficiali GP3/GP5/GP7 dal tag alphaTab v1.9.0,
  commit fissato, licenza e hash SHA-256 documentati in
  [tests/fixtures/alphatab/README.md](tests/fixtures/alphatab/README.md).
- Rendering SVG e metadati verificati, incluso caricamento ripetuto dello
  stesso file, sostituzione della superficie, errori e successivo recupero.
  Byte e file del corpus invariati; font Bravura servito localmente con HTTP 200.
- Nessun errore JavaScript nei casi di rendering verificati; nessuna richiesta
  a host esterni, SoundFont o worklet e nessun worker avviato.
- Screenshot della tablatura ispezionato; comandi e limiti nel README.

Criticità risolte:

- `angular.json` collocato alla root per copiare gli asset dell'adapter
  all'interno del workspace Angular. Configura esclusivamente `apps/web`;
  core e adapter restano compilati con `tsc`.
- Prebundling del dev server disabilitato per evitare la risoluzione delle
  dipendenze alla root invece che nei pacchetti pnpm. Nessun hoisting aggiunto.
- La libreria alphaTab richiede i tipi `ESNext.Disposable`: abilitati soltanto
  nella compilazione dell'adapter; il core resta senza tipi DOM.

Limiti residui:

- Rendering sul main thread; prestazioni su file grandi non misurate.
- GP4 e GPX non coperti dal corpus; presenza del rendering e metadati attesi
  non certificano la fedeltà grafica/musicale di ogni effetto.
- Test browser eseguiti in Chromium Linux; altri browser e Windows non verificati.
- Build iniziale circa 1,38 MB non compressi (circa 285 kB stimati compressi).
- Offline verificato come assenza di richieste esterne con server statico
  locale; nessun service worker per l'avvio offline di un sito remoto.

Arresto a M3: player disabilitato. Nessun playback, Audio Engine nativo,
SQLite, backend o runtime desktop introdotto. M4–M6 restano lavoro futuro.

## M4 — Playback sintetizzato di riferimento

Correzione visiva autorizzata dopo verifica manuale: aggiungere soltanto gli
stili dei cursori alphaTab e delle note evidenziate. Core, adapter, librerie,
viewport e scorrimento restano fuori dall'intervento. Verifica nell'app a cura
dell'utente, senza aggiungere o eseguire test automatici per questa correzione.

- [x] Applicare CSS globali circoscritti a `.score-host` per battuta, beat e note.
- [x] Verifica manuale dell'utente: evidenziazione e movimento durante playback.

Piano approvato il 16 novembre 2026. Perimetro: synth alphaTab 1.9.0 tramite
API pubbliche, nessun fork o aggiornamento di dipendenze; nessuna attività M5.
Unica rappresentazione autorevole del trasporto nel core; Angular presenta
lo stato e inoltra i comandi. Il player è l'autorità temporale della singola
sorgente M4, senza clock applicativo concorrente.

- [x] Definire port, controller e stato del trasporto nel core (tick e ms distinti).
- [x] Gestire preparazione audio separata dal rendering, errori e lifecycle.
- [x] Collegare play/pausa, stop, seek, velocità e loop A/B; stop all'inizio
  dell'intervallo attivo o del brano; validare gli intervalli nel core.
- [x] Verificare modifiche A/B durante il playback, ripetizioni e cambi di tempo.
- [x] Distribuire SoundFont SF2, licenze e script audio localmente con Angular.
- [x] Conservare modalità, zoom, navigazione, tema e localizzazione EN/IT;
  mixer, volume, precedente ed editing BPM restano disabilitati.
- [x] Eseguire build, typecheck, test, confini e suite browser di produzione.
- [x] Documentare separatamente prove automatiche e ascolto manuale richiesto.
- [x] Aggiornare risultati, criticità e handoff; nessun commit/push.

- [x] Definire comandi e stato minimo del trasporto.
- [x] Integrare play, pausa, stop, seek, velocità e loop.
- [x] Distribuire localmente SoundFont, worker e worklet necessari.
- [x] Testare la logica dei comandi e verificare il playback nel browser.

Verifica:
comandi e stato coerenti; playback udibile dopo interazione utente;
risorse disponibili nella build distribuita.
Questa milestone non certifica la sincronizzazione multisorgente.

Esito implementazione: completata nel perimetro approvato. Build, typecheck,
controllo dei confini e 57 test Node (10 file) passati. Suite completa sulla
build di produzione: 27 test Chromium passati, inclusi 6 scenari M4.
Gli stessi 6 scenari M4 sono passati sul server Angular isolato 4174 (32,5 s).
Una riesecuzione interrotta da SIGTERM aveva lasciato attivo il server:
verifica completata sul processo esistente e processo di test poi chiuso;
server dell’utente sulla 4200 non fermato.
Campioni non nulli misurati tramite AudioWorkletNode nella prima verifica.
Successivamente l’utente ha provato l’app e dato accettazione operativa
generale; dettagli su dispositivo e singoli scenari non sono stati riportati.

Criticità risolte: eventi di campioni tardivi dopo stop/pausa filtrati dal core;
cleanup anche senza ack del worker; errori asincroni del worklet; label e
selezione iniziale 100% della velocità. Seek verificato con tolleranza 2 tick
per l'arrotondamento del player. Screenshot desktop/mobile ispezionati.
Nessuna dipendenza o lockfile modificati, nessun fixture originale alterato.

- [ ] Eventuale verifica specialistica documentata oltre al riscontro generale: uscita fisica, pausa/ripresa,
  stop/seek, modifica A/B durante il suono, click/code ai bordi del loop,
  velocità, ripetizioni, cambi di tempo e cambio file/chiusura.

Procedura, decisioni e limiti: [docs/M4_PLAYBACK.md](docs/M4_PLAYBACK.md).
M5 non iniziata; nessun commit o push.

## M5 — Prototipo di audio esterno e trasporto condiviso

Prossima fase richiesta dall’utente: analisi e piano secondo
[docs/M5_START.md](docs/M5_START.md). Nessun percorso audio/clock scelto o
implementato; concordare decisioni e soglie prima del prototipo.

- [ ] Confrontare percorso PCM, MIDI esterno e prerendering.
- [ ] Scegliere un percorso sperimentale con approvazione esplicita.
- [ ] Definire clock autorevole, unità temporali e gestione dei seek.
- [ ] Concordare scenari, durata e soglie numeriche di accettazione.
- [ ] Misurare drift, latenza e discontinuità su loop e cambi di tempo.
- [ ] Documentare risultati e decisione prima di stabilizzare i contratti.

Verifica:
risultati riproducibili rispetto alle soglie concordate;
limiti dichiarati; nessuna modifica o fork di alphaTab.

## M6 — Backing track e controlli sincronizzati

- [ ] Implementare il percorso validato in M5.
- [ ] Introdurre il pacchetto audio soltanto con responsabilità definite.
- [ ] Gestire backing locale, sintesi e volumi indipendenti.
- [ ] Verificare seek, velocità, ripetizioni, loop e sync point.

Verifica:
playback simultaneo entro le soglie approvate in M5.

## Decisioni rinviate

- [ ] Runtime desktop e accesso persistente al filesystem.
- [ ] SQLite e modello persistente dei progetti.
- [ ] Distribuzione con avvio offline.
- [ ] Acquisizione chitarra, dispositivi e ASIO.

Fuori dal milestone iniziale:
VST3, pitch detection e processamento avanzato del rig.
