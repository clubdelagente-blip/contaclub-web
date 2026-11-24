/* ============================================================
   ContaClub — landing pública. Trae los planes reales desde
   contaclub_planes (el mismo panel que administra el Admin de
   ContaClub, ver admin.html) en vez de precios quemados acá -- si
   cambian un precio o las características en el Admin, se reflejan
   solas. Elegir un plan solo GUARDA la elección (localStorage) y
   manda a registro.html -- el plan de verdad se asigna a la fila de
   "aliados" recién creada (ver registro.js), nunca antes de que
   exista la cuenta.
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';

const $ = (s) => document.querySelector(s);
const nf = new Intl.NumberFormat("es-CO");
const COP = (n) => "$" + nf.format(Math.round(n || 0));
const pct = (n) => Number(n * 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

function receiptHtml(p) {
  const esFijo = p.mensualidad != null;
  const planFor = p.nivel === 1
    ? "Para negocios que están arrancando con el pedido digital"
    : esFijo
    ? "Para negocios con ventas estables que quieren todo incluido"
    : "Para negocios que no quieren mensualidad fija";
  const features = String(p.caracteristicas || "").split("\n").map(f => f.trim()).filter(Boolean);
  const featuresHtml = features.length ? `<ul class="receipt-features">${features.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : "";

  let cuerpo;
  if (esFijo) {
    const totalPrimerMes = Number(p.implementacion || 0) + Number(p.mensualidad || 0);
    cuerpo = `
      <div class="line-item"><span class="desc">Implementación (una vez)</span><span class="fill"></span><span class="amt mono">${COP(p.implementacion)}</span></div>
      <div class="line-item"><span class="desc">Mensualidad, todo incluido</span><span class="fill"></span><span class="amt mono">${COP(p.mensualidad)}</span></div>
      <hr>
      <div class="line-item total"><span class="desc">Total primer mes</span><span class="fill"></span><span class="amt mono">${COP(totalPrimerMes)}</span></div>
      <div style="text-align:center"><span class="badge-cero">Desde el mes 2: ${COP(p.mensualidad)}/mes fijo</span></div>
      <p class="note">COP · 0% comisión por pedido · Cancela cuando quieras</p>`;
  } else {
    const leyendaPct = p.umbral_facturacion != null
      ? `de lo que factures sobre ${COP(p.umbral_facturacion)}/mes, cobrado cada mes`
      : `de todo lo que factures por la carta, cada mes`;
    cuerpo = `
      <div class="line-item total"><span class="desc">Para empezar</span><span class="fill"></span><span class="amt mono">$0</span></div>
      <div class="recurring-row"><span class="amt mono">${pct(p.porcentaje_volumen)}%</span><span class="lbl">${leyendaPct}</span></div>
      ${p.implementacion ? `
      <div class="line-item" style="margin-top:10px"><span class="desc">Implementación personalizada (opcional)</span><span class="fill"></span><span class="amt mono">${COP(p.implementacion)}</span></div>
      <p class="note" style="margin-top:4px">Si la contratas, no se te cobra el ${pct(p.porcentaje_volumen)}% durante los primeros 2 meses.</p>` : ""}
      <p class="note">COP · Sin mensualidad fija · Cancela cuando quieras</p>`;
  }

  return `
  <div class="package-col">
    <div class="plan-head"><span class="plan-name">${esc(p.nombre)}</span><span class="plan-for">${planFor}</span></div>
    <div class="receipt-edge top"></div>
    <div class="receipt">
      <h3>Tu factura ContaClub</h3>
      <div class="brand-name">${esc(p.nombre)}</div>
      <hr>
      ${cuerpo}
      ${featuresHtml}
      <div class="elegir"><button type="button" class="btn btn--primario" data-plan="${p.id}" style="width:100%">Elegir este plan</button></div>
    </div>
    <div class="receipt-edge bottom"></div>
  </div>`;
}

async function cargarPlanes() {
  const cont = $("#planes-lista");
  if (!cont) return;
  const { data: planes } = await supabase.from("contaclub_planes").select("*").eq("activo", true).order("orden");
  if (!planes?.length) {
    cont.innerHTML = `<p class="muted" style="text-align:center;padding:20px 0">Todavía no hay paquetes disponibles -- escríbenos.</p>`;
    return;
  }
  cont.innerHTML = `<div class="packages">${planes.map(receiptHtml).join("")}</div>`;
  cont.querySelectorAll("[data-plan]").forEach(btn => btn.addEventListener("click", () => {
    try { localStorage.setItem("contaclub_plan_id", btn.dataset.plan); } catch {}
    location.href = "registro.html";
  }));
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

cargarPlanes();
