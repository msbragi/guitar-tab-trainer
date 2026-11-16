# Corpus di integrazione alphaTab

Quattro fixture tecnici copiati senza modifiche dal repository ufficiale
[CoderLine/alphaTab, tag v1.9.0](https://github.com/CoderLine/alphaTab/tree/v1.9.0),
commit `9f1aa10460df1b326123d28a2222f7b20d081e61`.
Licenza upstream MPL-2.0: testo originale in [LICENSE](LICENSE).

Percorso upstream: `packages/alphatab/test-data/` seguito dal percorso indicato
in `../corpus.ts`. Quel file contiene anche hash SHA-256 e metadati attesi.

| Fixture | Scopo |
|---|---|
| `notes.gp3` | Importazione formato GP3 e note di base |
| `repeat-close-alternate-endings.gp5` | Visualizzazione di ripetizioni e finali alternativi |
| `staves.gp5` | Tre tracce, notazione e tablatura |
| `effects.gp` | Formato GP7, 32 battute con effetti |

I test verificano parsing, metadati, integrità dei file e presenza del rendering
SVG nel browser. Non certificano la fedeltà grafica o musicale di ogni effetto,
la compatibilità di tutti i file GP o alcuna funzione di playback.
I fixture non vengono distribuiti tra gli asset dell'applicazione.
