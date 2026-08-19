// Health check script para verificar que los 3 hosts estén activos
// Ejecutar con Node.js o en GitHub Actions

const hosts = [
  { name: 'GitHub Pages', url: 'https://[usuario].github.io/[repositorio]/' },
  { name: 'Cloudflare Pages', url: 'https://[project].pages.dev/' },
  { name: 'Netlify', url: 'https://[site].netlify.app/' }
];

async function checkHost(host) {
  try {
    const response = await fetch(host.url, { method: 'HEAD', timeout: 10000 });
    return {
      name: host.name,
      url: host.url,
      status: response.status,
      ok: response.ok
    };
  } catch (error) {
    return {
      name: host.name,
      url: host.url,
      status: 'ERROR',
      error: error.message,
      ok: false
    };
  }
}

async function runChecks() {
  console.log('🔍 Health check iniciado...');
  const results = await Promise.all(hosts.map(checkHost));
  
  let allOk = true;
  results.forEach(result => {
    if (result.ok) {
      console.log(`✅ ${result.name}: ${result.status} - ${result.url}`);
    } else {
      console.log(`❌ ${result.name}: ${result.status} - ${result.error || 'Falló'}`);
      allOk = false;
    }
  });
  
  if (allOk) {
    console.log('🎉 Todos los hosts están activos.');
  } else {
    console.log('⚠️  Algunos hosts presentan problemas.');
    process.exit(1);
  }
}

runChecks();