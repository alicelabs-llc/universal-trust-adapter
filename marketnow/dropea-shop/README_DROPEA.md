# Dropea Shop (clon base desde inkafit-peru)

## Qué se hizo
- Se clonó la web pública de `https://inkafit-peru.web.app` en esta carpeta.
- Se reemplazó branding principal a **Dropea**.
- Se cambió referencia de dominio a `dropes.shop`.
- Se configuró Firebase Hosting para proyecto `dropea-shop-2026`.

## Deploy
```bash
cd dropea-shop
firebase deploy --only hosting
```

## Conectar dominio
1. Firebase Console -> Hosting -> Add custom domain
2. Dominio: `dropes.shop`
3. Agregar DNS records en tu proveedor de dominio

## Integraciones sugeridas (fase 2)
- Checkout: Stripe / Kushki / MercadoPago
- WhatsApp CTA: botón compra por chat
- Catálogo dinámico: Firestore (`products`)
- Pixel/Analytics: Meta Pixel + GA4

## Nota
Este clon es base estática. Para tienda completa, siguiente paso es convertir productos y carrito a datos dinámicos.
