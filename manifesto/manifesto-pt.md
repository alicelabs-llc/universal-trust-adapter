# O Manifesto do Estranho

**Confiança que exige membership não é confiança. É lista de convidados.**

Quando agentes negociam com o mundo — compram, vendem, chamam tools, assinam intenções — sempre vai aparecer alguém tentando te vender a resposta de uma pergunta: *posso confiar nisso?*

Nós nos recusamos a vendê-la. Publicamos a evidência. Estas são as regras com que construímos:

**1. Um estranho precisa poder verificar.**
Se a prova exige estar dentro da rede — membership, chave, relacionamento — é permissão, não prova. Permissão é ok. Só não chame de confiança.

**2. Falhar fechado.**
Quando a evidência falta, está velha ou não dá pra verificar, a resposta é *não*. Ausência de evidência não é evidência de inocência; é uma pergunta sem resposta — e pergunta sem resposta não autoriza dinheiro.

**3. Testar quem testa.**
O verificador é parte da afirmação. Um motor de pontuação que ninguém sonda é uma prova não provada. Rodamos nosso próprio runner contra mutantes que tentam derrotá-lo — e publicamos os resultados.

**4. A verdade deriva dos bytes.**
Metadata mente. Sidecar mente. Dashboard mente. Assinaturas sobre bytes canônicos não dão conversa pra mudar de posição. Verdade se deriva, nunca se declara.

**5. Frescor é dos dois lados.**
Uma credencial datada no futuro está tão quebrada quanto uma do passado. Janela tem limite inferior e limite superior. Cheque os dois, ou não cheque nada.

**6. Revogação é parte da emissão.**
Publicar uma prova sem publicar como des-publicá-la é publicar meia promessa. Chaves, runners e políticas precisam ser revogáveis — e um verificador desconectado precisa conseguir se atualizar com uma única nota assinada.

**7. Âncoras vivem fora do controle de quem ancora.**
O registro do que foi publicado precisa morar onde o publicador não consiga reescrever. Ancoramos cada release num log público de transparência (Rekor / Sigstore) cujas provas de inclusão verificam contra chaves que a gente não possui.

**8. Sem chave, sem portão.**
Verificação que exige API key é verificação que pode ser desligada, encarecida ou logada. Verificação precisa rodar offline, sem chave, em milissegundos, em qualquer dispositivo.

**9. Reproduzível ou não aconteceu.**
Se um estranho não consegue reconstruir o artefato a partir de fonte pública e obter os mesmos bytes, o artefato é artigo de fé. Os nossos a gente recompõe byte a byte e prova.

**10. Recibos, não roadmaps.**
Promessa é marketing. Recibo é um checksum num log que ninguém edita. Mostra os comandos, não o slide.

Qualquer um pode nos auditar. Estes são os comandos.

— **AliceLabs / MarketNow**, 2026-09-09

**Verifique tudo neste manifesto:**
- Suite de conformance (14 vetores, 24 checks, 10 mutantes): https://www.marketnow.site/uta/conformance/
- Âncoras Rekor (append-only, terceiros): https://www.marketnow.site/uta/conformance/anchors/
- Build reproduzível: https://www.marketnow.site/uta/conformance/repro/
- Código: https://github.com/alicelabs-llc/universal-trust-adapter
