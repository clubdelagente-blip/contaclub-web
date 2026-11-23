/* ============================================================
   ContaClub — landing pública. Trae los planes reales desde
   contaclub_planes (el mismo panel que administra el Admin de
   ContaClub, ver admin.html) en vez de precios quemados acá -- si
   cambian un precio en el Admin, se refleja solo. Elegir un plan
   solo GUARDA la elección (localStorage) y manda a registro.html --
   el plan de verdad se asigna a la fila de "aliados" recién creada
   (ver registro.js), nunca antes de que exista la cuenta.
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';

const $ = (s) => document.querySelector(s);
const nf = new Intl.NumberFormat("es-CO");
const COP = (n) => "$" + nf.format(Math.round(n || 0));

async function cargarPlanes() {
  const cont = $("#planes-lista");
  if (!cont) return;
  const { data: planes } = await supabase.from("contaclub_planes").select("*").eq("activo", true).order("orden");
  if (!planes?.length) {
    cont.innerHTML = `<p style="text-align:center;color:var(--tinta-45);grid-column:1/-1">Todavía no hay paquetes disponibles -- escríbenos.</p>`;
    return;
  }
  cont.innerHTML = planes.map(p => {
    const cobro = p.mensualidad != null
      ? `${COP(p.mensualidad)} <span style="font-size:13px;font-weight:400;color:var(--tinta-60)">/mes</span>`
      : p.umbral_facturacion != null
      ? `${(Number(p.porcentaje_volumen) * 100).toFixed(1).replace(/\.0$/, "")}% <span style="font-size:13px;font-weight:400;color:var(--tinta-60)">de lo que factures sobre ${COP(p.umbral_facturacion)}/mes</span>`
      : "";
    return `
    <div class="cc-plan">
      <div class="cc-plan__nombre">${esc(p.nombre)}</div>
      <div class="cc-plan__impl">Implementación ${COP(p.implementacion)} <span style="font-weight:400;color:var(--tinta-60)">(pago único)</span></div>
      <div class="cc-plan__cobro">${cobro}</div>
      <button type="button" class="btn btn--primario" data-plan="${p.id}" style="width:100%;justify-content:center;margin-top:14px">Elegir este plan</button>
    </div>`;
  }).join("");
  cont.querySelectorAll("[data-plan]").forEach(btn => btn.addEventListener("click", () => {
    try { localStorage.setItem("contaclub_plan_id", btn.dataset.plan); } catch {}
    location.href = "registro.html";
  }));
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

cargarPlanes();
