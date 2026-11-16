# M4 — Playback sintetizzato di riferimento

Perimetro approvato il 16 novembre 2026: alphaTab 1.9.0 esterno e non
modificato, singola sorgente sintetizzata, nessuna implementazione M5.
Nessuna dipendenza aggiunta o aggiornata; manifest e lockfile invariati.

**Chiusura operativa del 16 novembre 2026:** l'utente ha provato l'app e
riferito «It seems all ok», accettando M4 come baseline per l'analisi M5.
Build/typecheck/confini e 66 test Node passati; browser 30 passati e 4 falliti.
Il riscontro manuale non cancella questo debito. Dettagli e istruzioni per
ripartire in [SESSION_HANDOFF.md](SESSION_HANDOFF.md) e [M5_START.md](M5_START.md).

## Moduli e autorità

- `packages/core/src/transport.ts`: contratto `TransportPort`, eventi e
  `TransportController`; unico stato applicativo del trasporto, immutabile.
- `packages/alphatab-adapter`: API pubbliche di alphaTab, conversione degli
  eventi, risorse audio e lifecycle; nessuna dipendenza Angular.
- `apps/web`: proiezione readonly degli snapshot del core e invio dei comandi.
  Il componente di presentazione non mantiene stato musicale autonomo.

Il player è l'autorità temporale della singola sorgente. Il core conferma
play/pausa/stop in base agli eventi effettivi; nessun intervallo JavaScript
simula l'avanzamento. `idle`, `preparing`, `stopped`, `playing`, `paused` ed
`error` distinguono preparazione audio e disponibilità del documento.

I tick sono nella sequenza di esecuzione, incluse ripetizioni e finali
alternativi. Non sono indici di battuta. Posizione/durata in millisecondi e
BPM effettivo provengono da alphaTab alla velocità corrente; nessuna
conversione basata sul BPM iniziale. La timeline invia seek in tick.

## Comandi

- Play/pausa e stop. Stop torna all'inizio del brano o del range attivo.
- Seek con tastiera o timeline; valori limitati al brano/range attivo.
- Velocità: 25%, 50%, 75%, 100%, 125%, 150% e 200%.
- A/B impostati sulla posizione corrente confermata dal player. All'apertura
  coprono l'intero brano. Deve valere `0 <= A < B <= fine`.
- Attivare il loop applica il range; disattivarlo conserva i punti ma rimuove
  il range dal player. Il bordo B è esclusivo: un seek a B torna ad A.
- Modificare A/B durante il playback mantiene l'esecuzione: conserva la
  posizione se interna al nuovo range e la riporta ad A se esterna.
  Un intervallo invalido conserva i punti precedenti e mostra un errore.

Mute, solo e volumi traccia/master sono implementati nella finalizzazione UI.
Il placeholder precedente è rimosso. Il BPM resta un indicatore readonly. Nessuna personalizzazione riscrive i file GP.

## Risorse e lifecycle

Il rendering continua sul main thread; la sintesi usa un Web Worker e,
nel contesto sicuro verificato, AudioWorklet. Il synth è forzato tramite
`PlayerMode.EnabledSynthesizer`, senza selezionare eventuali backing incorporate.

`Environment.initializeMain`, API pubblica della 1.9.0, riceve factory con URL
espliciti: non si assume che il plugin Vite funzioni con il builder Angular.
`angular.json` copia gli script upstream immutati sotto `assets/alphatab/`
e SONiVOX SF2/licenza/README sotto `assets/alphatab/soundfont/`.
Core ESM audio circa 2,5 MiB e SoundFont circa 1,3 MiB non compressi, oltre al
bundle principale; nessuna CDN. Serve localhost o HTTPS per il percorso worklet.
L'offline verificabile resta quello con server statico locale, senza PWA.

La preparazione audio parte dopo il rendering e ha timeout di 30 secondi.
Errori di worker, SoundFont o caricamento worklet lasciano leggibile la
partitura e disabilitano il trasporto. Riaprire il file ricrea l'audio.
Reset/distruzione annullano timer e listener, invalidano eventi tardivi,
chiudono l'output con API pubbliche e terminano i worker creati dall'adapter,
anche se non possono inviare un ack. Nessun accesso a campi privati upstream.

Da fermo il core ignora eventi di posizione non derivanti da seek: notifiche
di campioni già in volo possono arrivare dopo pausa/stop. I seek espliciti
restano accettati. I test browser ammettono il piccolo arrotondamento della
conversione temporale del player; questa milestone non certifica precisione
sample-accurate né continuità acustica ai confini del loop.

## Verifiche automatiche

Risultati della finalizzazione Track Mixer/UI: build, typecheck e confini
passati; **66 test Node in 12 file passati**; browser **30 passati e 4 falliti
su 34**. Gli scenari aperti sono elencati nell'handoff: fixture canali
condivisi, segnale dopo unmute e due helper responsive con pannello nascosto.
Non sono stati corretti o rieseguiti dopo la richiesta dell'utente di fermare
le verifiche automatiche. L'utente ha poi riferito esito manuale positivo.

Prima della finalizzazione, 57 test Node, 27 browser e sei scenari dev sulla
4174 erano passati. Questi risultati sono storici. I comandi seguenti sono
riferimenti, non istruzioni per rilanciare automaticamente tutte le suite.

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm check:boundaries
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm exec playwright test --reporter=line
```

I test Node coprono gating dei comandi, eventi/stati, validazione, A/B durante
il playback, seek, velocità, errori, reset/dispose, notifiche tardive e factory
browser. Il typecheck verifica i sorgenti di produzione; Vitest trasforma i test.

La suite browser copre:

- grafo Web Audio con campioni non nulli dopo click, pausa/ripresa e stop;
- asset locali, worker e chiusura del precedente AudioContext/worker al cambio file;
- modifiche A/B mentre il player esegue, wrap del loop, range invalido e stop;
- nove quarti eseguiti nella fixture con cinque battute da 1/4 e ripetizioni;
- cambi di tempo 120 → 60 BPM, velocità, fine brano, zoom/modalità durante playback;
- errori e recupero per SoundFont e worker mancanti;
- errore e recupero del worklet tramite rifiuto iniettato di `addModule`:
  Chromium non intercetta questo caricamento con `page.route`;
- regressioni di caricamento, corpus originale, EN/IT, temi, shell e mobile.

La fixture tempo è originale del progetto, con generatore e provenienza in
[tests/fixtures/M4.md](../tests/fixtures/M4.md). Nessun fixture upstream modificato.

## Ascolto manuale richiesto

I campioni misurati nel grafo audio non certificano l’uscita fisica o la qualità
musicale. L’utente ha dato riscontro manuale generale positivo; l’agente non
ha eseguito ascolto umano e non sono stati riportati dispositivo, browser o
esiti punto per punto. La seguente checklist resta un riferimento per
eventuali verifiche specialistiche, senza bloccare l’analisi M5:

1. Su localhost/HTTPS, aprire un GP, attendere la disponibilità e premere Play:
   verificare suono udibile sul dispositivo scelto e strumenti plausibili.
2. Verificare pausa/ripresa, stop e seek ascoltando eventuali note residue,
   salti, click o interruzioni inattese.
3. Attivare A/B e modificare entrambi i punti durante l'esecuzione, anche
   rendendo esterna la posizione attuale: ascoltare il rientro nel nuovo range.
4. Provare velocità 50%, 100% e 200%, la fixture tempo e quella con ripetizioni;
   verificare ritmo, resa degli effetti e corrispondenza percepita col cursore.
5. Cambiare file durante il playback e chiudere la pagina: verificare che non
   resti audio della sessione precedente.

Browser/dispositivi Windows, altri browser, qualità timbrica, latenze, stress
prolungato e partiture grandi restano non certificati. Backing simultanea,
clock condiviso, PCM/MIDI/prerendering, audio nativo e storage restano M5+.

## Finalizzazione M4 — Track Mixer e UI

Implementazione autorizzata dalla richiesta di finalizzazione. Stato immutabile
in `packages/core/src/mixer.ts` (`MixerController`, `MixerPort`); l'adapter
converte gli indici applicativi in riferimenti alle tracce alphaTab e usa
esclusivamente `changeTrackMute`, `changeTrackSolo`, `changeTrackVolume` e
`masterVolume`. Nessun DSP o mixer audio personalizzato e nessun fork.

Il solo è cumulativo: più tracce possono restare in solo. Il mute esplicito
prevale sul solo; una traccia può avere entrambi i flag senza essere udibile.
Togliere l'ultimo solo rende nuovamente disponibili le altre tracce non mute.
Lo stato `excluded` è derivato nel core, non nei componenti Angular.

I volumi 0–100% sono fattori 0–1. Il volume iniziale di traccia deriva da
`PlaybackInformation.volume / 16`. Un nuovo file azzera mute/solo e ripristina
master 100% e volumi iniziali; modalità, zoom, tema, lingua e navigazione non
azzerano il mixer. Un evento ready ripetuto riapplica lo stato corrente;
reset e indisponibilità audio disabilitano i controlli. Errori con codici
neutrali sono tradotti in UI.

Le API operano sui canali MIDI, come dichiarato dalla documentazione di
[changeTrackMute](https://alphatab.net/docs/reference/api/changetrackmute/)
e [changeTrackSolo](https://alphatab.net/docs/reference/api/changetracksolo/).
Quando due tracce condividono un canale, i loro controlli vengono collegati,
anche per gruppi con sovrapposizioni transitive. Il volume iniziale comune è
quello della prima traccia del gruppo. La UI segnala il collegamento;
nessuna promessa di isolamento impossibile con il synth integrato.
Il core conosce soltanto gli indici collegati, senza tipi alphaTab o canali.
Il modello musicale e i file GP non vengono riscritti.

Tooltip nativi via `title`, tutti ottenuti da Transloco: navigazione, file,
pannelli, vista/zoom/fullscreen, lingua, tema, trasporto e mixer. I toggle
mostrano l'azione inversa quando attivi (Unmute/Unsolo). Le label accessibili,
`aria-pressed`, i testi e i controlli nativi restano indipendenti dal tooltip.
I test verificano titoli e aggiornamento dinamico; l'aspetto del popup è del
browser e va controllato manualmente, soprattutto sui dispositivi touch.

La barra elimina le righe di istruzioni sempre visibili, mantiene una guida
A/B accessibile e i valori correnti, e usa una riga su desktop. A viewport
strette va a capo; i pulsanti mobili hanno aree 44×44 px. Gli slider hanno
un'altezza di interazione maggiore. Nessuna modifica al clock, alla viewport
del renderer o al comportamento di seek/loop.

Le fixture sperimentali a tre voci erano pensate per canali distinti e
condivisi, ma hanno problemi di roundtrip ancora aperti; stato, provenienza
e generatore sono in [M4_MIXER.md](../tests/fixtures/M4_MIXER.md).
Il test del grafo audio mira a verificare mute, solo multipli, volume traccia
e master. Nell’ultima esecuzione ha rilevato segnale iniziale e silenzio con
tutti i mute, ma è fallito al successivo unmute della prima traccia: i passi
successivi non sono quindi verificati da quel test. La fixture ha problemi
di roundtrip ancora aperti. Non dichiarare questa prova passata né usarla
come certificazione di qualità timbrica o uscita fisica.

Checklist specialistica aggiuntiva (il riscontro manuale generale è già positivo):

- [ ] Ascoltare due o più tracce distinte: mute multipli, solo multipli,
  mute su una traccia in solo e ripristino dopo l'ultimo unsolo.
- [ ] Regolare separatamente i volumi e il master, anche durante un loop;
  verificare eventuali note residue o discontinuità.
- [ ] Verificare un proprio GP con tracce che condividono canali e i controlli
  collegati, poi caricare un altro GP e controllare il ripristino.
- [ ] Provare tooltip EN/IT, tastiera e slider su browser/dispositivi reali;
  verificare leggibilità e comodità della barra su schermi piccoli.

M5 non avviata. Nessuna nuova dipendenza, routing, backing o Audio Engine.
