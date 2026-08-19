const { chromium } = require('playwright');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Intentando conectar al navegador existente via CDP (puerto 9222)...');
  let browser;
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✅ Conectado al navegador activo!');
  } catch (e) {
    console.log('❌ Falló la conexión CDP:', e.message);
    process.exit(1);
  }

  const contexts = browser.contexts();
  let page;
  
  // Buscar página de Cloudflare activa
  for (const ctx of contexts) {
    for (const p of ctx.pages()) {
      const url = p.url();
      if (url.includes('cloudflare.com')) {
        page = p;
        break;
      }
    }
  }

  if (!page) {
    page = await contexts[0].newPage();
  }
  
  console.log('Navegando a Pages Custom Domains...');
  await page.goto(`https://dash.cloudflare.com/${process.env.CLOUDFLARE_ACCOUNT_ID || "unknown"}/pages/view/aep-marketplace/custom-domains`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  
  await sleep(8000); // Wait for page to load
  
  console.log('Buscando el botón de Set up a custom domain...');
  await page.evaluate(() => {
    // Click "Set up a custom domain" if it exists
    const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
    const setupBtn = buttons.find(b => b.textContent.includes('Set up a custom domain') || b.textContent.includes('Add domain'));
    if (setupBtn) setupBtn.click();
  });

  await sleep(3000);
  
  console.log('Escribiendo www.marketnow.site...');
  await page.evaluate(() => {
    // Find input for domain
    const inputs = Array.from(document.querySelectorAll('input'));
    const domainInput = inputs.find(i => i.placeholder?.includes('example.com') || i.name === 'domain' || i.className.includes('Input'));
    if (domainInput) {
      domainInput.value = 'www.marketnow.site';
      domainInput.dispatchEvent(new Event('input', { bubbles: true }));
      domainInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  await sleep(2000);

  console.log('Clickeando Continue...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const continueBtn = buttons.find(b => b.textContent.includes('Continue') || b.textContent.includes('Add') || b.textContent.includes('Activate'));
    if (continueBtn) continueBtn.click();
  });
  
  await sleep(6000);

  console.log('Clickeando Activate domain...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const activateBtn = buttons.find(b => b.textContent.includes('Activate domain'));
    if (activateBtn) activateBtn.click();
  });

  await sleep(5000);
  
  console.log('✅ Listo. Acción de añadir custom domain completada.');
  process.exit(0);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
