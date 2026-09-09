# El Manifiesto del Desconocido

**La confianza que exige membresía no es confianza. Es una lista de invitados.**

Cuando los agentes negocian con el mundo —compran, venden, llaman herramientas, firman intenciones— alguien siempre intentará venderte la respuesta a una pregunta: *¿puedo confiar en esto?*

Nosotros nos negamos a venderla. Publicamos la evidencia. Estas son las reglas con las que construimos:

**1. Un desconocido debe poder verificar.**
Si la prueba exige estar dentro de la red —membresía, clave, relación— es permiso, no prueba. El permiso está bien. No lo llames confianza.

**2. Fallar cerrado.**
Cuando la evidencia falta, está rancia o no se puede verificar, la respuesta es *no*. La ausencia de evidencia no es evidencia de inocencia; es una pregunta sin responder, y las preguntas sin responder no autorizan dinero.

**3. Probar al que prueba.**
El verificador es parte de la afirmación. Un motor de puntuación que nadie sondea es una prueba no probada. Corremos nuestro propio runner contra mutantes que intentan derrotarlo — y publicamos los resultados.

**4. La verdad se deriva de los bytes.**
La metadata puede mentir. Los sidecars pueden mentir. Los dashboards pueden mentir. Las firmas sobre bytes canónicos no se pueden convencer de cambiar de posición. La verdad se deriva, nunca se declara.

**5. La frescura es de dos lados.**
Una credencial fechada en el futuro está tan rota como una del pasado. Una ventana tiene límite inferior y límite superior. Verifica ambos, o no verificas nada.

**6. La revocación es parte de la emisión.**
Publicar una prueba sin publicar cómo des-publicarla es publicar media promesa. Claves, runners y políticas deben ser revocables — y un verificador desconectado debe poder ponerse al día con una sola nota firmada.

**7. Las anclas viven fuera del control del ancla.**
El registro de lo publicado debe vivir donde el publicador no pueda reescribirlo. Anclamos cada release en un log público de transparencia (Rekor / Sigstore) cuyas pruebas de inclusión se verifican contra claves que no poseemos.

**8. Sin clave, sin puerta.**
La verificación que exige una API key es una verificación que se puede apagar, encarecer o registrar. La verificación debe correr offline, sin clave, en milisegundos, en cualquier dispositivo.

**9. Reproducible o no ocurrió.**
Si un desconocido no puede reconstruir el artefacto desde fuente pública y obtener los mismos bytes, el artefacto es un artículo de fe. Nosotros reconstruimos los nuestros byte a byte y lo probamos.

**10. Recibos, no hojas de ruta.**
Una promesa es marketing. Un recibo es un checksum en un log que nadie puede editar. Muestra los comandos, no la diapositiva.

Cualquiera puede auditarnos. Estos son los comandos.

— **AliceLabs / MarketNow**, 2026-09-09

**Verifica todo en este manifiesto:**
- Suite de conformance (14 vectores, 24 checks, 10 mutantes): https://www.marketnow.site/uta/conformance/
- Anclas Rekor (append-only, terceros): https://www.marketnow.site/uta/conformance/anchors/
- Build reproducible: https://www.marketnow.site/uta/conformance/repro/
- Código: https://github.com/alicelabs-llc/universal-trust-adapter
