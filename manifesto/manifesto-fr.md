# Le Manifeste de l'Inconnu

**La confiance qui exige une adhésion n'est pas de la confiance. C'est une liste d'invités.**

Quand des agents négocient avec le monde — achètent, vendent, appellent des tools, signent des intentions — quelqu'un essaiera toujours de vous vendre la réponse à une question : *puis-je faire confiance à ceci ?*

Nous refusons de la vendre. Nous publions la preuve. Voici les règles selon lesquelles nous construisons :

**1. Un inconnu doit pouvoir vérifier.**
Si la preuve exige d'être dans le réseau — adhésion, clé, relation — c'est une permission, pas une preuve. La permission, c'est très bien. Ne l'appelez pas confiance.

**2. Échouer fermé.**
Quand la preuve manque, est périmée ou invérifiable, la réponse est *non*. L'absence de preuve n'est pas une preuve d'innocence ; c'est une question sans réponse — et une question sans réponse n'autorise pas l'argent.

**3. Tester celui qui teste.**
Le vérificateur fait partie de l'affirmation. Un moteur de notation que personne ne sonde est une preuve non prouvée. Nous exécutons notre propre runner contre des mutants qui tentent de le vaincre — et nous publions les résultats.

**4. La vérité dérive des octets.**
Les métadonnées mentent. Les sidecars mentent. Les tableaux de bord mentent. Les signatures sur des octets canoniques ne se laissent pas convaincre de changer de position. La vérité se dérive, elle ne se déclare pas.

**5. La fraîcheur est bilatérale.**
Une créance datée du futur est aussi cassée qu'une créance du passé. Une fenêtre a une borne inférieure et une borne supérieure. Vérifiez les deux, ou ne vérifiez rien.

**6. La révocation fait partie de l'émission.**
Publier une preuve sans publier comment la dé-publier, c'est publier une demi-promesse. Clés, runners et politiques doivent être révocables — et un vérificateur déconnecté doit pouvoir se mettre à jour avec une seule note signée.

**7. Les ancres vivent hors du contrôle de celui qui ancre.**
Le registre de ce qui a été publié doit vivre là où l'éditeur ne peut pas le réécrire. Nous ancrons chaque release dans un journal public de transparence (Rekor / Sigstore) dont les preuves d'inclusion se vérifient contre des clés que nous ne détenons pas.

**8. Pas de clé, pas de portail.**
Une vérification qui exige une clé API est une vérification qu'on peut éteindre, renchérir ou journaliser. La vérification doit tourner hors ligne, sans clé, en millisecondes, sur n'importe quel appareil.

**9. Reproductible, ou cela n'est pas arrivé.**
Si un inconnu ne peut pas reconstruire l'artefact depuis la source publique et obtenir les mêmes octets, l'artefact est un acte de foi. Les nôtres, nous les reconstruisons octet par octet et le prouvons.

**10. Des reçus, pas des feuilles de route.**
Une promesse, c'est du marketing. Un reçu, c'est un checksum dans un journal que personne ne peut éditer. Montrez les commandes, pas la diapositive.

N'importe qui peut nous auditer. Voici les commandes.

— **AliceLabs / MarketNow**, 09/09/2026

**Vérifiez tout dans ce manifeste :**
- Suite de conformance (14 vecteurs, 24 contrôles, 10 mutants) : https://www.marketnow.site/uta/conformance/
- Ancres Rekor (append-only, tiers) : https://www.marketnow.site/uta/conformance/anchors/
- Build reproductible : https://www.marketnow.site/uta/conformance/repro/
- Code : https://github.com/alicelabs-llc/universal-trust-adapter
