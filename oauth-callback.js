/* ============================================================
   ContaClub — vuelta de "Continuar con Google" (ver google-auth.js).
   signInWithOAuth no distingue crear cuenta de iniciar sesión -- lo único
   que falta decidir es si esta es la PRIMERA vez que este usuario entra
   (no existe su fila en "perfiles", hay que armar perfiles+aliados igual
   que registro.js/login.js) o si ya es un negocio existente.

   Ojo con esto: si llamamos a getSession() apenas carga la página, puede
   devolver una sesión VIEJA que ya estuviera guardada en este navegador
   (de otra cuenta probada antes) en vez de esperar a que Supabase termine
   de canjear el "?code=" de Google por la sesión nueva -- eso hacía que
   probar con una cuenta de Google distinta igual entrara a la cuenta
   anterior. Por eso, si la URL trae un código, se espera puntualmente el
   evento "SIGNED_IN" (la confirmación real de que ESE código ya se
   procesó) en vez de preguntar "¿hay sesión?" a ciegas.
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';

const $ = (s) => document.querySelector(s);

function leerPlanElegido() {
  try { return localStorage.getItem("contaclub_plan_id") || null; } catch { return null; }
}

function mostrarError() {
  $("#cb-texto").textContent = "No pudimos iniciar sesión con Google.";
  $("#cb-error").textContent = "Intenta de nuevo.";
  $("#cb-error").hidden = false;
  setTimeout(() => location.href = "login.html", 2500);
}

async function continuarConSesion(session) {
  const userId = session.user.id;
  const { data: yaExiste } = await supabase.from("perfiles").select("id, rol").eq("id", userId).maybeSingle();

  if (!yaExiste) {
    const nombreGoogle = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Mi negocio";
    const { error: perfilError } = await supabase.from("perfiles").insert({ id: userId, rol: "aliado", nombre: nombreGoogle });
    const { error: aliadoError } = await supabase.from("aliados").insert({
      user_id: userId, nombre: nombreGoogle,
      contaclub_standalone: true, activo: true, contaclub_plan_id: leerPlanElegido(),
    });
    try { localStorage.removeItem("contaclub_plan_id"); } catch {}
    if (perfilError || aliadoError) {
      $("#cb-texto").textContent = "Tu cuenta de Google se conectó, pero hubo un problema configurando tu negocio.";
      $("#cb-error").textContent = "Escríbenos para terminar de activarla.";
      $("#cb-error").hidden = false;
      return;
    }
    location.href = "foto-perfil.html";
    return;
  }

  // Un admin del Club (mismo auth.users, panel distinto) entra directo al
  // panel de ContaClub en vez del dashboard de negocio -- ese ni le aplica.
  location.href = yaExiste.rol === "admin" ? "admin.html" : "dashboard.html";
}

async function procesar() {
  const tieneCodigo = new URL(location.href).searchParams.has("code");
  if (!tieneCodigo) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await continuarConSesion(session); else mostrarError();
    return;
  }

  let resuelto = false;
  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    if (resuelto || event !== "SIGNED_IN" || !session) return;
    resuelto = true;
    listener.subscription.unsubscribe();
    continuarConSesion(session);
  });
  setTimeout(() => {
    if (resuelto) return;
    resuelto = true;
    listener.subscription.unsubscribe();
    mostrarError();
  }, 8000);
}
procesar();
