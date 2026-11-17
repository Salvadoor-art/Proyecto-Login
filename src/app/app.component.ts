import { AfterViewInit, Component, OnDestroy } from '@angular/core';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleButtonOptions {
  type: 'standard';
  theme: 'outline';
  size: 'large';
  text: 'continue_with';
  shape: 'rectangular';
  logo_alignment: 'left';
  width: number;
  locale: 'es';
}

interface GoogleIdentityServices {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode: 'popup';
  }): void;
  renderButton(element: HTMLElement, options: GoogleButtonOptions): void;
  cancel(): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentityServices;
      };
    };
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private readonly googleClientId = '492274807728-3479efa48jdv5fsupn8gg831fkbiofsl.apps.googleusercontent.com';
  private readonly scriptId = 'google-identity-services';
  private destroyed = false;
  signedIn = false;
  errorMessage = '';

  async ngAfterViewInit(): Promise<void> {
    try {
      await this.loadGoogleIdentityServices();
      if (this.destroyed) {
        return;
      }

      if (this.googleClientId.startsWith('YOUR_')) {
        this.errorMessage = 'Configura tu ID de cliente de Google para activar el inicio de sesión.';
        return;
      }

      const google = window.google;
      if (!google) {
        throw new Error('No se pudo inicializar el botón de Google.');
      }

      google.accounts.id.initialize({
        client_id: this.googleClientId,
        callback: (response) => this.onGoogleCredential(response),
        ux_mode: 'popup'
      });
      this.renderGoogleButton();
    } catch (error: unknown) {
      console.error('Error al cargar Google Identity Services:', error);
      this.errorMessage = 'No se pudo cargar Google. Revisa tu conexión e inténtalo de nuevo.';
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    window.google?.accounts.id.cancel();
  }

  signOut(): void {
    this.signedIn = false;
    window.google?.accounts.id.disableAutoSelect();
    window.google?.accounts.id.cancel();
    window.setTimeout(() => this.renderGoogleButton(), 0);
  }

  private onGoogleCredential(response: GoogleCredentialResponse): void {
    if (!response.credential) {
      this.errorMessage = 'Google no devolvió una credencial. Inténtalo de nuevo.';
      return;
    }

    this.errorMessage = '';
    this.signedIn = true;
  }

  private loadGoogleIdentityServices(): Promise<void> {
    if (window.google?.accounts.id) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = this.scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falló la carga de Google Identity Services.'));
      document.head.appendChild(script);
    });
  }

  private renderGoogleButton(): void {
    const google = window.google;
    const button = document.getElementById('google-sign-in-button');
    if (!google || !button) {
      return;
    }

    google.accounts.id.renderButton(button, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: Math.min(320, button.clientWidth),
      locale: 'es'
    });
  }
}
