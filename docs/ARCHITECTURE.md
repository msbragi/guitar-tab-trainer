# Guitar Tab Trainer — Architettura

## Stato e principi

M0–M3 completate. M4 Playback & Fretboard funzionalmente completata,
con rifiniture e verifiche manuali aperte. M5 Guitar Capture & Play Session
e M6 Storage & Projects sono le prossime milestone della roadmap.
[Roadmap e attività](../TODO.md)

- alphaTab è una dipendenza esterna utilizzata attraverso API pubbliche.
- Il core TypeScript mantiene contratti, stato e politiche indipendenti da Angular.
- UI, accesso ai dati musicali e processing audio hanno responsabilità distinte.
- I file Guitar Pro originali vengono preservati.
- L'applicazione è orientata all'uso locale/offline e a moduli piccoli con interfacce esplicite.

## Architettura implementata

| Modulo | Responsabilità |
|---|---|
| `packages/core` | Caricamento, trasporto e mixer attraverso controller e port. TypeScript indipendente da Angular, DOM, alphaTab e storage concreto. |
| `packages/alphatab-adapter` | Parsing, rendering, player e mixer del synth. Proiezione dei dati musicali per la fretboard, compresi gli effetti. |
| `apps/web` | UI Angular, composizione in ScoreSession, preferenze e recupero della sessione corrente. Disegno della fretboard e interazione utente. |

Le dipendenze sono UI → core/adapter e adapter → core/alphaTab.
I tipi musicali di alphaTab rimangono nell'adapter.
La UI riceve dati di presentazione senza riferimenti al modello della libreria.
`pnpm check:boundaries` verifica i confini degli import.

L'ambiente attuale è un'app Angular nel browser, sviluppata in Debian WSL2.
Versioni fissate nei manifest e nel lockfile, con alphaTab 1.9.0.
I componenti Angular hanno cartelle dedicate con TypeScript, HTML e CSS separati.
Il target desktop Windows e il relativo runtime richiedono una scelta futura.
Le directory riservate audio-engine e study-project restano predisposizioni.

## Playback e visualizzazione M4

Il player sintetizzato di alphaTab è l'autorità temporale della sorgente M4.
TransportController mantiene lo stato applicativo e convalida i comandi.
Il synth è forzato anche per GP con una backing incorporata.
Asset audio, font e licenze vengono distribuiti localmente.

La timeline usa tick della sequenza eseguita, incluse ripetizioni e finali.
Millisecondi e tempo effettivo provengono dal player. Le coordinate della
notazione sono risolte nell'adapter. I seek espliciti attraversano il core
e rispettano il range A/B, con B esclusivo.
Da fermo vengono filtrate le notifiche di posizione automatiche tardive.

Il mixer agisce tramite le API del synth. I controlli audio delle tracce con
canali MIDI condivisi sono collegati. La visibilità delle parti è indipendente
da mute/solo. La selezione della fretboard è locale al suo pannello.

La fretboard deriva posizioni, destinazioni e avanzamento dai tick confermati.
Disegna anteprime e articolazioni con una proiezione didattica dei dati del GP.
Preparazione audio, rendering e gestione degli errori hanno lifecycle distinti.
Comportamento, verifiche e limiti sono descritti in [M4_PLAYBACK.md](M4_PLAYBACK.md).

## Ripristino corrente M4

IndexedDB conserva una sola copia dei byte originali dell'ultimo GP caricato
con successo e uno snapshot associato. Al refresh vengono ricreati documento
e player, applicando lo stato attraverso i controller, senza autoplay.
LocalStorage conserva le preferenze leggere.

Lo snapshot include posizione, A/B, velocità, mixer, vista/zoom e tracce nascoste.
Il salvataggio accorpa gli aggiornamenti e tenta un flush alla chiusura.
Permessi, quota e cancellazione dei dati del browser possono limitarne il recupero.
La sostituzione atomica e l'identificatore del documento proteggono
l'associazione fra byte e stato, anche in presenza di scritture tardive.

## Direzione M5 — Guitar Capture & Play Session

M5 aggiungerà il ciclo di selezione della frase, accompagnamento originale,
acquisizione limitata al segmento e conversione Audio → MIDI/tablatura.
Il playback potrà iniziare prima del segmento di registrazione.
Battute della notazione, occorrenze di esecuzione e intervallo audio dovranno
essere correlati esplicitamente, soprattutto in presenza di ripetizioni.

Il motore di conversione sarà sostituibile. Hendrix è il primo candidato
da valutare per compatibilità, qualità, licenza ed esigenze di esecuzione.
La fretboard diventerà anche uno strumento per verificare e correggere
le note convertite. L'originale e le varianti manterranno identità separate.

Contratti aggiuntivi, percorso di acquisizione, clock e gestione della latenza
saranno definiti in base al primo incremento concordato.
Il trasporto M4 costituisce la base esistente e richiede validazione
nell'integrazione con l'acquisizione. [Avvio M5](M5_START.md)

## Direzione M6 — Storage & Projects

M6 progetterà la conservazione persistente di brani, sessioni di lavoro,
registrazioni e varianti. La tecnologia rimane aperta.
SQLite e filesystem erano ipotesi iniziali, conservate nello storico.
La decisione su IndexedDB M4 riguarda il recupero corrente nel browser.

I criteri includeranno uso locale/offline, dimensioni degli audio,
relazioni fra originali e varianti e recuperabilità delle risorse.
Il modello persistente e le sue interfacce saranno definiti nella milestone.
[Storico delle decisioni](HISTORY.md)
