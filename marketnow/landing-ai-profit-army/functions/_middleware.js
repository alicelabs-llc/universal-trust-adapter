// Cloudflare Pages Edge Middleware
// Puede ser usado para procesar forms, redirecciones, etc.

export const onRequest = async (context) => {
  // Solo pasar la solicitud sin cambios
  return await context.next();
};