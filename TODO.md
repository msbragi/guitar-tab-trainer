# Guitar Tab Trainer — Roadmap e attività

Stato consolidato sulla working tree del 26 novembre 2026.
Questo file contiene la roadmap attiva. Lo storico essenziale è in
[docs/HISTORY.md](docs/HISTORY.md), lo stato tecnico in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## M0–M3 — Completate

- [x] Bootstrap Angular/TypeScript e confini dei moduli.
- [x] Orchestrazione del caricamento e contratti indipendenti dalla UI.
- [x] Integrazione alphaTab, parsing e rendering di file Guitar Pro locali.
- [x] Shell responsive, temi e localizzazione EN/IT.

## M4 — Playback & Fretboard

**Funzionalmente completata**, con rifiniture e verifica manuale ancora aperte.

- [x] Playback sintetizzato, trasporto, velocità e loop A/B.
- [x] Mixer con mute/solo, volumi, visibilità indipendente e reset tracce.
- [x] Sincronizzazione bidirezionale tra timeline, playback e tablatura.
- [x] Ripristino del GP corrente e del relativo stato dopo refresh, senza autoplay.
- [x] Fretboard sincronizzata e compatta, nomi delle note e riferimenti del manico.
- [x] Effetti annotati e rappresentazione animata di slide, bending/release e hammer-on/pull-off.
- [x] Riorganizzazione dei componenti Angular in cartelle con TS, HTML e CSS separati.
- [ ] Rifinire la resa e verificare manualmente articolazioni, ascolto e comportamento sui GP dell'utente.
- [ ] Chiarire i debiti di fixture/test browser e i limiti residui elencati in [M4_PLAYBACK.md](docs/M4_PLAYBACK.md).
- [x] Spostare i dettagli delle articolazioni accanto al selettore traccia (sopra la tastiera su spazi stretti), con altezza riservata anche senza effetti. Build passata.
- [ ] Verificare nel browser che le transizioni dei dettagli non spostino la fretboard.

L'utente ha confermato il ripristino dopo refresh e il funzionamento degli
archi H/P. Questi riscontri coesistono con i debiti automatici documentati.

## M5 — Guitar Capture & Play Session

**Funzionalmente completata** (Step 1–6 di [docs/M5_M6_PLAN.md](docs/M5_M6_PLAN.md) implementati e verificati da build + 131 test Node), con verifica manuale nel browser e calibrazione su chitarra reale ancora aperte. Punto di partenza in [docs/M5_START.md](docs/M5_START.md).

- [x] Analizzare il flusso e concordare un primo incremento.
- [x] Selezionare un intervallo di battute e creare una sessione di lavoro con il synth GP e il mixer corrente (backing audio reale da concordare).
- [x] Valutare Hendrix e convertire l'intero motore DSP + bonus mobile in TypeScript puro (`@guitar-practice/audio-engine`) dietro il contratto agnostico `AudioToMidiPort` (`@guitar-practice/core`).
- [x] Definire i modelli di dominio per varianti, correzione note su fretboard con Undo/Redo e progetti in `@guitar-practice/study-project`.
- [x] Consentire l'avvio del playback prima dell'intervallo e limitare la registrazione al segmento desiderato (`guitar-capture.ts`).
- [x] Acquisire la propria esecuzione sulla chitarra reale e creare varianti della frase.
- [x] Consentire verifica e correzione delle note attraverso la fretboard con Undo/Redo.
- [x] Conservare separate la frase originale e le sue varianti.
- [x] Razionalizzare la toolbar superiore: rimossi i tab placeholder e `[Practice]`/`[Settings]`, icona ingranaggio Settings a destra del selettore lingua, spazio centrale libero e altezza compatta.
- [x] Spostare Settings nella sidebar di destra (senza nascondere la tab aperta) e aggiungere il caricamento locale di SoundFont `.sf2` (Base + Guitar Override) persistiti in IndexedDB con tabellina di rimappatura chitarre GM (`24`–`31`) e indicazione delle tracce del brano aperto.
- [ ] Verificare nel browser il flusso varianti (`Save phrase`, `+ New Variant`, `● Record Take`, Monitor ON/OFF, tuner/livello) e l'editing interattivo sulla fretboard con Undo/Redo.
- [ ] Calibrare latenza, allineamento audio/posizione musicale e qualità della conversione Audio → MIDI con chitarra reale e interfaccia audio.

### Primo incremento approvato — selezione e prova della frase

Correzione UX concordata: sostituire il pannello sempre visibile con un flusso
diretto sulla partitura. Il pulsante in toolbar avvia la selezione guidata;
«Fine pratica» occupa lo stesso posto e ripristina la vista completa/resetta
la sessione. Nessun tab aggiuntivo o finestra separata.

- [x] Selezione guidata IN/OUT tramite click sulla partitura, senza seek durante la scelta.
- [x] Evidenza della selezione e configurazione compatta di contesto/countdown; passaggio richiesto solo per battute ripetute.
- [x] Mostrare il frammento nella stessa cornice usando display.startBar/barCount pubblici, senza duplicare player o modificare i GP.
- [x] Fine pratica ripristina la partitura completa e azzera selezione, conteggio e sessione.
- [x] Verificare transizioni, adapter, regressioni mirate (46 test Node) e build.

- [x] Proiettare le occorrenze delle battute dalle API pubbliche alphaTab 1.9.
- [x] Selezionare traccia e intervallo contiguo nell'esecuzione, rendendo visibili ripetizioni e finali.
- [x] Creare una sessione di lavoro in memoria, con anticipo in battute eseguite.
- [x] Distinguere punch-in/punch-out dal contesto; contesto precedente e conteggio selezionabili anche insieme (conteggio proposto all’inizio).
- [x] Ascoltare una passata fino alla fine della frase usando il synth e il mixer esistenti, disattivando il loop senza perdere A/B.
- [x] Invalidare la sessione al cambio documento; preservare GP e recupero M4.
- [x] Verificare logica con test mirati (46 passati), build e confini.
- [x] Verifica UI e ascolto nel browser a cura dell’utente: due click, annullamento/ricomincia, frammento/zoom, contesto e countdown, Fine pratica/reset e ritorno ad A/B.

## M6 — Storage & Projects

**Funzionalmente completata** (contratti in `@guitar-practice/study-project` e adapter `IndexedDbStudyProjectStore` integrati in `apps/web`), con verifica manuale nel browser ancora aperta.

- [x] Definire la gestione persistente di brani, sessioni di lavoro, registrazioni e varianti (`StudyProject`, `PracticePhrase`, `PhraseVariant`, `StudyProjectStoragePort`).
- [x] Chiarire identità (`computeScoreContentId`), relazioni e ciclo di vita delle risorse + bundle portabile `.gtt.json`.
- [x] Concordare IndexedDB multi-store (`projects`, `scores`, `media`) con fallback in-memory ed export/import portabile, più pulizia dei tab placeholder nella UI.
- [x] Implementare `IndexedDbStudyProjectStore` e collegare la sidebar sinistra (`Recent Files`, `Favorites`, `Saved Phrases`, `Export/Import`) in `apps/web`.
- [ ] Verificare nel browser persistenza IndexedDB tra reload, toggle preferiti, attivazione frasi salvate ed Export/Import `.gtt.json`.

Il ripristino della sola sessione corrente in IndexedDB è già parte di M4.
La scelta M6 riguarda la gestione persistente dei progetti.

## Modalità di lavoro

Seguire AGENTS.md e le autorizzazioni del task. Per le modifiche UI l'utente
preferisce build e prova manuale nel browser. Usare test mirati quando
necessari alla logica coinvolta. Conservare le modifiche presenti nella
working tree, evitare commit/push e mantenere attivo il server di sviluppo.
