# Guitar Tab Trainer — Architecture

## 1. Stato

Architettura preliminare.

Le decisioni qui descritte costituiscono la base progettuale. Le scelte ancora aperte saranno risolte durante le successive fasi di analisi e prototipazione.

## 2. Principi architetturali

- alphaTab viene utilizzato come componente esterno, senza fork.
- L'applicazione possiede un proprio orchestratore.
- L'interfaccia utente è indipendente dalla logica musicale.
- Il motore audio è separato dal rendering delle tablature.
- I moduli comunicano attraverso contratti espliciti.
- Le dipendenze devono essere orientate verso interfacce stabili.
- Evitare complessità e infrastrutture non necessarie.

## 3. Stack iniziale

| Componente | Tecnologia |
|---|---|
| Ambiente di sviluppo | Debian WSL2 |
| Monorepo | pnpm workspaces |
| UI | Angular |
| Orchestratore | TypeScript |
| Music Engine | alphaTab |
| Audio Engine | Da definire |
| Database locale | SQLite |
| Desktop runtime | Da definire |

## 4. Componenti

### 4.1 UI Application

Responsabilità:

- Visualizzazione della tablatura.
- Controlli di playback.
- Mixer e configurazione.
- Gestione dei progetti di studio.
- Interazione con l'utente.

Non deve contenere direttamente logica audio o musicale complessa.

### 4.2 Application Core / Orchestrator

Responsabilità:

- Stato applicativo.
- Coordinamento dei moduli.
- Gestione del trasporto musicale.
- Timeline e sincronizzazione.
- Gestione dei comandi e degli eventi.
- Coordinamento delle sessioni di studio.

Non deve dipendere da Angular.

### 4.3 alphaTab Adapter

Unico punto di integrazione diretta con alphaTab.

Responsabilità:

- Caricamento e interpretazione delle tablature.
- Accesso al modello musicale.
- Rendering.
- Generazione MIDI e sintesi, secondo le API disponibili.
- Conversione degli eventi alphaTab in contratti applicativi.

Non deve contenere logica di business specifica dell'applicazione.

### 4.4 Audio Engine

Responsabilità previste:

- Gestione delle sorgenti audio.
- Clock e trasporto audio.
- Playback delle backing track.
- Integrazione dell'audio sintetizzato.
- Mixing e routing.
- Selezione dei dispositivi.
- Acquisizione e monitoring della chitarra.
- Gestione della latenza.

L'implementazione tecnologica rimane da definire.

### 4.5 Study Project

Responsabilità:

- Catalogo dei progetti.
- Metadati e configurazioni.
- Gestione delle risorse locali.
- Persistenza SQLite.
- Sessioni e progressi.
- Importazione ed esportazione dei progetti.

Lo storage fisico deve essere accessibile mediante interfacce, evitando dipendenze dirette dal framework UI.

## 5. Comunicazione tra componenti

Schema logico:

UI
↓
Orchestrator
↓
alphaTab Adapter / Audio Engine / Study Project

L'orchestratore coordina le operazioni e mantiene lo stato applicativo.

Gli eventi generati dai componenti aggiornano lo stato e vengono propagati alla UI.

## 6. Gestione del playback

Principio fondamentale:

**Deve esistere un'unica autorità per il trasporto e la posizione temporale dell'esecuzione.**

La soluzione concreta non è ancora definita.

L'analisi alphaTab ha evidenziato che:

- Parsing, rendering e sintesi sono utilizzabili separatamente.
- Sono disponibili eventi e informazioni sulla timeline.
- Il player integrato non gestisce più sorgenti audio simultanee con un clock condiviso.
- L'applicazione dovrà coordinare autonomamente il playback simultaneo.

Sono da valutare:

1. Integrazione PCM del sintetizzatore alphaTab.
2. Generazione MIDI e sintesi esterna.
3. Eventuale prerendering audio.

La scelta richiede una verifica tecnica specifica.

### 6.1 Perimetro implementato in M4

M4 usa il sintetizzatore integrato di alphaTab **1.9.0** come singola sorgente
di riferimento, forzando `PlayerMode.EnabledSynthesizer` anche in presenza di
una backing incorporata. Il player fornisce posizione e stato effettivi;
non esiste un timer applicativo che simula l'avanzamento.

`TransportController` nel core possiede l'unico stato applicativo del trasporto
e il contratto `TransportPort`. L'adapter converte gli eventi pubblici senza
mantenere un secondo stato applicativo. `ScoreSession` proietta gli snapshot
immutabili in un signal Angular e inoltra comandi; i componenti presentano
stato e controlli senza transizioni musicali autonome.

I tick appartengono alla sequenza eseguita, incluse le ripetizioni. I
millisecondi e il BPM effettivo provengono dal player alla velocità corrente;
non sono ricavati dall'indice di battuta né dal BPM iniziale. La timeline e i
punti A/B usano i tick; le coordinate della notazione restano nell'adapter.
Da fermo, il core ignora notifiche di campioni tardivi e accetta soltanto
posizionamenti espliciti (`isSeek`).

La preparazione audio è distinta dal caricamento/rendering. Errori audio
lasciano leggibile la partitura e disabilitano il trasporto; riaprire il file
ricrea la sessione. Reset/distruzione scollegano gli eventi, chiudono l'output
tramite API pubbliche e terminano i worker creati dall'adapter, senza dipendere
dall'ack di un worker guasto. Font, SoundFont e script sono asset locali.

La facciata integrata rimane interna all'adapter: questa milestone non
introduce il pacchetto Audio Engine, non certifica un clock multisorgente e
non sceglie fra PCM, MIDI esterno e prerendering. Queste decisioni restano M5,
che richiede un'approvazione separata. Dettagli e prove in
[M4_PLAYBACK.md](M4_PLAYBACK.md).

### 6.2 Mixer e stato di avanzamento

M4 include `MixerController`/`MixerPort` nel core per stato immutabile e comandi
mute/solo/volume tracce e master. L'adapter usa esclusivamente le API pubbliche
del synth alphaTab; la UI presenta lo stato. Non è un Audio Engine esterno.
Tracce che condividono canali hanno controlli collegati, con limite esplicito.

L'utente ha accettato operativamente M4 dopo prova manuale; la suite browser
ha quattro casi aperti documentati nell'handoff. M5 riparte dall'analisi in
[M5_START.md](M5_START.md): non sono ancora scelti percorso audio, clock o
nuovi contratti multisorgente. Non inferire tali scelte dal player M4.

## 7. Persistenza

Modello locale:

- SQLite per metadati e stato persistente.
- File system per tablature e risorse audio.
- Separazione tra file originali e personalizzazioni.

Il progetto di studio costituisce l'unità logica principale.

## 8. Distribuzione

Target iniziale: applicazione desktop Windows.

Sviluppo: Debian WSL2.

La scelta del contenitore desktop dovrà considerare:

- Integrazione Angular.
- Accesso ai dispositivi audio.
- Compatibilità ASIO.
- Possibile hosting VST3.
- Packaging e aggiornamenti.
- Portabilità futura.

Non è ancora stata selezionata una tecnologia desktop definitiva.

## 9. Decisioni aperte

- Implementazione dell'Audio Engine.
- Strategia di clock e sincronizzazione.
- Integrazione PCM oppure MIDI.
- Framework desktop.
- Accesso SQLite e filesystem dal runtime.
- Organizzazione dei moduli opzionali.
- Strategia di test dell'audio e della sincronizzazione.

Queste decisioni richiedono analisi o prototipi mirati prima dell'implementazione definitiva.
