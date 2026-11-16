# Guitar Tab Trainer — Requirements

## 1. Obiettivo

Realizzare un'applicazione modulare per lo studio della chitarra, utilizzando alphaTab come motore musicale.

L'applicazione è principalmente destinata alla lettura e all'esecuzione di tablature, non alla composizione musicale.

Il progetto ha anche un secondo obiettivo: sperimentare lo sviluppo di un'applicazione completa attraverso agenti IA, mantenendo il controllo umano sulle decisioni architetturali e sulla verifica dei risultati.

## 2. Requisiti funzionali

### 2.1 Tablature

- Importazione di file Guitar Pro supportati da alphaTab.
- Visualizzazione di tablature e, opzionalmente, notazione musicale.
- Evidenziazione della posizione corrente durante il playback.
- Navigazione per battuta e posizione musicale.
- Selezione delle tracce da visualizzare e riprodurre.

### 2.2 Playback

- Riproduzione sintetizzata delle parti musicali.
- Play, pausa, stop e seek.
- Controllo della velocità.
- Selezione di intervalli e loop A/B.
- Ripetizione di sezioni per esercitazione.

### 2.3 Backing track

- Caricamento di file audio locali.
- Sincronizzazione con la tablatura.
- Playback simultaneo di backing track e parti sintetizzate.
- Regolazione indipendente dei volumi.
- Gestione dei punti di sincronizzazione.

### 2.4 Audio esterno

- Selezione del dispositivo audio.
- Acquisizione della chitarra tramite interfaccia USB o scheda audio.
- Supporto a canali raw e processed, quando disponibili.
- Monitoring e mixing con la backing track.
- Supporto ASIO su Windows, da progettare e verificare.

### 2.5 Progetti di studio

Ogni progetto di studio rappresenta un brano o un esercizio e può contenere:

- Riferimento alla tablatura originale.
- Una o più risorse audio associate.
- Punti di sincronizzazione.
- Loop e sezioni salvate.
- Configurazione audio.
- Sessioni e progressi di studio.

I file Guitar Pro originali non devono essere modificati.

## 3. Persistenza

L'applicazione deve funzionare offline.

Storage previsto:

- File system locale per risorse musicali e audio.
- SQLite per catalogo, configurazioni e metadati.
- Possibile esportazione e importazione dei progetti di studio.

## 4. Evoluzioni future

- Pitch shifting delle backing track.
- Time stretching con conservazione dell'intonazione.
- Rilevamento delle note suonate.
- Confronto tra esecuzione e tablatura.
- Virtual Rig con amplificatori ed effetti VST3.
- Preset e catene di effetti.
- Possibile supporto web e mobile.

Queste funzionalità non appartengono al primo milestone.

## 5. Requisiti non funzionali

- Architettura modulare ed estensibile.
- Indipendenza tra UI, orchestratore e Audio Engine.
- Utilizzo di alphaTab attraverso API pubbliche.
- Nessuna modifica ai sorgenti alphaTab salvo necessità dimostrata.
- Funzionamento locale senza servizi cloud obbligatori.
- Tempi di risposta e latenza adeguati allo studio musicale.
- Test automatici per la logica applicativa.
- Compatibilità iniziale con Windows come piattaforma di esecuzione.
- Sviluppo in ambiente Debian WSL2.

## 6. Perimetro iniziale

La prima versione deve dimostrare:

1. Importazione e rendering di una tablatura.
2. Riproduzione sintetizzata.
3. Caricamento di una backing track.
4. Riproduzione simultanea e sincronizzata.
5. Controllo di posizione, velocità e loop.

Il successo del prototipo dipenderà soprattutto dalla qualità e stabilità della sincronizzazione audio.
