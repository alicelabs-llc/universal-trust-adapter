// Failover script para redirección automática si el host principal cae
// Incluir este script en todas las páginas HTML antes de </body>

(function() {
  // Lista de hosts en orden de preferencia
  const hosts = [
    {
      name: 'GitHub Pages',
      url: 'https://[usuario].github.io/[repositorio]/',
      checkPath: '/index.html'
    },
    {
      name: 'Cloudflare Pages',
      url: 'https://[project].pages.dev/',
      checkPath: '/index.html'
    },
    {
      name: 'Netlify',
      url: 'https://[site].netlify.app/',
      checkPath: '/index.html'
    }
  ];

  // Host actual (determinado por la URL actual)
  const currentHost = window.location.hostname;
  
  // Si ya estamos en un host de respaldo, no hacer nada
  const isBackupHost = hosts.some(host => 
    host.url.includes(currentHost) && currentHost !== hosts[0].url
  );
  
  if (isBackupHost) {
    console.log('⚠️  Usando host de respaldo:', currentHost);
    // Opcional: mostrar banner de respaldo
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #ff9800;
      color: white;
      padding: 10px;
      text-align: center;
      z-index: 9999;
      font-family: sans-serif;
    `;
    banner.innerHTML = `⚠️  Usando servidor de respaldo (${currentHost}). El servidor principal puede estar temporalmente fuera de línea.`;
    document.body.appendChild(banner);
    return;
  }

  // Función para verificar si un host está activo
  async function checkHost(host) {
    try {
      const response = await fetch(host.url + host.checkPath, { 
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      return true; // Si no hay error de CORS, asumimos que responde
    } catch (error) {
      console.warn(`❌ ${host.name} no responde:`, error);
      return false;
    }
  }

  // Verificar el host principal (primero en la lista)
  async function verifyAndFailover() {
    const primaryHost = hosts[0];
    const isPrimaryUp = await checkHost(primaryHost);
    
    if (!isPrimaryUp) {
      console.warn('🚨 Host principal caído, probando respaldos...');
      
      // Probar hosts de respaldo en orden
      for (let i = 1; i < hosts.length; i++) {
        const backupHost = hosts[i];
        const isBackupUp = await checkHost(backupHost);
        
        if (isBackupUp) {
          console.log(`✅ Redirigiendo a ${backupHost.name}: ${backupHost.url}`);
          // Redirigir después de 3 segundos (dar tiempo a cargar)
          setTimeout(() => {
            window.location.href = backupHost.url;
          }, 3000);
          
          // Mostrar mensaje de redirección
          const redirectMsg = document.createElement('div');
          redirectMsg.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #f44336;
            color: white;
            padding: 15px;
            text-align: center;
            z-index: 9999;
            font-family: sans-serif;
            font-weight: bold;
          `;
          redirectMsg.innerHTML = `🚨 Servidor principal fuera de línea. Redirigiendo a ${backupHost.name} en 3 segundos...`;
          document.body.appendChild(redirectMsg);
          break;
        }
      }
    }
  }

  // Ejecutar verificación después de 5 segundos de carga
  window.addEventListener('load', () => {
    setTimeout(verifyAndFailover, 5000);
  });

})();