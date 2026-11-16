# Fixture M4 — mixer sintetizzato

**Stato del 16 novembre 2026: fixture sperimentali con problemi aperti.**
Le descrizioni sotto esprimono l'intento del generatore, non un roundtrip
confermato. La lettura di `m4-mixer-linked.gp` con alphaTab 1.9.0 restituisce
canali distinti 0/1, 2/3, 4/5: non esercita la condivisione richiesta.
Sono state osservate note/voci duplicate e programma letto 25 invece di 80;
il generatore usa più chiamate `loadAlphaTex`, con possibili collisioni di ID.
Il test audio fallisce dopo unmute; causa non chiusa. Non rigenerare questi
file automaticamente né descriverli come validati. Dettagli in
[SESSION_HANDOFF.md](../../docs/SESSION_HANDOFF.md).

Fixture originali del progetto, generate con le API pubbliche di alphaTab
1.9.0 tramite `packages/alphatab-adapter/test/generate-m4-mixer.mjs`.
Nessun file del corpus upstream è modificato o copiato.

Entrambe contengono 32 battute 4/4 a 120 BPM, con tre voci sintetiche sostenute
su altezze diverse. I nomi sono Low voice, Middle voice e High voice.
I volumi GP iniziali sono 12/16 (75%); il programma MIDI è 80. La fixture serve
alle misure del grafo audio e dei controlli, non alla valutazione timbrica.

- `m4-mixer.gp`: canali distinti 0/1, 2/3 e 4/5.
  SHA-256: `49e0bcfe4a74fc6019ee6c3e5d6b3558871ade42f09b13328ebae0fcf4fe3e74`.
- `m4-mixer-linked.gp`: le prime due voci condividono 0/1; la terza usa 4/5.
  SHA-256: `9e07d02946d5d220844181def9cc46dbb6f96b5f8e54f422a0349a77b22278a3`.

Rigenerazione volontaria dalla root:

```sh
node packages/alphatab-adapter/test/generate-m4-mixer.mjs
```

La suite legge i file versionati; non li rigenera automaticamente.
