/* ============================================================
   ContaClub — landing pública. Trae los planes reales desde
   contaclub_planes (el mismo panel que administra el Admin de
   ContaClub, ver admin.html) en vez de precios quemados acá -- si
   cambian un precio en el Admin, se refleja solo, incluyendo la
   caja "¿Cuál te conviene?" (el punto de equilibrio se recalcula
   con los números reales, no está escrito a mano). Elegir un plan
   solo GUARDA la elección (localStorage) y manda a registro.html --
   el plan de verdad se asigna a la fila de "aliados" recién creada
   (ver registro.js), nunca antes de que exista la cuenta.
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';

const $ = (s) => document.querySelector(s);
const nf = new Intl.NumberFormat("es-CO");
const COP = (n) => "$" + nf.format(Math.round(n || 0));
const pct = (n) => Number(n * 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

function receiptHtml(p) {
  const esFijo = p.mensualidad != null;
  const planFor = esFijo
    ? "Para negocios con ventas ya estables por la carta"
    : "Para negocios que están probando el pedido digital";
  const totalPrimerMes = esFijo ? Number(p.implementacion || 0) + Number(p.mensualidad || 0) : Number(p.implementacion || 0);

  return `
  <div class="package-col">
    <div class="plan-head"><span class="plan-name">${esc(p.nombre)}</span><span class="plan-for">${planFor}</span></div>
    <div class="receipt-edge top"></div>
    <div class="receipt">
      <h3>Tu factura ContaClub</h3>
      <div class="brand-name">${esc(p.nombre)}</div>
      <hr>
      <div class="line-item"><span class="desc">Implementación (una vez)</span><span class="fill"></span><span class="amt mono">${COP(p.implementacion)}</span></div>
      ${esFijo ? `<div class="line-item"><span class="desc">Mensualidad, todo incluido</span><span class="fill"></span><span class="amt mono">${COP(p.mensualidad)}</span></div>` : ""}
      <hr>
      <div class="line-item total"><span class="desc">${esFijo ? "Total primer mes" : "Para empezar"}</span><span class="fill"></span><span class="amt mono">${COP(totalPrimerMes)}</span></div>
      ${esFijo
        ? `<div style="text-align:center"><span class="badge-cero">Desde el mes 2: ${COP(p.mensualidad)}/mes fijo</span></div>`
        : `<div class="recurring-row"><span class="amt mono">${pct(p.porcentaje_volumen)}%</span><span class="lbl">de lo que factures sobre ${COP(p.umbral_facturacion)}/mes, cobrado cada mes</span></div>`}
      <p class="note">COP · ${esFijo ? "0% comisión por pedido" : "Sin mensualidad fija"} · Cancela cuando quieras</p>
      <div class="elegir"><button type="button" class="btn btn--primario" data-plan="${p.id}" style="width:100%">Elegir este plan</button></div>
    </div>
    <div class="receipt-edge bottom"></div>
  </div>`;
}

function decisionHtml(planes) {
  const fijo = planes.find(p => p.mensualidad != null);
  const variable = planes.find(p => p.umbral_facturacion != null && p.porcentaje_volumen != null);
  if (!fijo || !variable) return "";
  const breakeven = Number(variable.umbral_facturacion) + Number(fijo.mensualidad) / Number(variable.porcentaje_volumen);
  return `
  <div class="decision">
    <span class="tag">¿Cuál te conviene?</span>
    <p>El punto de equilibrio está en cuánto vendes por la carta cada mes:</p>
    <p class="calc">${COP(variable.umbral_facturacion)} + ${COP(fijo.mensualidad)} ÷ ${pct(variable.porcentaje_volumen)}% ≈ ${COP(breakeven)} COP de pedidos pagados al mes</p>
    <p><strong>Menos de ~${COP(breakeven)}/mes en pedidos:</strong> ${esc(variable.nombre)} te cuesta menos -- pagas poco en los meses flojos y nada de mensualidad fija mientras validas si el pedido digital funciona en tu negocio.</p>
    <p><strong>Más de ~${COP(breakeven)}/mes en pedidos:</strong> ${esc(fijo.nombre)} te sale más barato, porque la mensualidad no sube así vendas más.</p>
  </div>`;
}

async function cargarPlanes() {
  const cont = $("#planes-lista");
  const decisionCont = $("#decision-box");
  if (!cont) return;
  const { data: planes } = await supabase.from("contaclub_planes").select("*").eq("activo", true).order("orden");
  if (!planes?.length) {
    cont.innerHTML = `<p class="muted" style="text-align:center;padding:20px 0">Todavía no hay paquetes disponibles -- escríbenos.</p>`;
    return;
  }
  cont.innerHTML = `<div class="packages">${planes.map(receiptHtml).join("")}</div>`;
  if (decisionCont) decisionCont.innerHTML = decisionHtml(planes);
  cont.querySelectorAll("[data-plan]").forEach(btn => btn.addEventListener("click", () => {
    try { localStorage.setItem("contaclub_plan_id", btn.dataset.plan); } catch {}
    location.href = "registro.html";
  }));
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

cargarPlanes();
