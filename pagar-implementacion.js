/* ============================================================
   ContaClub — pago de la implementación (una sola vez). Muestra
   la llave/QR configurados en el panel Admin (contaclub_config) y
   el monto del plan que el negocio eligió, sube el comprobante a
   Storage y lo deja pendiente de aprobación manual (admin.js ya
   tiene el checkbox "contaclub_implementacion_pagada").
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';
import { comprimirImagen } from 'https://elclubdelagente.com/imagen.js';

const $ = (s) => document.querySelector(s);
const nf = new Intl.NumberFormat("es-CO");
const COP = (n) => "$" + nf.format(Math.round(n || 0));

let _negocio = null;
let _file = null;

async function cargar() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = "login.html"; return; }
  const { data: negocio } = await supabase.from("aliados").select("id, contaclub_plan_id, contaclub_implementacion_pagada, contaclub_implementacion_comprobante_url").eq("user_id", session.user.id).maybeSingle();
  if (!negocio) { location.href = "login.html"; return; }
  _negocio = negocio;

  if (negocio.contaclub_implementacion_pagada) { location.href = "dashboard.html"; return; }

  const [{ data: plan }, { data: config }] = await Promise.all([
    negocio.contaclub_plan_id
      ? supabase.from("contaclub_planes").select("nombre, implementacion").eq("id", negocio.contaclub_plan_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("contaclub_config").select("*").eq("id", true).maybeSingle(),
  ]);

  $("#pi-monto").textContent = COP(plan?.implementacion ?? 0);
  if (plan?.nombre) $("#pi-sub").textContent = `Implementación del plan ${plan.nombre} -- se paga una sola vez.`;

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
  $("#pi-wrap").hidden = true;
  $("#pi-exito").hidden = false;
});
