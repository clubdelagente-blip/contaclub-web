/* ============================================================
   ContaClub — pantalla de pago, con dos modos según el plan:

   - Planes con mensualidad fija (Básico/Pro): el pago es OBLIGATORIO --
     se cobra el primer mes, no hay link para omitirlo, y mientras no se
     apruebe el comprobante la cuenta queda "contaclub_activo = false"
     (ver registro.js/login.js/oauth-callback.js, que la crean así para
     estos planes) y dashboard.js bloquea el panel completo con una
     pantalla de "pendiente de activación".
   - Planes sin mensualidad fija (Premium, 0% variable): la implementación
     es OPCIONAL -- se puede entrar al dashboard sin pagarla (su cuenta
     nace "contaclub_activo = true"), por eso acá sí se deja el link para
     omitir.

   En ambos casos, el comprobante sube a Storage y se guarda en la misma
   columna (contaclub_implementacion_comprobante_url) -- el Admin lo revisa
   y activa la cuenta (o marca "implementación pagada", para Premium)
   manualmente desde su panel.
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';
import { comprimirImagen } from 'https://elclubdelagente.com/imagen.js';

const $ = (s) => document.querySelector(s);
const nf = new Intl.NumberFormat("es-CO");
const COP = (n) => "$" + nf.format(Math.round(n || 0));

let _negocio = null;
let _file = null;
let _obligatorio = false;

async function cargar() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = "login.html"; return; }
  const { data: negocio } = await supabase.from("aliados").select("id, contaclub_plan_id, contaclub_activo, contaclub_implementacion_pagada, contaclub_implementacion_comprobante_url").eq("user_id", session.user.id).maybeSingle();
  if (!negocio) { location.href = "login.html"; return; }
  _negocio = negocio;

  // Ya está todo pagado/activo -- este paso ya no aplica.
  if (negocio.contaclub_implementacion_pagada || negocio.contaclub_activo) { location.href = "dashboard.html"; return; }

  const [{ data: plan }, { data: config }] = await Promise.all([
    negocio.contaclub_plan_id
      ? supabase.from("contaclub_planes").select("nombre, implementacion, mensualidad").eq("id", negocio.contaclub_plan_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("contaclub_config").select("*").eq("id", true).maybeSingle(),
  ]);

  _obligatorio = plan?.mensualidad != null;
  const monto = _obligatorio ? Number(plan.mensualidad) + Number(plan.implementacion || 0) : Number(plan?.implementacion || 0);

  // Plan variable (Premium) sin implementación que ofrecer -- nada que
  // pagar todavía, entra directo (su cuenta ya nace activa).
  if (!_obligatorio && !monto) { location.href = "dashboard.html"; return; }

  $("#pi-monto").textContent = COP(monto);
  if (_obligatorio) {
    $("#pi-titulo").textContent = "Activa tu cuenta";
    $("#pi-sub").textContent = plan?.nombre ? `Primer pago del plan ${plan.nombre} -- así activamos tu cuenta.` : "Primer pago -- así activamos tu cuenta.";
    $("#pi-omitir-wrap").hidden = true;
  } else {
    $("#pi-titulo").textContent = "Último paso: la implementación";
    if (plan?.nombre) $("#pi-sub").textContent = `Implementación del plan ${plan.nombre} -- se paga una sola vez.`;
    $("#pi-omitir-wrap").hidden = false;
  }

  if (config?.llave_qr_url) { $("#pi-qr").src = config.llave_qr_url; $("#pi-qr-wrap").hidden = false; }
  if (config?.llave_pago) { $("#pi-llave").textContent = config.llave_pago; $("#pi-llave-wrap").hidden = false; }

  if (negocio.contaclub_implementacion_comprobante_url) {
    $("#pi-btn").textContent = "Ya enviamos tu comprobante -- reenviar";
  }
}
cargar();

$("#pi-comprobante")?.addEventListener("change", () => {
  _file = $("#pi-comprobante").files?.[0] || null;
});

$("#pi-btn")?.addEventListener("click", async () => {
  const err = $("#pi-error");
  err.hidden = true;
  if (!_file) {
    err.textContent = "Sube una foto o PDF del comprobante.";
    err.hidden = false;
    return;
  }
  const btn = $("#pi-btn");
  btn.disabled = true;
  btn.textContent = "Enviando…";

  let file = _file;
  if (file.type.startsWith("image/")) file = await comprimirImagen(file);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `contaclub-implementacion-${_negocio.id}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("contenido").upload(path, file, { upsert: true });
  if (upErr) {
    btn.disabled = false;
    btn.textContent = "Enviar comprobante";
    err.textContent = "No pudimos subir el comprobante. Intenta de nuevo.";
    err.hidden = false;
    return;
  }
  const comprobante_url = supabase.storage.from("contenido").getPublicUrl(path).data.publicUrl;

  const { error } = await supabase.from("aliados").update({ contaclub_implementacion_comprobante_url: comprobante_url }).eq("id", _negocio.id);
  btn.disabled = false;
  btn.textContent = "Enviar comprobante";
  if (error) {
    err.textContent = "Tu comprobante se subió, pero hubo un problema guardándolo. Escríbenos.";
    err.hidden = false;
    return;
  }
  if (_obligatorio) {
    $("#pi-exito-texto").textContent = "Recibimos tu comprobante. Estamos revisándolo -- en cuanto lo aprobemos, tu cuenta queda activa y te avisamos.";
    $("#pi-exito-btn").hidden = true;
  }
  $("#pi-wrap").hidden = true;
  $("#pi-exito").hidden = false;
});
