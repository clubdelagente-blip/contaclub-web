/* ============================================================
   ContaClub — login propio (mismo patrón genérico que ya usa
   auth.js:631 en el repo de El Club de la Gente: signInWithPassword,
   sin depender de rol). Cliente de Supabase compartido, cargado
   cruzado -- la sesión queda guardada en el localStorage/cookies
   de ESTE dominio (contaclub.online), aislada de la del Club.
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';

const $ = (s) => document.querySelector(s);

// Si venía de un registro que quedó pendiente de confirmar el correo
// (ver registro.js), termina de crear sus filas de perfiles/aliados acá,
// en el primer login real -- ahí ya hay sesión y auth.uid() sí existe.
async function crearFilasNegocioSiHacenFalta(userId) {
  let datos;
  try { datos = JSON.parse(localStorage.getItem("contaclub_pending_registro") || "null"); } catch { datos = null; }
  if (!datos) return;
  const { data: yaExiste } = await supabase.from("perfiles").select("id").eq("id", userId).maybeSingle();
  if (!yaExiste) {
    await supabase.from("perfiles").insert({ id: userId, rol: "aliado", nombre: datos.nombre, whatsapp: datos.whatsapp || null });
    await supabase.from("aliados").insert({
      user_id: userId, nombre: datos.nombre, categoria: datos.categoria || null, whatsapp: datos.whatsapp || null,
      contaclub_standalone: true, activo: false,
    });
  }
  try { localStorage.removeItem("contaclub_pending_registro"); } catch {}
}

$("#login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#login-email").value.trim();
  const pass = $("#login-pass").value;
  const btn = $("#login-btn");
  const err = $("#login-error");
  err.hidden = true;
  if (!email || !pass) return;
  btn.disabled = true;
  btn.textContent = "Entrando…";
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) {
    btn.disabled = false;
    btn.textContent = "Entrar";
    err.textContent = "Correo o contraseña incorrectos.";
    err.hidden = false;
    return;
  }
  await crearFilasNegocioSiHacenFalta(data.user.id);
  location.href = "dashboard.html";
});
