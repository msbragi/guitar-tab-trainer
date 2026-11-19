# M5 — Guitar Capture & Play Session

Stato iniziale della milestone. La baseline è M4 Playback & Fretboard,
funzionalmente completata e ancora soggetta a rifiniture e verifiche manuali.
[Roadmap](../TODO.md) · [Architettura](ARCHITECTURE.md) · [Handoff](SESSION_HANDOFF.md)

## Flusso da realizzare progressivamente

1. Scegliere un intervallo di battute e creare una sessione di lavoro
   mantenendo l'accompagnamento originale.
2. Avviare il playback anche prima dell'intervallo selezionato.
3. Acquisire la chitarra reale e limitare la registrazione al segmento desiderato.
4. Convertire l'audio acquisito in eventi musicali e tablatura.
5. Verificare e correggere le note attraverso la fretboard.
6. Conservare separatamente la frase originale e le varianti dell'esecuzione.

Il loop A/B e il recupero della sessione corrente M4 sono basi già presenti.
Selezione di una frase per il lavoro, registrazione e correzione delle note
richiedono funzionalità aggiuntive.

## Prima analisi

Concordare un piccolo incremento verificabile prima di scegliere nuove
dipendenze o modificare contratti.

- Definire come l'utente seleziona il segmento, il contesto di playback
  precedente e l'accompagnamento da mantenere.
- Chiarire l'intervallo di registrazione quando la partitura contiene ripetizioni.
- Verificare acquisizione, dispositivi e permessi nell'ambiente attuale.
- Valutare allineamento della registrazione, offset/latenza e arresto ai confini.
- Identificare il progetto Hendrix esatto e valutarne API, licenza,
  compatibilità, qualità e necessità di risorse o servizi esterni.
- Definire i risultati musicali minimi da verificare e correggere sul manico.
- Mantenere sostituibile il motore Audio → MIDI e distinte originale e varianti.

Hendrix è il primo candidato da valutare. Il repository attuale non contiene
un'integrazione o una validazione di quel motore. La sua fattibilità resta
una domanda dell'analisi M5.

## Verifica del primo incremento

Proporre una frase breve e riproducibile, la modalità di acquisizione e i
criteri di accettazione. Le verifiche dovranno distinguere i confini temporali
della registrazione dalla correttezza delle note trascritte.
Documentare configurazione, risultati e limiti effettivi.

Procedere per incrementi concordati, preservando i confini tra UI, core,
adapter alphaTab e acquisizione/conversione audio. La gestione persistente
dei progetti e la scelta dello storage saranno affrontate in M6.
Lo [storico](HISTORY.md) conserva le precedenti ipotesi sui percorsi audio.
