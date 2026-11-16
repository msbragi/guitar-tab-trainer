# Guitar Tab Trainer — TODO

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

- [ ] Definire comandi e stato minimo del trasporto.
- [ ] Integrare play, pausa, stop, seek, velocità e loop.
- [ ] Distribuire localmente SoundFont, worker e worklet necessari.
- [ ] Testare la logica dei comandi e verificare il playback nel browser.

Verifica:
comandi e stato coerenti; playback udibile dopo interazione utente;
risorse disponibili nella build distribuita.
Questa milestone non certifica la sincronizzazione multisorgente.

## M5 — Prototipo di audio esterno e trasporto condiviso

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
