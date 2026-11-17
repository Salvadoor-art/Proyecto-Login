# Cómo funciona `app.component.ts`

Este documento explica el componente principal de Angular definido en [`src/app/app.component.ts`](./src/app/app.component.ts). El componente coordina el inicio de sesión con Google y GitHub, conserva en memoria el perfil que se muestra y cambia entre la vista de acceso y el dashboard.

## Estructura del componente

`AppComponent` es un componente independiente (`standalone`) con el selector `app-root`. Su HTML y sus estilos están en `app.component.html` y `app.component.css`.

El componente implementa tres etapas del ciclo de vida de Angular:

- `ngOnInit()` revisa si GitHub devolvió un error en la URL y comprueba si ya existe una sesión de GitHub.
- `ngAfterViewInit()` carga e inicializa el botón de Google cuando la vista ya está disponible.
- `ngOnDestroy()` cancela la interacción activa con Google cuando el componente se destruye.

`NgZone` permite avisar a Angular cuando una respuesta asíncrona de una biblioteca externa actualiza datos que deben reflejarse en la página.

## Datos y tipos

- `AccountProfile` define los datos mostrados de una cuenta: proveedor, nombre, correo, foto y nombre de usuario.
- `GoogleCredentialResponse` describe la respuesta de credencial que entrega Google Identity Services.
- `GoogleButtonOptions` y `GoogleIdentityServices` describen las opciones y métodos de la biblioteca de Google usados por el componente.
- La declaración global de `window.google` permite usar esa biblioteca con tipos de TypeScript.
- `isRecord()` comprueba que un dato desconocido sea un objeto antes de leer sus propiedades.

Las propiedades `signedIn`, `userProfile` y `errorMessage` representan, respectivamente, si hay una sesión activa en la interfaz, el perfil actual y el mensaje de error que se presenta.

## Inicio de sesión con Google

1. `ngAfterViewInit()` llama a `loadGoogleIdentityServices()`. Este método reutiliza la biblioteca si ya está cargada; si no, agrega el script de Google al documento y espera a que termine de cargar.
2. Si el componente sigue activo, inicializa Google Identity Services en modo `popup` y conecta su callback con `onGoogleCredential()`.
3. `renderGoogleButton()` encuentra el elemento `google-sign-in-button` de la vista y le pide a Google que dibuje el botón en español.
4. Cuando Google entrega una credencial, `onGoogleCredential()` comprueba que exista y llama a `readGoogleProfile()`.
5. `readGoogleProfile()` decodifica el contenido del ID token para obtener nombre, correo y foto. Si algún dato no está disponible, utiliza un texto alternativo. Después, `onGoogleCredential()` guarda el perfil y activa `signedIn`.

El componente solo decodifica el contenido del ID token en el navegador; no valida su firma ni verifica la identidad en un servidor. Por tanto, esta lectura sirve para mostrar el perfil, pero no equivale a una validación de seguridad del token.

## Inicio de sesión con GitHub

1. `startGitHubLogin()` navega a `/auth/github`, donde el backend inicia el flujo OAuth.
2. GitHub devuelve al usuario al backend. El backend administra la respuesta OAuth y la sesión.
3. Al iniciar la aplicación, `restoreGitHubSession()` consulta `/api/auth/session` enviando las cookies del sitio.
4. Si el servidor devuelve una sesión válida, el método comprueba el formato del perfil, actualiza `userProfile` y establece `signedIn`.
5. Si la URL contiene `authError=github`, `ngOnInit()` muestra un mensaje y elimina ese parámetro de la barra de direcciones.

El token de acceso y el intercambio OAuth se administran en el backend; el componente recibe únicamente los datos del perfil de sesión.

## Cierre de sesión

`signOut()` distingue el proveedor del perfil:

- Para GitHub, envía `POST /api/auth/logout` con las cookies. Si el servidor falla, conserva el estado de la interfaz y muestra un error.
- Después de cerrar la sesión correctamente, o al cerrar una sesión de Google, borra `userProfile`, establece `signedIn` en `false`, desactiva la selección automática de Google y vuelve a dibujar su botón.

## Propiedades calculadas para la vista

- `profileInitial` obtiene la primera letra del nombre para usarla como inicial cuando sea necesario.
- `profileDetail` muestra el correo; si no existe, muestra el nombre de usuario de GitHub o un texto alternativo.
- `providerLabel` devuelve `GitHub` o `Google` según el perfil actual.

## Manejo de errores

Los errores de carga de Google, lectura de perfiles, consulta de sesión o cierre de sesión se escriben en la consola con `console.error`. Cuando corresponde, `errorMessage` contiene el texto que puede mostrar la vista para informar al usuario.
