/* ============================================================
   ContaClub — un solo botón de Google para registro.html y login.html:
   signInWithOAuth no distingue "crear cuenta" de "iniciar sesión" --
   Supabase crea el usuario si no existe o abre sesión si ya existe, y
   siempre vuelve a oauth-callback.html, que decide qué hacer con cada
   caso (ver ese archivo). El plan elegido en index.html (si lo hay) ya
   quedó en localStorage antes de llegar acá -- sigue intacto durante la
   ida y vuelta a Google porque es el mismo navegador.
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';

export async function iniciarConGoogle(btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Conectando…"; }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${location.origin}/oauth-callback.html`,
      // Sin esto, si el navegador ya tiene una sesión de Google activa,
      // Google se salta el selector de cuenta y entra directo con esa --
      // acá SIEMPRE puede haber varios negocios probando desde el mismo
      // navegador, así que hay que forzar que pregunte cuál usar cada vez.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error && btn) {
    btn.disabled = false;
    btn.textContent = "Continuar con Google";
  }
}

export function botonGoogleHtml() {
  return `<button type="button" class="btn btn--secundario" id="btn-google" style="width:100%;justify-content:center;gap:10px">
    <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.1-5.1l-6.5-5.5c-2.1 1.5-4.8 2.4-7.6 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C40.9 36.6 44 31 44 24c0-1.3-.1-2.5-.4-3.5z"/></svg>
    Continuar con Google
  </button>`;
}
