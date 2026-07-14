export function loginScreen({ status = "signedOut", error = "", loading = false } = {}) {
  const message =
    status === "unauthorized"
      ? "Usuario no autorizado. Contacta a Arizona para habilitar el acceso."
      : "Ingresa con la cuenta creada previamente por Arizona.";

  return `
    <main class="login-shell">
      <section class="login-panel">
        <div class="login-brand">
          <div class="brand-mark">
            <img src="./src/assets/logo-arizona.png" alt="Logo Confinamiento Arizona" />
          </div>
          <div>
            <strong>Confinamiento Arizona</strong>
            <span>Sistema de gestion</span>
          </div>
        </div>
        <div class="login-copy">
          <span class="eyebrow">Acceso seguro</span>
          <h1>Iniciar sesion</h1>
          <p>${message}</p>
        </div>
        <form class="login-form" data-auth-form="login">
          <label>
            <span>Correo</span>
            <input type="email" name="email" autocomplete="email" required />
          </label>
          <label>
            <span>Contrasena</span>
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          ${error ? `<div class="auth-message">${error}</div>` : ""}
          <button class="primary-action" type="submit" ${loading ? "disabled" : ""}>
            ${loading ? "Validando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  `;
}

export function loadingScreen(text = "Validando sesion...") {
  return `
    <main class="login-shell">
      <section class="login-panel compact">
        <div class="login-brand">
          <div class="brand-mark">
            <img src="./src/assets/logo-arizona.png" alt="Logo Confinamiento Arizona" />
          </div>
          <div>
            <strong>Confinamiento Arizona</strong>
            <span>Sistema de gestion</span>
          </div>
        </div>
        <p>${text}</p>
      </section>
    </main>
  `;
}
