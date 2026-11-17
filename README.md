# Proyecto de login con Angular

Página de inicio de sesión responsive en español con Google Identity Services.

## Requisitos

- Node.js 20.19+ o 22.12+
- npm
- Un ID de cliente OAuth 2.0 de tipo **Aplicación web** de Google

## Configuración

1. En Google Cloud Console, crea un cliente OAuth para una aplicación web.
2. Añade `http://localhost:4200` en **Orígenes autorizados de JavaScript**.
3. En `src/app/app.component.ts`, sustituye `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` por el ID de cliente.
4. Instala dependencias e inicia la aplicación:

   ```bash
   npm install
   npm start
   ```

5. Abre `http://localhost:4200`.

No agregues un secreto OAuth al frontend. Esta demo recibe la credencial de Google en el navegador; para una aplicación real, envíala por HTTPS a un backend y valida allí la firma y las claims del ID token antes de crear una sesión. La demo no guarda tokens ni implementa una sesión de servidor.
