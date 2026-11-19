# Guitar Tab Trainer — Handoff

Aggiornato al riordino documentale del 19 novembre 2026.

## Ripartire

1. Leggere AGENTS.md, TODO.md e ARCHITECTURE.md.
2. Controllare Git e le modifiche locali prima di intervenire. Alla ricognizione
   il branch è main, HEAD 24df1de, con modifiche applicative e file nuovi ancora
   nella working tree, incluso un GP5 scaricato dall'utente.
3. Per la prossima milestone seguire M5_START.md.
4. Consultare M4_PLAYBACK.md per comportamento corrente, verifiche e debiti.

La richiesta di riordino documentale autorizza questo aggiornamento dei documenti.
L'implementazione M5 richiede il successivo incarico e il piano relativo.

## Stato da cui riprendere

- M0–M3 completate, con bootstrap, contratti, caricamento e rendering.
- M4 Playback & Fretboard funzionalmente completata. Sono presenti synth,
  trasporto, mixer, visibilità, seek bidirezionale e recupero corrente in IndexedDB.
- La fretboard segue la traccia scelta e mostra nomi delle note, riferimenti,
  effetti e gesti animati per slide con destinazione, bending/release e H/P.
- La sidebar destra ospita informazioni espandibili sul brano e mixer.
- La correzione di note tramite fretboard è un obiettivo M5. La fretboard
  corrente svolge visualizzazione e supporto alla lettura.
- M5 Guitar Capture & Play Session e M6 Storage & Projects sono ancora da affrontare.

L'utente ha confermato manualmente il ripristino della visibilità dopo refresh
e il funzionamento degli archi hammer-on/pull-off. Ha accettato la resa compatta
e considera piacevole la rappresentazione dei movimenti, con utilità didattica
ancora da valutare nell'uso.

## Verifiche e problemi aperti

L'ultima verifica degli archi H/P comprende build Angular, confini e 16 test
Node mirati passati. La proiezione di 49 origini H/P nel GP5 dell'utente è stata
verificata sui dati importati. Questi numeri riguardano controlli selettivi.

L'ultima suite browser completa documentata è storica, con 30 passati e 4
falliti dopo il mixer. I successivi test mirati e riscontri manuali non
costituiscono un nuovo esito completo. Rimangono da chiarire fixture mixer,
segnale dopo unmute, helper responsive e asserzioni DOM dopo refresh.
Il dettaglio e i limiti della fretboard sono centralizzati in
[M4_PLAYBACK.md](M4_PLAYBACK.md).

## Preferenze operative

Per modifiche UI, l'utente chiede build e verifica personale nel browser.
Usare test mirati sulla logica quando pertinenti. Concordare eventuali
campagne browser o misure audio necessarie ai successivi incrementi M5.
Evitare di riavviare automaticamente le lunghe suite storiche.

Conservare il lavoro presente. Nessun commit/push e nessun arresto del server
hot reload dell'utente. La porta 4200 è quella di sviluppo.
La configurazione Playwright di produzione usa 4173. La modalità test dev
usa 4200 e può entrare in conflitto con il server già attivo.

Preferire pnpm disponibile nell'ambiente. Percorsi e log sotto /tmp delle
sessioni precedenti sono temporanei. Manifest e lockfile fissano le versioni.
I comandi build, typecheck, test e check:boundaries sono descritti nel README.

## Nuovo orientamento

M5 riguarda acquisizione della chitarra e sessione di lavoro su un segmento,
con accompagnamento e conversione sostituibile, Hendrix primo candidato.
M6 riguarda storage e progetti, con tecnologia da scegliere.
Il precedente piano PCM/MIDI esterno/prerendering e backing sincronizzata
è conservato come contesto tecnico nello [storico](HISTORY.md).
