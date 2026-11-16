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
