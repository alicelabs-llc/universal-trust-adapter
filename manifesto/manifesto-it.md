# Il Manifesto dello Sconosciuto

**La fiducia che richiede membership non è fiducia. È una lista di invitati.**

Quando gli agenti negoziano con il mondo — comprano, vendono, chiamano tool, firmano intenzioni — c'è sempre qualcuno che proverà a venderti la risposta a una domanda: *posso fidarmi di questo?*

Noi ci rifiutiamo di venderla. Pubblichiamo l'evidenza. Queste sono le regole con cui costruiamo:

**1. Uno sconosciuto deve poter verificare.**
Se la prova richiede di essere dentro la rete — membership, chiave, relazione — è permesso, non prova. Il permesso va benissimo. Non chiamarlo fiducia.

**2. Fallire chiuso.**
Quando l'evidenza manca, è stantia o non verificabile, la risposta è *no*. L'assenza di evidenza non è evidenza di innocenza; è una domanda senza risposta — e le domande senza risposta non autorizzano denaro.

**3. Testare chi testa.**
Il verificatore è parte dell'affermazione. Un motore di scoring che nessuno sonda è una prova non provata. Eseguiamo il nostro runner contro mutanti che provano a sconfiggerlo — e pubblichiamo i risultati.

**4. La verità deriva dai byte.**
I metadata mentono. I sidecar mentono. Le dashboard mentono. Le firme sui byte canonici non si lasciano convincere a cambiare posizione. La verità si deriva, non si dichiara.

**5. La freschezza è a doppio verso.**
Una credenziale datata nel futuro è rotta come una del passato. Una finestra ha un limite inferiore e uno superiore. Verifica entrambi, o non verificare nulla.

**6. La revoca è parte dell'emissione.**
Pubblicare una prova senza pubblicare come ritirarla è pubblicare mezza promessa. Chiavi, runner e policy devono essere revocabili — e un verificatore disconnesso deve poter recuperare con una sola nota firmata.

**7. Le ancore vivono fuori dal controllo di chi ancora.**
Il registro di ciò che è stato pubblicato deve vivere dove l'editore non possa riscriverlo. Ancoriamo ogni release in un log pubblico di trasparenza (Rekor / Sigstore) le cui prove di inclusione si verificano contro chiavi che non possediamo.

**8. Niente chiave, niente cancello.**
La verifica che esige una API key è una verifica che si può spegnere, far costare di più o tracciare. La verifica deve girare offline, senza chiave, in millisecondi, su qualunque dispositivo.

**9. Riproducibile, o non è successo.**
Se uno sconosciuto non può ricostruire l'artefatto da sorgente pubblica e ottenere gli stessi byte, l'artefatto è un articolo di fede. I nostri li ricostruiamo byte per byte e lo dimostriamo.

**10. Ricevute, non roadmap.**
Una promessa è marketing. Una ricevuta è un checksum in un log che nessuno può modificare. Mostra i comandi, non la slide.

Chiunque può auditarci. Questi sono i comandi.

— **AliceLabs / MarketNow**, 09/09/2026

**Verifica tutto in questo manifesto:**
- Suite di conformance (14 vettori, 24 controlli, 10 mutanti): https://www.marketnow.site/uta/conformance/
- Ancore Rekor (append-only, terze parti): https://www.marketnow.site/uta/conformance/anchors/
- Build riproducibile: https://www.marketnow.site/uta/conformance/repro/
- Codice: https://github.com/alicelabs-llc/universal-trust-adapter
