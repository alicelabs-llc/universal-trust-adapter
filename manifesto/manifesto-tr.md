# Yabancının Manifestosu

**Üyelik isteyen güven, güven değildir. O bir davetli listesidir.**

Ajanlar dünyayla pazarlık ederken — satın alırken, satarken, tool çağırırken, niyet imzalarken — biri her zaman sana tek bir sorunun cevabını satmaya çalışacak: *buna güvenebilir miyim?*

Biz onu satmayı reddediyoruz. Kanıtı yayınlıyoruz. İnşa ettiğimiz kurallar bunlar:

**1. Bir yabancı doğrulayabilmeli.**
Kanıt ağın içinde olmayı gerektiriyorsa — üyelik, anahtar, ilişki — bu bir izindir, kanıt değil. İzin sorun değil. Sadece ona güven deme.

**2. Kapalı başarısızlık (fail closed).**
Kanıt eksik, bayat veya doğrulanamaz olduğunda cevap *hayır*dır. Kanıt yokluğu masumiyet kanıtı değildir; cevapsız bir sorudur — ve cevapsız sorular parayı yetkilendirmez.

**3. Test edeni test et.**
Doğrulayıcı, iddianın parçasıdır. Kimsenin yoklamadığı bir puanlama motoru, kanıtlanmamış bir kanıttır. Kendi koşucumuzu onu yenmeye çalışan mutantlara karşı çalıştırıyoruz — ve sonuçları yayınlıyoruz.

**4. Gerçek baytlardan türetilir.**
Metadata yalan söyler. Sidecar yalan söyler. Dashboard yalan söyler. Kanonik baytlar üzerindeki imzalarsa ikna edilip pozisyon değiştiremez. Gerçek türetilir, ilan edilmez.

**5. Tazelik iki yönlüdür.**
Gelecek tarihli bir credential, geçmiş tarihli biri kadar kırıktır. Pencerenin bir alt sınırı bir de üst sınırı vardır. İkisini de kontrol et — ya da hiçbirini.

**6. İptal, ihracın parçasıdır.**
Nasıl geri çekileceğini yayınlamadan bir kanıt yayınlamak, yarım bir söz yayınlamaktır. Anahtarlar, koşucular ve politikalar iptal edilebilir olmalı — ve bağlantısı kesik bir doğrulayıcı tek bir imzalı notla yetişebilmeli.

**7. Çıpalar, çıpayı çakanın kontrolü dışında yaşar.**
Neyin yayınlandığına dair kayıt, yayıncının yeniden yazamayacağı bir yerde durmalı. Her sürümü, içerme kanıtları bizim sahip olmadığımız anahtarlarla doğrulanan bir kamu şeffaflık günlüğüne (Rekor / Sigstore) bağlıyoruz.

**8. Anahtar yoksa kapı yok.**
API anahtarı isteyen doğrulama, kapatılabilir, pahalılaştırılabilir veya kayda geçebilir bir doğrulamadır. Doğrulama çevrimdışı, anahtarsız, milisaniyeler içinde, herhangi bir cihazda çalışmalı.

**9. Yeniden üretilebilir — ya da olmadı.**
Bir yabancı artefaktı halka açık kaynaktan yeniden kurup aynı baytları alamıyorsa, o artefakt bir inanç konusudur. Bizimkileri bayt bayt yeniden kuruyoruz ve kanıtlıyoruz.

**10. Yol haritası değil, makbuz.**
Söz, pazarlamadır. Makbuz, kimsenin düzenleyemeyeceği bir günlükteki bir sağlamadır. Slaytı değil, komutları göster.

Herkes bizi denetleyebilir. Komutlar burada.

— **AliceLabs / MarketNow**, 09.09.2026

**Bu manifestodaki her şeyi doğrulayın:**
- Uyumluluk paketi (14 vektör, 24 denetim, 10 mutant): https://www.marketnow.site/uta/conformance/
- Rekor çıpaları (append-only, üçüncü taraf): https://www.marketnow.site/uta/conformance/anchors/
- Yeniden üretilebilir derleme: https://www.marketnow.site/uta/conformance/repro/
- Kaynak: https://github.com/alicelabs-llc/universal-trust-adapter
