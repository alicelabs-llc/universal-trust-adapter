# Das Manifest des Fremden

**Vertrauen, das eine Mitgliedschaft verlangt, ist kein Vertrauen. Es ist eine Gästeliste.**

Wenn Agenten mit der Welt verhandeln — kaufen, verkaufen, Tools aufrufen, Absichten unterschreiben — wird immer jemand versuchen, dir die Antwort auf eine Frage zu verkaufen: *kann ich dem vertrauen?*

Wir weigern uns, sie zu verkaufen. Wir veröffentlichen die Beweise. Das sind die Regeln, nach denen wir bauen:

**1. Ein Fremder muss überprüfen können.**
Wenn der Beweis verlangt, im Netzwerk zu sein — Mitgliedschaft, Schlüssel, Beziehung —, ist es Erlaubnis, kein Beweis. Erlaubnis ist in Ordnung. Nenn es nicht Vertrauen.

**2. Fail closed.**
Wenn Beweise fehlen, veraltet oder nicht überprüfbar sind, lautet die Antwort *nein*. Fehlende Evidenz ist keine Evidenz für Unschuld; sie ist eine unbeantwortete Frage — und unbeantwortete Fragen autorisieren kein Geld.

**3. Prüfe den Prüfer.**
Der Verifizierer ist Teil der Behauptung. Eine Scoring-Engine, die niemand sondiert, ist ein unbewiesener Beweis. Wir lassen unseren eigenen Runner gegen Mutanten antreten, die ihn besiegen wollen — und veröffentlichen die Ergebnisse.

**4. Wahrheit leitet sich aus Bytes ab.**
Metadaten lügen. Sidecars lügen. Dashboards lügen. Signaturen über kanonische Bytes lassen sich nicht aus der Position reden. Ground Truth wird abgeleitet, nie deklariert.

**5. Freshness ist beidseitig.**
Ein Credential mit Zukunftsdatum ist so kaputt wie eins aus der Vergangenheit. Ein Fenster hat eine untere und eine obere Grenze. Prüfe beide — oder gar nichts.

**6. Widerruf ist Teil der Ausstellung.**
Einen Beweis zu veröffentlichen, ohne zu veröffentlichen, wie man ihn zurückzieht, heißt eine halbe Verheißung zu veröffentlichen. Schlüssel, Runner und Richtlinien müssen widerrufbar sein — und ein nicht verbundener Verifizierer muss mit einer einzigen signierten Notiz aufholen können.

**7. Anker leben außerhalb der Kontrolle dessen, der verankert.**
Das Protokoll des Veröffentlichten muss dort leben, wo der Herausgeber es nicht umschreiben kann. Wir verankern jedes Release in einem öffentlichen Transparenz-Log (Rekor / Sigstore), dessen Inclusion-Proofs gegen Schlüssel verifizieren, die wir nicht besitzen.

**8. Kein Schlüssel, kein Tor.**
Verifizierung, die einen API-Key verlangt, ist Verifizierung, die man abschalten, verteuern oder mitschneiden kann. Verifizierung muss offline laufen, schlüssellos, in Millisekunden, auf jedem Gerät.

**9. Reproduzierbar — oder es ist nicht passiert.**
Wenn ein Fremder das Artefakt nicht aus öffentlichem Quellcode rekonstruieren und dieselben Bytes bekommen kann, ist das Artefakt ein Glaubensartikel. Unsere rekonstruieren wir Byte für Byte und beweisen es.

**10. Belege statt Roadmaps.**
Ein Versprechen ist Marketing. Ein Beleg ist ein Checksum in einem Log, das niemand editieren kann. Zeig die Befehle, nicht die Folie.

Jeder kann uns auditieren. Hier sind die Befehle.

— **AliceLabs / MarketNow**, 09.09.2026

**Überprüfe alles in diesem Manifest:**
- Conformance-Suite (14 Vektoren, 24 Checks, 10 Mutanten): https://www.marketnow.site/uta/conformance/
- Rekor-Anker (append-only, Dritte): https://www.marketnow.site/uta/conformance/anchors/
- Reproduzierbarer Build: https://www.marketnow.site/uta/conformance/repro/
- Quellcode: https://github.com/alicelabs-llc/universal-trust-adapter
