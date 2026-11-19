# Guitar Tab Trainer — Roadmap e attività

Stato consolidato sulla working tree del 19 novembre 2026.
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

L'utente ha confermato il ripristino dopo refresh e il funzionamento degli
archi H/P. Questi riscontri coesistono con i debiti automatici documentati.

## M5 — Guitar Capture & Play Session

**Da affrontare progressivamente.** Punto di partenza in
[docs/M5_START.md](docs/M5_START.md).

- [ ] Analizzare il flusso e concordare un primo incremento.
- [ ] Selezionare un intervallo di battute e creare una sessione di lavoro con l'accompagnamento originale.
- [ ] Consentire l'avvio del playback prima dell'intervallo e limitare la registrazione al segmento desiderato.
- [ ] Acquisire la propria esecuzione sulla chitarra reale.
- [ ] Convertire l'audio acquisito in eventi musicali e tablatura.
- [ ] Valutare Hendrix come primo candidato per un motore Audio → MIDI sostituibile.
- [ ] Consentire verifica e correzione delle note attraverso la fretboard.
- [ ] Conservare separate la frase originale e le sue varianti.

Dispositivi, allineamento audio/posizione musicale e qualità della conversione
richiedono prove mirate. Hendrix è un candidato da valutare.

## M6 — Storage & Projects

**Da progettare successivamente. Tecnologia di storage aperta.**

- [ ] Definire la gestione persistente di brani, sessioni di lavoro, registrazioni e varianti.
- [ ] Chiarire identità, relazioni e ciclo di vita delle risorse.
- [ ] Valutare lo storage più appropriato e concordarne la scelta.
- [ ] Definire recupero e conservazione dei dati dei progetti.

Il ripristino della sola sessione corrente in IndexedDB è già parte di M4.
La scelta M6 riguarda la gestione persistente dei progetti.

## Modalità di lavoro

Seguire AGENTS.md e le autorizzazioni del task. Per le modifiche UI l'utente
preferisce build e prova manuale nel browser. Usare test mirati quando
necessari alla logica coinvolta. Conservare le modifiche presenti nella
working tree, evitare commit/push e mantenere attivo il server di sviluppo.
