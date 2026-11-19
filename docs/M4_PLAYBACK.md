# M4 — Playback & Fretboard

**Funzionalmente completata**, con rifiniture e verifiche manuali aperte.
La baseline usa alphaTab 1.9.0 attraverso API pubbliche e asset locali.
Lo storico delle fasi precedenti è in [HISTORY.md](HISTORY.md).
La roadmap successiva è in [TODO.md](../TODO.md).

## Playback e trasporto

- Synth alphaTab forzato anche quando il GP contiene una backing incorporata.
- Play/pausa, stop, seek e velocità 25–200%.
- A/B impostabili dalla posizione corrente anche durante il playback.
  Deve valere 0 ≤ A < B ≤ fine. B è esclusivo.
- Un nuovo range valido conserva la posizione interna o la riporta ad A.
  Un range invalido mantiene i punti precedenti e segnala l'errore.
- Stop torna ad A con loop attivo, altrimenti all'inizio del brano.

Il player fornisce posizione e stato effettivi. TransportController mantiene
lo stato applicativo e convalida i comandi, senza clock musicale concorrente.
I tick descrivono la sequenza eseguita, comprese ripetizioni e finali.
Tempo e millisecondi provengono dal player alla velocità corrente.
La tolleranza usata nei test di seek è di 2 tick per gli arrotondamenti del player.

Timeline e click sullo score passano dallo stesso controller.
Gli aggiornamenti automatici restano notifiche. Da fermo il core filtra
le notifiche tardive dei campioni e accetta i posizionamenti espliciti.
Il seek porta in vista il cursore anche senza Play.
Il click sul beat usa la sua prima occorrenza nella sequenza eseguita.

## Mixer, visibilità e UI

Mute, solo cumulativi, volumi traccia e master usano le API del synth.
Il mute esplicito prevale sul solo. Volume tracce 0–100%, iniziale dal GP,
master iniziale 100%. I controlli audio delle tracce con canali MIDI condivisi
sono collegati, anche per gruppi transitivi.

L'occhio nel mixer cambia la visibilità in notazione e tablatura.
Almeno una traccia resta visibile, dato che renderTracks ignora un elenco vuoto.
Il reset accanto a Tracce ripristina visibilità, mute/solo e volumi del file,
conservando master e posizione del trasporto. Un nuovo documento ripristina
i default di velocità e mixer. Modalità e zoom si conservano fra file.

La sidebar destra contiene titolo del brano e dettagli espandibili sopra il mixer.
I tre toggle sono compatti, con dimensioni maggiori sui viewport mobili.
Il viewer offre notazione/tablatura, zoom e fullscreen browser.
I cursori e le note evidenziate hanno CSS dedicato e la carta resta chiara
anche col tema scuro. L'interfaccia e i tooltip sono localizzati EN/IT.

## Ripristino della sessione corrente

IndexedDB conserva una sola copia dei byte originali dell'ultimo GP caricato
con successo e lo snapshot associato. Dopo refresh vengono ripristinati
file, tick, A/B, loop, velocità, master, mute/solo, volumi, vista/zoom e
tracce nascoste. Il player viene lasciato fermo.
Le sessioni salvate prima del campo di visibilità riaprono tutte le tracce.
LocalStorage conserva lingua, tema e preferenze leggere.

La sostituzione dei record del file e dello stato è atomica.
Le scritture del solo stato sono accorpate a 500 ms, con flush aggiuntivo
tentato su pagehide e pagina in background. L'identificatore protegge
il nuovo GP da scritture tardive di altre schede.
L'apertura dello storage ha un limite di 1,5 secondi.

Storage negato, quota e dati corrotti consentono comunque l'apertura manuale.
Una sostituzione fallita conserva l'ultima copia valida, che può riapparire
al refresh. Uno snapshot invalido viene ignorato. Un GP corrotto mostra
il normale errore di caricamento e può essere sostituito manualmente.
Una chiusura improvvisa può perdere gli ultimi aggiornamenti.

I dati dipendono da origine/porta, browser e profilo e sono cancellabili.
Fra schede prevale l'ultimo caricamento riuscito, senza aggiornamento live
delle altre. Progetti, cronologia e sessioni di lavoro persistenti appartengono
alla futura M6, con tecnologia ancora aperta.

## Fretboard sincronizzata e articolazioni

Il pannello Tastiera è opzionale e collassabile. Un selettore locale sceglie
la traccia da rappresentare. La proiezione usa il primo rigo a corde della
traccia e i tick confermati, anche in pausa e dopo seek/click da fermo.
Le tracce senza corde mostrano un messaggio dedicato.

Il manico mostra accordatura, capotasto, corde a vuoto, tasti e note attive.
Le note usano sigle anglosassoni con diesis, come apici accanto al marker.
I riferimenti bianchi indicano i tasti del manico, con secondo punto a 12 e 24.
La selezione della traccia e l'apertura del pannello valgono per la pagina corrente.

| Articolazione | Rappresentazione |
|---|---|
| Bending e release | Curva laterale completa e punto che segue salita, tenuta e ritorno. Il marker resta sul tasto premuto. |
| Slide shift/legato con destinazione | Percorso sul manico, tasto di arrivo attenuato e punto in avanzamento. |
| Hammer-on e pull-off | Arco H/P fra i tasti, mantenuto anche sulla nota di arrivo. Una catena può mostrare collegamento entrante e uscente. |
| Vibrato, pick slide e slide senza destinazione | Simboli e dettagli testuali. |

La geometria e il percorso completo sono disponibili da fermo.
L'avanzamento deriva da tick, durata del beat e offset della curva.
La temporizzazione è didattica. Durate speciali di note legate, staccato,
palm mute, grace note e bending rapidi SongBook possono differire dall'audio.
L'ampiezza grafica del bending è adattata allo spazio, con intervallo in toni
nei dettagli. Le note nominate indicano la posizione base.

Whammy bar, animazione del vibrato e legature generiche di fraseggio restano
fuori dalla copertura animata attuale. H/P richiede una destinazione valida
sulla stessa corda. Mute/solo non filtrano i marker della traccia selezionata.
La correzione delle note attraverso il manico è un obiettivo M5.

## Risorse, offline e lifecycle

Rendering sul main thread, sintesi in worker e AudioWorklet su localhost/HTTPS.
Bravura, SONiVOX SF2, licenze e script upstream sono distribuiti localmente
sotto assets/alphatab. L'uso offline è stato verificato con server locale.

La preparazione audio segue il rendering e ha timeout di 30 secondi.
Errori audio conservano la partitura e disabilitano il trasporto.
Riaprire il file ricrea l'audio. Reset e distruzione scollegano eventi e
timer, chiudono l'output e terminano i worker, anche senza ack.
Il sito attuale richiede un server e non dispone di avvio offline PWA.

## Verifiche registrate

| Fase | Esito effettivamente registrato |
|---|---|
| Consolidamento del recupero IndexedDB | Build/typecheck/confini, 36 test Node selettivi e 5 scenari Chromium passati. |
| Prima fretboard | Build/typecheck/confini, 78 test Node complessivi e 3 scenari Chromium mirati passati. |
| Recupero visibilità | Build e 8 test Node passati. L'utente ha confermato il corretto rendering dopo refresh. |
| Prototipo slide e bending | Build/confini e 13 test Node mirati passati. |
| Aggiunta H/P | Build/confini e 16 test Node mirati passati. Proiettate correttamente 49 origini H/P del GP5 dell'utente. |

L'utente ha confermato la resa compatta, il funzionamento dei gesti del GP
dimostrativo e degli archi H/P nel proprio GP5. Ne ha apprezzato la resa visiva,
con valore didattico ancora da valutare nell'uso.
Le prove non certificano uscita fisica, fedeltà musicale completa,
latenza nativa, altri browser/dispositivi o comportamento sotto carico.

Per modifiche UI successive, l'utente preferisce build e prova personale
nel browser. I risultati selettivi non forniscono un esito della suite
browser completa sul codice corrente.

## Problemi noti e debiti aperti

- Nell'ultimo run browser completo storico dopo il mixer, 30 scenari passavano
  e 4 fallivano. La suite completa attuale non è stata rieseguita.
- La fixture m4-mixer-linked.gp rientra con canali distinti, quindi non esercita
  la condivisione dichiarata dal generatore.
- Il test audio non ripristinava il segnale atteso dopo unmute.
  Causa ancora aperta. Sono state rilevate note/voci duplicate, programma
  diverso e collisioni di ID nei dati mixer. La verifica del tick cache ha
  confermato un limite di quelle fixture. Dettagli in [M4_MIXER.md](../tests/fixtures/M4_MIXER.md).
- Due helper responsive cercavano pulsanti in un pannello collassato a 1024
  e 390 px, fallendo prima delle misure di layout.
- Il successivo test tracks-sidebar.e2e.ts ha fallito un'asserzione sui vecchi
  SVG presenti dopo refresh, anche filtrandoli con :visible. L'utente ha poi
  confermato che il rendering funziona. Il criterio del test resta da chiarire.
- Prestazioni su partiture grandi, GP4/GPX, browser diversi da Chromium Linux
  e Windows/ASIO richiedono verifica. Rendering corretto nel piccolo corpus
  non garantisce la fedeltà di ogni file o articolazione.
- Continuità acustica ai confini dei loop, code di note e qualità timbrica
  richiedono ascolto manuale specialistico. La sincronizzazione di acquisizione
  e playback sarà valutata nella M5.

## Risorse di prova

| File | Scopo |
|---|---|
| [M4.md](../tests/fixtures/M4.md) | Fixture tempo originale, metrica e provenienza. |
| [M4_MIXER.md](../tests/fixtures/M4_MIXER.md) | Intenzione e limiti delle fixture mixer. |
| [m4-fretboard.gp](../tests/fixtures/m4-fretboard.gp) | Chitarra e basso con accordature e posizioni distinte. |
| [m4-gestures.gp](../tests/fixtures/m4-gestures.gp) | Sette battute a 60 BPM con slide, bending/release, pausa, H/P. |

I generatori delle ultime due fixture sono in packages/alphatab-adapter/test,
rispettivamente generate-m4-fretboard.mjs e generate-m4-gestures.mjs.
Il GP5 scaricato dall'utente è stato letto senza modificarlo o copiarlo
nel corpus distribuito. Il corpus upstream e le licenze sono in
[tests/fixtures/alphatab/README.md](../tests/fixtures/alphatab/README.md).
