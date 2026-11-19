# M5 — Guitar Capture & Play Session

Stato iniziale della milestone. La baseline è M4 Playback & Fretboard,
funzionalmente completata e ancora soggetta a rifiniture e verifiche manuali.
[Roadmap](../TODO.md) · [Architettura](ARCHITECTURE.md) · [Handoff](SESSION_HANDOFF.md)

## Primo incremento — selezione guidata e frammento

Implementata la UX concordata, con verifica UI/ascolto dell'utente ancora aperta.

1. «Practice a phrase», accanto alle modalità Score/Tab/Notation, avvia la scelta.
2. «Seleziona la battuta iniziale»: il click identifica anche la traccia.
3. «Seleziona la battuta finale»: il secondo click completa la frase. La fine
   può coincidere con l'inizio; una fine precedente viene rifiutata.
4. Una barra compatta conferma traccia e battute e permette di scegliere contesto
   precedente e conteggio di una battuta, anche insieme. I passaggi vengono
   richiesti solo per battute ripetute. All'inizio del brano il conteggio è
   selezionato inizialmente e resta disattivabile.
5. «Inizia pratica» mostra il frammento nella stessa cornice, senza autoplay.
6. Nella toolbar «Fine pratica» prende il posto del comando iniziale: ferma,
   cancella il conteggio, ripristina la partitura completa e azzera la sessione.
   Durante la scelta lo stesso posto offre «Annulla»; è possibile ricominciare.

La selezione è evidenziata direttamente sulla partitura; i click della scelta
non effettuano seek. Il primo click identifica la traccia, il secondo soltanto
la battuta finale. I click sul frammento rispettano le occorrenze di esecuzione
selezionate. La rappresentazione della frase mantiene i numeri di battuta e le
ripetizioni della notazione originale, senza riscrivere o svolgere il GP.

Il ritaglio usa display.startBar/barCount pubblici di alphaTab 1.9: stesso
modello musicale e stesso player. La finestra visuale include il contesto e
la frase. Se l'esecuzione attraversa salti/ripetizioni, copre l'intervallo
scritto minimo che contiene le battute coinvolte; non è una copia lineare
delle occorrenze. Mute, solo e visibilità restano quelli scelti dall'utente.
L'accompagnamento è il synth del GP, non una backing audio reale.

IN è l'inizio della prima battuta; OUT è la fine esclusiva dell'ultima.
I controlli di trasporto esistenti lavorano sul frammento: Play prova una passata
con la preparazione scelta, pausa riprende, stop torna all'inizio del contesto.
Timeline e click restano nel range della sessione; A/B sono conservati ma i
controlli loop sono disabilitati durante la pratica. Fine pratica li riabilita.
La sessione non è persistita: cambio documento e refresh riaprono il brano intero.

Il modulo browser practice/count-in.ts, indipendente da Angular, schedula click
Web Audio al tempo, metrica e velocità dell'inizio effettivo del playback,
compreso l'eventuale contesto. Stop, navigazione e cambio documento annullano
le callback tardive. Il passaggio al player avviene tramite callback browser:
continuità acustica e latenza richiedono ascolto, senza garanzie al campione.
Non viene usato il count-in nativo alphaTab per evitare di confondere le sue
posizioni temporanee con i tick del brano e il recupero corrente M4.
Il normale stop alphaTab comprende il comportamento delle code del synth:
questa prova non certifica ancora confini di registrazione acustici.

Verifiche automatiche: build e confini, 46 test Node mirati su selezione,
occorrenze reali alphaTab, conservazione del modello durante il ritaglio,
selezione senza seek, lifecycle/reset e recupero dopo errori, conteggio e M4.
Nessuna nuova suite browser eseguita. Provare manualmente i due click,
annullamento/ricomincia, ritaglio, zoom, ripetizioni, conteggio con/senza
contesto, Fine pratica e successivo riavvio del flusso.

Restano step distinti: registrazione simulata, applicazione della variante alla
copia di lavoro e undo, poi acquisizione e trascrizione. Nessun audio è acquisito
in questo incremento e i GP originali non sono riscritti.

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
