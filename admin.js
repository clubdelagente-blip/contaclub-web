/* ============================================================
   ContaClub — panel admin interno (solo El Club de la Gente, no el
   negocio). Proyecto propio y separado del Admin.html del Club -- esto
   SOLO gestiona negocios de ContaClub (contaclub_standalone=true): sus
   planes, los cobros mensuales, la publicidad que se intercala en todas
   sus cartas públicas, y la llave de pago de ContaClub.
   Reusa el mismo Supabase (cliente compartido, cargado cruzado) y el
   mismo rol "admin" de perfiles -- el mismo equipo administra los dos
   proyectos, solo que desde paneles distintos.
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const nf = new Intl.NumberFormat("es-CO");
const COP = (n) => "$" + nf.format(Math.round(n || 0));
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

async function iniciar() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = "login.html"; return; }
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", session.user.id).maybeSingle();
  if (perfil?.rol !== "admin") { location.href = "dashboard.html"; return; }

  $("#admin-salir")?.addEventListener("click", async () => { await supabase.auth.signOut(); location.href = "login.html"; });
  wireNav();

  $("#calcular-cobros-btn")?.addEventListener("click", calcularCobros);
  $("#plan-guardar")?.addEventListener("click", guardarPlan);
  $("#plan-cancelar")?.addEventListener("click", resetFormPlan);
  $("#anuncio-guardar")?.addEventListener("click", guardarAnuncio);
  $("#anuncio-cancelar")?.addEventListener("click", resetFormAnuncio);
  $("#anuncio-imagen-file")?.addEventListener("change", onElegirImagenAnuncio);
  $("#pago-guardar")?.addEventListener("click", guardarConfigPago);
  $("#pago-qr-url")?.addEventListener("input", pintarPreviewQr);

  await Promise.all([cargarPlanes(), cargarNegocios(), cargarCobros(), cargarAnuncios(), cargarConfigPago()]);
}

/* ---------- Navegación entre secciones ---------- */
function wireNav() {
  $$("#admin-nav [data-seccion]").forEach(btn => btn.addEventListener("click", () => {
    $$("#admin-nav [data-seccion]").forEach(b => b.classList.toggle("is-on", b === btn));
    $$(".admin-seccion").forEach(sec => sec.hidden = sec.id !== `admin-seccion-${btn.dataset.seccion}`);
  }));
}

/* ---------- Planes ---------- */
let _planes = [];
async function cargarPlanes() {
  const { data } = await supabase.from("contaclub_planes").select("*").order("orden");
  _planes = data || [];
  pintarPlanes();
  pintarSelectPlanesEnNegocios();
}
function pintarPlanes() {
  const cont = $("#planes-lista");
  if (!cont) return;
  if (!_planes.length) {
    cont.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--tinta-45)">Todavía no hay planes creados.</td></tr>`;
    return;
  }
  cont.innerHTML = _planes.map(p => `
    <tr>
      <td>${esc(p.nombre)}</td>
      <td>${COP(p.implementacion)}</td>
      <td>${p.mensualidad != null ? COP(p.mensualidad) + "/mes" : "—"}</td>
      <td>${p.umbral_facturacion != null ? COP(p.umbral_facturacion) : "—"}</td>
      <td>${p.porcentaje_volumen != null ? (Number(p.porcentaje_volumen) * 100).toFixed(2).replace(/\.?0+$/, "") + "%" : "—"}</td>
      <td>${p.activo ? "Sí" : "No"}</td>
      <td><button type="button" class="btn" data-editar-plan="${p.id}" style="padding:6px 12px;font-size:12px">Editar</button></td>
    </tr>`).join("");
  $$("[data-editar-plan]", cont).forEach(b => b.addEventListener("click", () => cargarPlanEnForm(b.dataset.editarPlan)));
}
function cargarPlanEnForm(id) {
  const p = _planes.find(x => x.id === id);
  if (!p) return;
  $("#plan-id").value = p.id;
  $("#plan-nombre").value = p.nombre || "";
  $("#plan-implementacion").value = p.implementacion ?? "";
  $("#plan-mensualidad").value = p.mensualidad ?? "";
  $("#plan-umbral").value = p.umbral_facturacion ?? "";
  $("#plan-porcentaje").value = p.porcentaje_volumen != null ? Number(p.porcentaje_volumen) * 100 : "";
  $("#plan-activo").checked = !!p.activo;
  $("#plan-form-titulo").textContent = "Editar plan";
  $("#plan-cancelar").hidden = false;
  $("#admin-seccion-planes").scrollIntoView({ behavior: "smooth", block: "start" });
}
function resetFormPlan() {
  $("#plan-id").value = "";
  ["plan-nombre", "plan-implementacion", "plan-mensualidad", "plan-umbral", "plan-porcentaje"].forEach(id => { const el = $(`#${id}`); if (el) el.value = ""; });
  $("#plan-activo").checked = true;
  $("#plan-form-titulo").textContent = "Crear plan";
  $("#plan-cancelar").hidden = true;
}
async function guardarPlan() {
  const nombre = $("#plan-nombre")?.value.trim();
  if (!nombre) { alert("Escribe el nombre del plan"); return; }
  const payload = {
    nombre,
    implementacion: Number($("#plan-implementacion")?.value) || 0,
    mensualidad: $("#plan-mensualidad")?.value ? Number($("#plan-mensualidad").value) : null,
    umbral_facturacion: $("#plan-umbral")?.value ? Number($("#plan-umbral").value) : null,
    porcentaje_volumen: $("#plan-porcentaje")?.value ? Number($("#plan-porcentaje").value) / 100 : null,
    activo: $("#plan-activo")?.checked ?? true,
  };
  const id = $("#plan-id")?.value;
  const btn = $("#plan-guardar");
  btn.disabled = true; btn.textContent = "Guardando…";
  const { error } = id
    ? await supabase.from("contaclub_planes").update(payload).eq("id", id)
    : await supabase.from("contaclub_planes").insert(payload);
  btn.disabled = false; btn.textContent = "Guardar plan";
  if (error) { alert("No se pudo guardar: " + error.message); return; }
  resetFormPlan();
  await cargarPlanes();
}

/* ---------- Negocios (plan asignado + implementación pagada) ---------- */
async function cargarNegocios() {
  const [{ data }, { data: visitas }] = await Promise.all([
    supabase.from("aliados")
      .select("id, nombre, whatsapp, contaclub_plan_id, contaclub_implementacion_pagada")
      .eq("contaclub_standalone", true).order("nombre"),
    supabase.rpc("contaclub_visitas_por_negocio"),
  ]);
  _visitasPorNegocio = new Map((visitas || []).map(v => [v.negocio_id, v]));
  pintarNegocios(data || []);
}
let _negociosActuales = [];
let _visitasPorNegocio = new Map();
function pintarNegocios(negocios) {
  _negociosActuales = negocios;
  const cont = $("#negocios-lista");
  if (!cont) return;
  if (!negocios.length) {
    cont.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--tinta-45)">Todavía no hay negocios de ContaClub registrados.</td></tr>`;
    return;
  }
  cont.innerHTML = negocios.map(n => {
    const v = _visitasPorNegocio.get(n.id);
    return `
    <tr>
      <td>${esc(n.nombre)}</td>
      <td>${esc(n.whatsapp || "—")}</td>
      <td>
        <select class="cc-campo-select" data-plan="${n.id}">
          <option value="">Sin plan</option>
          ${_planes.map(p => `<option value="${p.id}" ${n.contaclub_plan_id === p.id ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}
        </select>
      </td>
      <td style="text-align:center"><input type="checkbox" data-impl="${n.id}" ${n.contaclub_implementacion_pagada ? "checked" : ""}></td>
      <td style="text-align:right">${nf.format(v?.visitas_30d || 0)}</td>
      <td style="text-align:right">${nf.format(v?.visitas_total || 0)}</td>
    </tr>`;
  }).join("");
  $$("[data-plan]", cont).forEach(sel => sel.addEventListener("change", () => guardarNegocio(sel.dataset.plan)));
  $$("[data-impl]", cont).forEach(chk => chk.addEventListener("change", () => guardarNegocio(chk.dataset.impl)));
}
// Si los planes llegan/cambian después de pintar negocios, se repinta la
// tabla para que el <select> de cada fila ya tenga las opciones correctas.
function pintarSelectPlanesEnNegocios() { if (_negociosActuales.length) pintarNegocios(_negociosActuales); }
async function guardarNegocio(id) {
  const planId = $(`[data-plan="${id}"]`)?.value || null;
  const impl = $(`[data-impl="${id}"]`)?.checked || false;
  await supabase.from("aliados").update({ contaclub_plan_id: planId, contaclub_implementacion_pagada: impl }).eq("id", id);
}

/* ---------- Cobros mensuales ---------- */
async function calcularCobros() {
  const btn = $("#calcular-cobros-btn");
  if (!btn) return;
  btn.disabled = true; btn.textContent = "Calculando…";
  const hoy = new Date();
  const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const pMes = mesAnterior.toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc("calcular_cobros_contaclub", { p_mes: pMes });
  btn.disabled = false; btn.textContent = "Calcular cobros del mes pasado";
  if (error) { alert("No se pudo calcular: " + error.message); return; }
  alert(`Listo -- ${data?.length || 0} negocio(s) quedaron con cobro pendiente para ${pMes.slice(0, 7)}.`);
  await cargarCobros();
}
async function cargarCobros() {
  const { data } = await supabase.from("contaclub_cobros_mensuales").select("*, aliados(nombre)").order("mes", { ascending: false });
  pintarCobros(data || []);
  pintarMetricasCobros(data || []);
}
function pintarMetricasCobros(cobros) {
  const cont = $("#metricas-cobros");
  if (!cont) return;
  const pendiente = cobros.filter(c => c.estado === "pendiente").reduce((s, c) => s + Number(c.monto_cobro || 0), 0);
  const pagado = cobros.filter(c => c.estado === "pagado").reduce((s, c) => s + Number(c.monto_cobro || 0), 0);
  cont.innerHTML = `
    <div class="cc-metric"><span class="cc-metric__n">${COP(pendiente)}</span><span class="cc-metric__lbl">Pendiente de cobrar</span></div>
    <div class="cc-metric"><span class="cc-metric__n">${COP(pagado)}</span><span class="cc-metric__lbl">Ya pagado (histórico)</span></div>
    <div class="cc-metric"><span class="cc-metric__n">${nf.format(_negociosActuales.filter(n => n.contaclub_plan_id).length)}</span><span class="cc-metric__lbl">Negocios con plan asignado</span></div>`;
}
function pintarCobros(cobros) {
  const cont = $("#cobros-lista");
  if (!cont) return;
  if (!cobros.length) {
    cont.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--tinta-45)">Todavía no se ha calculado ningún cobro.</td></tr>`;
    return;
  }
  cont.innerHTML = cobros.map(c => `
    <tr>
      <td>${esc(c.aliados?.nombre || "—")}</td>
      <td>${esc(c.mes.slice(0, 7))}</td>
      <td>${COP(c.facturacion_total)}</td>
      <td>${COP(c.monto_cobro)}</td>
      <td><span class="cc-cobro-estado${c.estado === "pagado" ? " is-pagado" : ""}">${c.estado}</span></td>
      <td>${c.estado === "pendiente" ? `<button type="button" class="btn btn--primario" data-pagar="${c.id}" style="padding:6px 12px;font-size:12px">Marcar pagado</button>` : "—"}</td>
    </tr>`).join("");
  $$("[data-pagar]", cont).forEach(b => b.addEventListener("click", () => marcarPagado(b.dataset.pagar)));
}
async function marcarPagado(id) {
  await supabase.from("contaclub_cobros_mensuales").update({ estado: "pagado", fecha_pago: new Date().toISOString().slice(0, 10) }).eq("id", id);
  await cargarCobros();
}

/* ---------- Publicidad (anuncios intercalados en todas las cartas de
   ContaClub) ---------- */
let _anuncios = [];
async function cargarAnuncios() {
  const { data } = await supabase.from("contaclub_anuncios").select("*").order("orden");
  _anuncios = data || [];
  pintarAnuncios();
}
function pintarAnuncios() {
  const cont = $("#anuncios-lista");
  if (!cont) return;
  if (!_anuncios.length) {
    cont.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--tinta-45)">Todavía no hay anuncios creados.</td></tr>`;
    return;
  }
  cont.innerHTML = _anuncios.map(a => `
    <tr>
      <td>${a.imagen_url ? `<img src="${esc(a.imagen_url)}" alt="" style="width:44px;height:44px;border-radius:8px;object-fit:cover;display:block">` : "—"}</td>
      <td>${esc(a.titulo)}</td>
      <td>${a.activo ? "Sí" : "No"}</td>
      <td><button type="button" class="btn" data-editar-anuncio="${a.id}" style="padding:6px 12px;font-size:12px">Editar</button></td>
    </tr>`).join("");
  $$("[data-editar-anuncio]", cont).forEach(b => b.addEventListener("click", () => cargarAnuncioEnForm(b.dataset.editarAnuncio)));
}
function cargarAnuncioEnForm(id) {
  const a = _anuncios.find(x => x.id === id);
  if (!a) return;
  $("#anuncio-id").value = a.id;
  $("#anuncio-titulo").value = a.titulo || "";
  $("#anuncio-descripcion").value = a.descripcion || "";
  $("#anuncio-imagen-url").value = a.imagen_url || "";
  $("#anuncio-imagen-file").value = "";
  _anuncioImagenPendiente = null;
  pintarPreviewImagenAnuncio(a.imagen_url || "");
  $("#anuncio-link").value = a.link || "";
  $("#anuncio-activo").checked = !!a.activo;
  $("#anuncio-form-titulo").textContent = "Editar anuncio";
  $("#anuncio-cancelar").hidden = false;
  $("#admin-seccion-publicidad").scrollIntoView({ behavior: "smooth", block: "start" });
}
function resetFormAnuncio() {
  $("#anuncio-id").value = "";
  ["anuncio-titulo", "anuncio-descripcion", "anuncio-imagen-url", "anuncio-link"].forEach(id => { const el = $(`#${id}`); if (el) el.value = ""; });
  $("#anuncio-imagen-file").value = "";
  _anuncioImagenPendiente = null;
  pintarPreviewImagenAnuncio("");
  $("#anuncio-activo").checked = true;
  $("#anuncio-form-titulo").textContent = "Crear anuncio";
  $("#anuncio-cancelar").hidden = true;
}
// La imagen es opcional -- sin ella, el anuncio se ve igual que un aviso
// propio (fondo degradado, ver avisoSlideHtml en carta.js), solo que
// marcado "Publicidad" en vez de "Promoción".
let _anuncioImagenPendiente = null;
function onElegirImagenAnuncio(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  _anuncioImagenPendiente = file;
  const reader = new FileReader();
  reader.onload = () => pintarPreviewImagenAnuncio(reader.result);
  reader.readAsDataURL(file);
}
function pintarPreviewImagenAnuncio(src) {
  const cont = $("#anuncio-imagen-preview");
  if (!cont) return;
  cont.innerHTML = src ? `<img src="${esc(src)}" alt="" style="width:100px;height:100px;object-fit:cover;border-radius:10px;border:1px solid var(--linea)">` : "";
}
async function guardarAnuncio() {
  const titulo = $("#anuncio-titulo")?.value.trim();
  if (!titulo) { alert("Escribe el título"); return; }
  const btn = $("#anuncio-guardar");
  btn.disabled = true; btn.textContent = "Guardando…";
  let imagenUrl = $("#anuncio-imagen-url")?.value.trim() || null;
  if (_anuncioImagenPendiente) {
    const ext = (_anuncioImagenPendiente.name.split(".").pop() || "jpg").toLowerCase();
    const path = `contaclub-anuncio-${Date.now()}-${Math.random().toString(36).substr(2, 5)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("contenido").upload(path, _anuncioImagenPendiente, { upsert: true });
    if (upErr) {
      btn.disabled = false; btn.textContent = "Guardar anuncio";
      alert("No se pudo subir la imagen: " + upErr.message);
      return;
    }
    imagenUrl = supabase.storage.from("contenido").getPublicUrl(path).data.publicUrl;
  }
  const payload = {
    titulo, imagen_url: imagenUrl,
    descripcion: $("#anuncio-descripcion")?.value.trim() || null,
    link: $("#anuncio-link")?.value.trim() || null,
    activo: $("#anuncio-activo")?.checked ?? true,
  };
  const id = $("#anuncio-id")?.value;
  const { error } = id
    ? await supabase.from("contaclub_anuncios").update(payload).eq("id", id)
    : await supabase.from("contaclub_anuncios").insert({ ...payload, orden: _anuncios.length });
  btn.disabled = false; btn.textContent = "Guardar anuncio";
  if (error) { alert("No se pudo guardar: " + error.message); return; }
  resetFormAnuncio();
  await cargarAnuncios();
}

/* ---------- Llave de pago (config global, una sola fila) ---------- */
async function cargarConfigPago() {
  const { data } = await supabase.from("contaclub_config").select("*").eq("id", true).maybeSingle();
  if (!data) return;
  const llaveEl = $("#pago-llave"); if (llaveEl) llaveEl.value = data.llave_pago || "";
  const qrEl = $("#pago-qr-url"); if (qrEl) qrEl.value = data.llave_qr_url || "";
  pintarPreviewQr();
}
function pintarPreviewQr() {
  const cont = $("#pago-qr-preview");
  const url = $("#pago-qr-url")?.value.trim();
  if (!cont) return;
  cont.innerHTML = url ? `<img src="${esc(url)}" alt="" style="width:120px;height:120px;border-radius:10px;border:1px solid var(--linea);object-fit:cover">` : "";
}
async function guardarConfigPago() {
  const btn = $("#pago-guardar");
  btn.disabled = true; btn.textContent = "Guardando…";
  const { error } = await supabase.from("contaclub_config").update({
    llave_pago: $("#pago-llave")?.value.trim() || null,
    llave_qr_url: $("#pago-qr-url")?.value.trim() || null,
  }).eq("id", true);
  btn.disabled = false; btn.textContent = "Guardar";
  if (error) alert("No se pudo guardar: " + error.message);
}

document.addEventListener("DOMContentLoaded", iniciar);
