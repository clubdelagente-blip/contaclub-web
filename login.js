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
  if (!datos) return false;
  const { data: yaExiste } = await supabase.from("perfiles").select("id").eq("id", userId).maybeSingle();
  let seCreo = false;
  if (!yaExiste) {
    await supabase.from("perfiles").insert({ id: userId, rol: "aliado", nombre: datos.nombre, whatsapp: datos.whatsapp || null });
    // activo:true -- ver la nota en registro.js, "activo" es lo que lee
    // la propia carta pública del negocio, no el blindaje del Directorio
    // (eso lo hace contaclub_standalone aparte). El plan se eligió en
    // index.html antes de registrarse -- sigue en localStorage porque este
    // camino (confirmar correo) nunca pasó por el guardado inmediato.
    let planId = null;
    try { planId = localStorage.getItem("contaclub_plan_id") || null; } catch {}
    await supabase.from("aliados").insert({
      user_id: userId, nombre: datos.nombre, whatsapp: datos.whatsapp || null,
      contaclub_standalone: true, activo: true, contaclub_plan_id: planId,
    });
    seCreo = true;
  }
  try { localStorage.removeItem("contaclub_pending_registro"); localStorage.removeItem("contaclub_plan_id"); } catch {}
  return seCreo;
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
  const cuentaRecienCreada = await crearFilasNegocioSiHacenFalta(data.user.id);
  if (cuentaRecienCreada) { location.href = "foto-perfil.html"; return; }
  // Un admin del Club (mismo auth.users, panel distinto) entra directo al
  // panel de ContaClub en vez del dashboard de negocio -- ese ni le aplica.
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", data.user.id).maybeSingle();
  location.href = perfil?.rol === "admin" ? "admin.html" : "dashboard.html";
});
