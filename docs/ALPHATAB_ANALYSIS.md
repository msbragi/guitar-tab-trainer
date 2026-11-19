# Storico tecnico alphaTab: valutazione architetturale per un'app desktop di studio

Documento storico di analisi statica. La roadmap attiva è in
[TODO.md](../TODO.md) e l'architettura corrente in
[ARCHITECTURE.md](ARCHITECTURE.md). I percorsi packages/alphatab citati
qui identificano file del checkout upstream esaminato, assente nel workspace
GTT. La dipendenza installata è alphaTab 1.9.0.


Analisi statica del checkout `5f50046a0e76229af5509f5a28e9567d5af634f0`; versione dichiarata in `packages/alphatab/package.json`: **1.10.0**. Questa versione identifica i sorgenti esaminati, non un pacchetto installato o una release verificata. Nessun prototipo, installazione, build o test eseguito. I riferimenti descrivono contratti e implementazioni presenti, non difetti riprodotti.

## Valutazione

**L'architettura proposta è fattibile senza assumere un fork.** alphaTab può essere una dipendenza per importazione, modello musicale, rendering e sintesi; orchestratore, acquisizione, mixer generale e DSP possono restare nell'applicazione. Il confine black box deve coincidere con le esportazioni pubbliche, non con qualunque classe TypeScript accessibile nei sorgenti.

Il limite principale è audio: il player integrato sceglie **una sola modalità** fra sintetizzatore, backing track e media esterno. Non fornisce un trasporto per più sorgenti con clock audio condiviso. Sintesi e backing track simultanee richiedono composizione esterna; la sincronizzazione del cursore a un media esterno è già prevista, ma non equivale alla sincronizzazione precisa di due motori audio.

## Componenti e confini pubblici

I percorsi di questa sezione sono relativi a `packages/alphatab/src/`.

| Componente | Evidenza | Implicazione |
| --- | --- | --- |
| Facciata integrata | `packages/alphatab/src/AlphaTabApiBase.ts`, `packages/alphatab/src/platform/javascript/AlphaTabApi.ts` | Collega caricamento, rendering, player, cursori, selezione ed eventi. La variante JavaScript richiede un `HTMLElement`; la UI applicativa può essere autonoma. |
| Importazione | `packages/alphatab/src/importer/ScoreLoader.ts`, `Environment.buildImporters()` | Produce un `Score` senza rendering o playback. Gli importatori registrati includono `Gp3To5Importer`, `GpxImporter`, `Gp7To8Importer`. |
| Modello | `packages/alphatab/src/model/Score.ts`, `Track`, `Staff`, `Bar`, `Voice`, `Beat`, `Note`, `MasterBar` | Oggetti musicali condivisi dalle pipeline; non è una separazione in servizi isolati. Relazioni e dati derivati richiedono coerenza. |
| Layout/rendering | `packages/alphatab/src/rendering/ScoreRenderer.ts`, `packages/alphatab/src/rendering/IScoreRenderer.ts` | Indipendente dal synth; layout e disegno restano responsabilità di alphaTab. |
| Generazione musicale | `packages/alphatab/src/midi/MidiFileGenerator.ts`, `IMidiFileHandler`, `AlphaSynthMidiFileHandler` | Traduce il modello in eventi di esecuzione, lookup temporale e sync point. Utilizzabile senza UI. |
| Sintesi/output | `packages/alphatab/src/synth/AlphaSynth.ts`, `packages/alphatab/src/synth/IAlphaSynth.ts`, `packages/alphatab/src/synth/ISynthOutput.ts` | Sintesi SoundFont separata dal dispositivo che consuma i campioni. |
| Adattamento piattaforma | `packages/alphatab/src/platform/IUiFacade.ts`, `ICanvas`, `IContainer` | Contratti pubblici per integrazioni personalizzate, con superficie più ampia rispetto al semplice hosting del controllo. |

`packages/alphatab/src/alphaTab.core.ts` espone i namespace `importer`, `model`, `rendering`, `midi`, `synth`, `platform`, `io`, `exporter`, `json`. Il manifest permette l'entry point principale e `./core`, non import arbitrari di file interni. Essere esportata da un barrel non rende automaticamente stabile una classe marcata `@internal`: ad esempio `AlphaSynthWebWorkerApi` e `AlphaSynthWebAudioOutputBase` non sono basi prudenti per un'integrazione aggiornabile.

## Utilizzo indipendente

- **Parsing:** `importer.ScoreLoader.loadScoreFromBytes(Uint8Array, settings?)` restituisce il modello; `loadAlphaTex()` è disponibile separatamente. L'accesso ai file desktop appartiene all'host. La presenza degli importatori non prova la fedeltà di ogni caratteristica di ogni file Guitar Pro.
- **Rendering:** `new rendering.ScoreRenderer(settings)`, `width`, `renderScore()`, `resizeRender()`, `partialRenderFinished`, `RenderFinishedEventArgs.renderResult` e `boundsLookup` permettono una superficie personalizzata. Il risultato dipende dal backend; font, inizializzazione, presentazione dei frammenti e hit testing restano necessari. In alternativa `AlphaTabApi` gestisce questi aspetti con player disabilitato.
- **Playback:** `midi.MidiFileGenerator(score, settings, handler).generate()` e `synth.AlphaSynth(output, bufferTimeInMilliseconds)` permettono generazione e sintesi senza renderer. `loadMidiFile()` e `loadSoundFont()` alimentano il synth. Usare questa pipeline separata significa gestirne esplicitamente ciclo di vita e sincronizzazione con la vista.
- **Integrazione completa personalizzata:** `AlphaTabApiBase` accetta una `IUiFacade`, che include anche `createWorkerPlayer()`. È un punto di estensione pubblico; `AlphaTabApi` browser non offre invece un setter pubblico per sostituire il player o il suo output già creato (`player` e `output` sono in lettura).

## Timeline e sincronizzazione

`Score.masterBars` contiene la struttura comune: metrica, ripetizioni, finali, direzioni, `tempoAutomations` e `syncPoints`; le tracce contengono le rispettive battute e note. **Posizione nella notazione, tick nell'esecuzione e millisecondi del media sono coordinate diverse.** Una battuta può essere eseguita più volte e il tempo può cambiare: indice di battuta o BPM iniziale non bastano a ricavare la timeline.

`MidiFileGenerator.tickLookup` e `AlphaTabApiBase.tickCache` espongono `packages/alphatab/src/midi/MidiTickLookup.ts`, con `findBeat()`, `masterBars`, `getBeatStart()` e `getMasterBarStart()`. Le ricerche riferite a un solo `Beat` non sostituiscono l'identificazione dell'occorrenza nella sequenza ripetuta. `AlphaSynthMidiFileHandler.tickShift` rappresenta inoltre l'offset necessario per abbellimenti iniziali: la facciata integrata lo compensa, una pipeline separata deve considerarlo.

Le API integrate includono `play()`, `pause()`, `stop()`, `tickPosition`, `timePosition`, `playbackSpeed`, `playbackRange`, `isLooping`. Loop e replay di una selezione sono disponibili; politiche di studio come ripetizioni contate, pause e incremento progressivo del tempo appartengono all'orchestratore. `playbackSpeed` è un fattore di velocità, non un editor della mappa dei tempi. `loadMidiForScore()` rigenera il MIDI e interrompe il playback.

Gli eventi `playerPositionChanged`, `playerStateChanged`, `playerFinished`, `playedBeatChanged`, `activeBeatsChanged`, `midiEventsPlayed` consentono feedback UI e logica applicativa. `packages/alphatab/src/synth/PositionChangedEventArgs.ts` include tick, millisecondi, estremi, `isSeek`, `originalTempo`, `modifiedTempo`. **Non sono un contratto di scheduling audio sample-accurate.** In `packages/alphatab/src/PlayerSettings.ts`, il buffer predefinito è 500 ms e l'intervallo degli aggiornamenti AudioWorklet è 10 ms; quest'ultimo non rappresenta la latenza totale.

### Backing track e media esterni

`PlayerMode.EnabledAutomatic` sceglie la backing track se presente, altrimenti la sintesi; `EnabledSynthesizer`, `EnabledBackingTrack`, `EnabledExternalMedia` forzano la sorgente. La selezione è verificabile in `AlphaTabApiBase._setupOrDestroyPlayer()`; non è un mixer parallelo.

- `model.BackingTrack.rawAudioFile` contiene il file audio; `Score.backingTrack` lo associa allo spartito. Nel browser l'output usa un `HTMLAudioElement`: `packages/alphatab/src/platform/javascript/AudioElementBackingTrackSynthOutput.ts`.
- `Score.applyFlatSyncPoints()` / `exportFlatSyncPoints()` permettono una mappa persistibile separatamente: `barIndex`, `barPosition`, `barOccurence`, `millisecondOffset`. `api.updateSyncPoints()` aggiorna il player. Non emerge un servizio di allineamento automatico audio/spartito.
- In modalità esterna, `api.player.output` può essere trattato come `synth.IExternalMediaSynthOutput`: `handler` implementa `IExternalMediaHandler` (`play`, `pause`, `seekTo`, volume, velocità, durata); `updatePosition(currentTime)` riceve millisecondi assoluti dal media. Il contratto è pubblico in `packages/alphatab/src/synth/ExternalMediaPlayer.ts`; le classi concrete sono interne. Il clock esterno può così guidare posizione e cursore senza fornire audio ad alphaTab.
- **Limite sostanziale:** il synth live eredita `AlphaSynthBase.updateSyncPoints()` e `loadBackingTrack()` che non effettuano operazioni. `BackingTrackPlayer` applica invece i sync point; l'export audio può applicarli con `AudioExportOptions.useSyncPoints`. Non si può presumere che i sync point adattino automaticamente la sintesi live a una registrazione con tempo variabile.

## Copertura dei requisiti

| Esigenza | Disponibile pubblicamente | Responsabilità esterna / limite |
| --- | --- | --- |
| Importazione e tablatura GP | `ScoreLoader`, `ScoreRenderer`, `AlphaTabApi.load()` / `renderScore()` | Validare i file rappresentativi e gli effetti usati. |
| Playback sintetizzato | `AlphaSynth`, SoundFont, `IAlphaSynth` | Gestione risorse; qualità timbrica da verificare all'ascolto. |
| Backing sincronizzata | `BackingTrack`, sync point, modalità media esterno | Preparazione dell'allineamento; sintesi simultanea non inclusa. |
| Timeline, tempo, loop, replay | Posizione, velocità, range, loop ed eventi | Un solo proprietario del trasporto applicativo; coordinamento di seek, fine brano e discontinuità fra sorgenti. |
| Mixer | `masterVolume`, `changeTrackVolume()`, `changeTrackMute()`, `changeTrackSolo()` per la sintesi | Mixer di synth, file e ingresso; routing, bus, effetti. Mute/solo delle parti non separano strumenti in una backing già mixata. |
| Chitarra USB/ASIO, raw/processed | Nessun contratto di ingresso musicale individuato | Acquisizione, selezione canali, monitoring, registrazione e driver nell'host. Raw e processed simultanei dipendono dai canali esposti dall'hardware. |
| Pitch/time processing | `changeTrackTranspositionPitch()` per note sintetizzate; velocità di playback | Trasposizione MIDI non è pitch shifting di un file. DSP audio e qualità del time stretching esterni; la backing browser delega `playbackRate` all'elemento audio. |
| Analisi note e VST3 | Modello note ed eventi utilizzabili come riferimento atteso | Rilevamento pitch/onset, compensazione latenza, scoring e hosting VST3 esterni. |

## Motore audio esterno: possibilità e criticità

**Percorso PCM pubblico:** un adattatore `ISynthOutput` riceve `addSamples(Float32Array)` e fornisce `sampleRate`, `sampleRequest`, `samplesPlayed`, reset e controllo del dispositivo. Il synth produce due canali (`SynthConstants.AudioChannels`); l'interfaccia non offre stem separati per traccia. Il motore esterno può consumare il PCM insieme a backing e chitarra. Deve rispettare buffering, conteggio dei campioni consumati, seek e threading: non è sufficiente inoltrare chiamate play/pause. Questo consente composizione senza modificare alphaTab, ma non dimostra che il synth soddisfi requisiti di elaborazione hard real-time.

**Percorso MIDI pubblico:** `MidiFileGenerator`, `IMidiFileHandler`, `MidiFile` e `toBinary()` consentono sintesi/scheduling esterni. Occorre preservare tempo, ripetizioni, automazioni ed effetti: gli eventi alphaTab includono estensioni e bend per nota; `AlphaSynthMidiFileHandler(..., true)` produce compatibilità SMF1 con possibili perdite sui bend simultanei, esplicitate anche da `AlphaTabApi.downloadMidi()`. `midiEventsPlayed` è una notifica, non un flusso anticipato per alimentare un altro synth.

Con clock distinti restano rischi di drift, jitter, latenza diversa e seek non atomici. Aggiornare ripetutamente `tickPosition` di un synth in esecuzione non costituisce una garanzia di sincronizzazione continua. La scelta fra PCM di alphaTab, esecuzione MIDI esterna ed eventuale audio prerenderizzato resta aperta; nessun framework UI o motore audio è imposto dall'analisi.

## Piattaforme e possibili estensioni upstream

La versione web usa DOM, Web Workers e Web Audio; AudioWorklet richiede il contesto sicuro secondo `BrowserUiFacade.createWorkerPlayer()`. Font, SoundFont e script worker/worklet devono essere distribuibili nell'host. `packages/alphatab/src/alphaTab.main.ts` segnala esplicitamente worker/worklet non supportati in Node.js: rendering/parsing headless non implicano playback Node pronto all'uso. L'accesso `getUserMedia()` individuato nell'output web serve ai permessi per enumerare dispositivi di uscita, non implementa acquisizione della chitarra.

Sono presenti port .NET e Kotlin, con TypeScript come sorgente di riferimento. Il core `packages/csharp/src/AlphaTab/AlphaTab.csproj` dichiara `netstandard2.0`; `packages/csharp/src/AlphaTab.Windows/AlphaTab.Windows.csproj` è Windows e include WPF/WinForms. `packages/csharp/src/AlphaTab.Windows/NAudioSynthOutput.cs` usa `DirectSoundOut`, non ASIO. Kotlin include adattatori Android; ciò non prova un adattatore desktop per ogni OS. Disponibilità di backend nativi, distribuzione e parità operativa dei port richiedono verifiche specifiche.

**Nessun requisito elencato dimostra la necessità di modificare alphaTab**, se la composizione audio è esterna. Potrebbero richiedere una nuova API upstream, qualora fossero vincoli obbligatori: adattamento live del synth ai sync point, stem PCM per traccia da una singola istanza, scheduling con timestamp/clock condiviso nel player standard, iniezione diretta dell'output nell'`AlphaTabApi` browser senza facciata personalizzata. Sono capacità aggiuntive rispetto ai contratti osservati, non motivi già accertati per un fork.

Il manifest dichiara MPL-2.0; distribuzione e licenze degli asset restano da valutare sul prodotto concreto. L'attribuzione grafica deve rimanere visibile secondo il file `AGENTS.md` del checkout upstream esaminato; rimozione o occultamento richiedono il permesso dei maintainer. Le UI personalizzate devono preservarla.

## Quanto non è verificato staticamente

Non sono accertati: accuratezza dell'import su un corpus reale, resa grafica nell'host desktop, qualità musicale degli effetti, codec effettivamente disponibili, precisione e continuità dei loop, sincronizzazione a lungo termine, latenza end-to-end, stabilità a buffer ridotti, accesso ASIO/USB e canali raw/processed, affidabilità del bridge fra runtime, carico CPU o comportamento dei plugin futuri. I test presenti in `packages/alphatab/test/audio/` documentano scenari ma non sono stati eseguiti. Le conclusioni di fattibilità riguardano i punti di integrazione osservati; non certificano prestazioni o compatibilità del prodotto finale.
