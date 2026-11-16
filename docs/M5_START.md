# M5 — Ripartenza e piano di analisi

Preparato il **16 novembre 2026** per la prossima sessione.
M4 è la baseline accettata dall'utente dopo prova manuale. La sua suite browser
ha ancora quattro casi aperti, descritti nell'handoff. **M5 non implementata.**

## Prompt da incollare nella nuova conversazione

```text
Riprendiamo Guitar Tab Trainer dalla fase M5.

Leggi AGENTS.md, TODO.md, docs/SESSION_HANDOFF.md, docs/ARCHITECTURE.md,
docs/M4_PLAYBACK.md e docs/M5_START.md.

M4, inclusi mixer, tooltip e barra compatta, è stata provata manualmente
con riscontro positivo. Conserva le modifiche non committate. La suite
browser non è tutta verde: leggi i quattro casi aperti nell'handoff,
senza riprendere automaticamente una lunga campagna di test M4.
Preferisco provare l'app direttamente.

Per M5 inizia con analisi e un piano sintetico: confronta PCM alphaTab,
MIDI esterno e prerendering per audio esterno e trasporto condiviso.
Ricontrolla le API pubbliche sulla dipendenza effettiva alphaTab 1.9.0;
l'analisi storica riguarda 1.10.0. Definisci opzioni per il clock autorevole,
unità temporali, seek/loop/cambi di velocità e misure di drift/latency.
Proponi rischi, dipendenze, scenari e soglie di accettazione da concordare.

Non scegliere né implementare un nuovo percorso audio o cambiare core,
librerie o moduli prima di aver concordato il piano. Le correzioni semplici
UI/CSS possono invece procedere dopo l'analisi, se pertinenti al task.
Non implementare M6, backing sincronizzata completa, ASIO/VST3, SQLite o
runtime desktop. Non fare commit/push e non fermare il mio server sulla 4200.
```

## Obiettivo M5

Prototipo e decisione tecnica per audio esterno e trasporto condiviso, prima
che M6 realizzi la backing sincronizzata. Il risultato è una scelta motivata
con misure riproducibili, non l'espansione anticipata di rig/storage/desktop.

L'attuale `TransportPort` è un contratto minimo M4: non è già un contratto
validato multisorgente. Il player integrato è il riferimento temporale M4;
non assumere che debba diventare il clock di tutte le future sorgenti.

## Confronto da preparare

| Percorso candidato | Domande da verificare sulla 1.9.0 |
|---|---|
| PCM del synth alphaTab tramite output pubblico | Disponibilità effettiva di `ISynthOutput`/synth; buffering, consumo campioni, reset, threading e integrazione con un unico output/clock. |
| MIDI generato da alphaTab e synth esterno | API esportate, scheduling anticipato, automazioni/tempo/ripetizioni, fedeltà di bend ed effetti, costo di una nuova dipendenza. |
| Prerendering audio | API effettive, tempi/memoria, riproduzione da clock unico, invalidazione per cambi di traccia, velocità e personalizzazioni. |

L'analisi in `docs/ALPHATAB_ANALYSIS.md` è un punto di partenza statico su
1.10.0, non una certificazione di questi percorsi sulla 1.9.0. Non importare
classi `@internal` solo perché visibili nel bundle; nessun fork o deep import
non pubblico. `playerPositionChanged`/`midiEventsPlayed` sono notifiche,
non un contratto di scheduling audio sample-accurate.

## Decisioni da concordare prima del prototipo

- Target del prototipo: ambiente browser attuale o necessità reale di altro
  host; nessun runtime desktop già scelto.
- Sorgenti indispensabili per la misura e formato delle risorse locali.
  Sintesi + backing simultanee sono il caso da rendere fattibile, non una
  capacità già fornita dal player integrato.
- Unica autorità temporale, clock e unità; differenza fra tempo della partitura,
  sequenza ripetuta, secondi del media e campioni effettivamente consumati.
- Trattamento di latenza iniziale/offset costante rispetto al drift nel tempo.
- Seek, stop, loop, cambi di velocità e tempo: come resettare buffer e
  riavviare le sorgenti senza clock concorrenti o correzioni periodiche di tick.
- Impatto sui contratti core/adapter e responsabilità di un eventuale futuro
  pacchetto audio, senza creare infrastruttura prima della scelta.
- Necessità e licenze di nuove dipendenze: proporle prima di installarle.

## Piano sperimentale da proporre

1. Verifica statica delle API pubbliche installate e piccola matrice di fattibilità.
2. Raccomandazione motivata di un percorso sperimentale e confronto con alternative.
3. Approvazione del perimetro e aggiornamento TODO prima dell'implementazione.
4. Prototipo minimo isolato, mantenendo funzionante la baseline M4.
5. Misure e relazione: risultato, limiti e decisione prima di stabilizzare contratti.

Scenari candidati: avvio/pausa/ripresa, seek avanti/indietro, loop ripetuti,
partiture con ripetizioni e cambi di tempo, velocità diverse e riproduzione
prolungata. Definire insieme durate, browser/hardware, frequenza campionamento,
carico e soglie **numeriche** prima di misurare; non inventare un criterio
sample-accurate o usare l'animazione UI come misura dell'audio.

Metriche candidate: offset iniziale fra sorgenti, drift dopo durata concordata,
errore dopo seek/loop, discontinuità e stabilità sotto carico. Registrare
strumentazione, risorse, configurazione e numero di ripetizioni per rendere
il risultato riproducibile. Proporre poche verifiche mirate: l'utente preferisce
collaudo manuale dell'app e ha chiesto di interrompere le lunghe suite browser.

## Criterio di uscita M5

Confronto documentato, percorso approvato, clock/unità definiti, soglie
concordate e misure riproducibili rispetto a quelle soglie. Se il percorso
non soddisfa i criteri, documentare il limite e l'alternativa da valutare.
M6 parte soltanto dopo questa decisione; non dichiarare già sincronizzate
sorgenti che hanno solo ricevuto gli stessi comandi play/seek.
