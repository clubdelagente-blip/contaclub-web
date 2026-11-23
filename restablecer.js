/* ============================================================
   El link del correo de recuperación trae el token en la URL;
   el cliente de Supabase lo detecta solo (detectSessionInUrl, por
   defecto en true) y abre una sesión real apenas carga la página
   -- de ahí que updateUser() ya pueda cambiar la contraseña sin
   pedir la anterior.
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';

const $ = (s) => document.querySelector(s);

$("#res-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pass = $("#res-pass").value;
  const err = $("#res-error");
  err.hidden = true;
  if (pass.length < 6) {
    err.textContent = "La contraseña debe tener al menos 6 caracteres.";
    err.hidden = false;
    return;
  }
  const btn = $("#res-btn");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  const { error } = await supabase.auth.updateUser({ password: pass });
  if (error) {
    btn.disabled = false;
    btn.textContent = "Guardar contraseña";
    err.textContent = "El link ya venció o no es válido -- pide uno nuevo.";
    err.hidden = false;
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = "login.html"; return; }
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", session.user.id).maybeSingle();
  location.href = perfil?.rol === "admin" ? "admin.html" : "dashboard.html";
});
