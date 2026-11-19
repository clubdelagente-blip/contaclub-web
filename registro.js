/* ============================================================
   ContaClub — registro propio de negocios, sin pasar por la
   membresía de El Club de la Gente. Reusa el mismo proyecto de
   Supabase (cliente compartido, cargado cruzado): una cuenta de
   ContaClub es, por debajo, una fila de "aliados" con
   contaclub_standalone = true -- nunca aparece en el Directorio ni
   el landing del Club (ver app-cms.js/directorio.js, que filtran
   por esa columna).
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';

const $ = (s) => document.querySelector(s);

// activo:true a propósito -- "aliados_publico" (la vista que lee la propia
// carta pública del negocio en Carta.html) solo trae filas con activo=true,
// así que ponerlo en false rompería su propia carta. El blindaje contra el
// Directorio/landing del Club NO depende de "activo": ya lo hace
// contaclub_standalone (ver el filtro en directorio.js/app-cms.js del
// repo principal), así que "activo" puede quedarse en true sin riesgo.
async function crearFilasNegocio(userId, datos) {
  const { error: perfilError } = await supabase.from("perfiles").insert({
    id: userId, rol: "aliado", nombre: datos.nombre, whatsapp: datos.whatsapp || null,
  });
  const { error: aliadoError } = await supabase.from("aliados").insert({
    user_id: userId, nombre: datos.nombre, categoria: datos.categoria || null, whatsapp: datos.whatsapp || null,
    contaclub_standalone: true, activo: true,
  });
  return perfilError || aliadoError || null;
}

$("#registro-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = {
    nombre: $("#reg-nombre").value.trim(),
    categoria: $("#reg-categoria").value.trim(),
    whatsapp: $("#reg-whatsapp").value.trim(),
  };
  const email = $("#reg-email").value.trim();
  const pass = $("#reg-pass").value;
  const err = $("#reg-error");
  err.hidden = true;
  if (!datos.nombre || !email || !pass) {
    err.textContent = "Completa el nombre del negocio, correo y contraseña.";
    err.hidden = false;
    return;
  }
  if (pass.length < 6) {
    err.textContent = "La contraseña debe tener al menos 6 caracteres.";
    err.hidden = false;
    return;
  }
  const btn = $("#reg-btn");
  btn.disabled = true;
  btn.textContent = "Creando cuenta…";

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password: pass });
  if (signUpError) {
    btn.disabled = false;
    btn.textContent = "Crear mi cuenta";
    err.textContent = /registered|exists/i.test(signUpError.message)
      ? "Ese correo ya tiene una cuenta -- inicia sesión."
      : "No pudimos crear tu cuenta. Intenta de nuevo.";
    err.hidden = false;
    return;
  }

  const userId = signUpData.user?.id;
  if (!signUpData.session) {
    // El proyecto pide confirmar el correo antes de dar sesión -- no hay
    // forma de insertar las filas todavía (RLS exige auth.uid() = user_id,
    // y sin sesión activa no hay auth.uid()). Se guardan los datos para
    // terminar de armar la cuenta apenas confirme e inicie sesión por
    // primera vez (ver login.js).
    try { localStorage.setItem("contaclub_pending_registro", JSON.stringify(datos)); } catch {}
    btn.disabled = false;
    $("#registro-wrap").hidden = true;
    $("#reg-exito").hidden = false;
    return;
  }

  const error = await crearFilasNegocio(userId, datos);
  btn.disabled = false;
  btn.textContent = "Crear mi cuenta";
  if (error) {
    console.error(error);
    err.textContent = "Tu cuenta se creó, pero hubo un problema terminando de configurarla. Escríbenos.";
    err.hidden = false;
    return;
  }
  location.href = "dashboard.html";
});
