# Proyecto de login con Angular

Página responsive en español con inicio de sesión mediante Google y GitHub.

## Requisitos

- Node.js 20.19+ o 22.12+
- npm
- Un ID de cliente OAuth 2.0 de tipo **Aplicación web** de Google
- Una GitHub OAuth App para habilitar el acceso con GitHub

## Configuración

1. En Google Cloud Console, crea un cliente OAuth para una aplicación web y añade `http://localhost:4200` a **Orígenes autorizados de JavaScript**.
2. En `src/app/app.component.ts`, configura el ID de cliente de Google.
3. En GitHub, crea una OAuth App desde **Settings → Developer settings → OAuth Apps**:
   - **Homepage URL:** `http://localhost:4200`
   - **Authorization callback URL:** `http://localhost:4200/auth/github/callback`
4. Copia `.env.example` como `.env` y completa `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET` con los datos de GitHub. Genera un secreto de sesión con:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Pega el resultado en `SESSION_SECRET`. No compartas ni subas el archivo `.env`; ya está excluido de Git.
5. Instala dependencias e inicia el backend y Angular:

   ```bash
   npm install
   npm start
   ```

6. Abre `http://localhost:4200` y elige Google o GitHub.

El secreto de GitHub solo se usa en el backend. La sesión de GitHub se mantiene en una cookie HTTP-only firmada; el token de acceso de GitHub no se guarda. El inicio de sesión de Google sigue siendo una demo de frontend y no crea una sesión de servidor. Para producción, valida el ID token de Google en el backend y usa HTTPS.
