/* ============================================================
   ContaClub — panel admin interno (solo El Club de la Gente, no el
   negocio). Proyecto propio y separado del Admin.html del Club -- esto
   SOLO gestiona negocios de ContaClub (contaclub_standalone=true): su
   paquete contratado y los cobros mensuales por volumen de facturación.
   Reusa el mismo Supabase (cliente compartido, cargado cruzado) y el
   mismo rol "admin" de perfiles -- el mismo equipo administra los dos
   proyectos, solo que desde paneles distintos.
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const nf = new Intl.NumberFormat("es-CO");
const COP = (n) => "$" + nf.format(Math.round(n || 0));

async function iniciar() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = "login.html"; return; }
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", session.user.id).maybeSingle();
  if (perfil?.rol !== "admin") { location.href = "dashboard.html"; return; }

  $("#admin-salir")?.addEventListener("click", async () => { await supabase.auth.signOut(); location.href = "login.html"; });
  $("#calcular-cobros-btn")?.addEventListener("click", calcularCobros);

  await Promise.all([cargarNegocios(), cargarCobros()]);
}

async function cargarNegocios() {
  const { data } = await supabase.from("aliados")
    .select("id, nombre, whatsapp, contaclub_plan, contaclub_implementacion_pagada")
    .eq("contaclub_standalone", true).order("nombre");
  pintarNegocios(data || []);
}
function pintarNegocios(negocios) {
  const cont = $("#negocios-lista");
  if (!cont) return;
  if (!negocios.length) {
    cont.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--tinta-45)">Todavía no hay negocios de ContaClub registrados.</td></tr>`;
    return;
  }
  cont.innerHTML = negocios.map(n => `
    <tr>
      <td>${esc(n.nombre)}</td>
      <td>${esc(n.whatsapp || "—")}</td>
      <td>
        <select class="cc-campo-select" data-plan="${n.id}">
          <option value="" ${!n.contaclub_plan ? "selected" : ""}>Sin plan</option>
          <option value="basico" ${n.contaclub_plan === "basico" ? "selected" : ""}>Paquete 1 · Básico</option>
          <option value="volumen" ${n.contaclub_plan === "volumen" ? "selected" : ""}>Paquete 2 · Por volumen</option>
        </select>
      </td>
      <td style="text-align:center"><input type="checkbox" data-impl="${n.id}" ${n.contaclub_implementacion_pagada ? "checked" : ""}></td>
    </tr>`).join("");
  $$("[data-plan]", cont).forEach(sel => sel.addEventListener("change", () => guardarNegocio(sel.dataset.plan)));
  $$("[data-impl]", cont).forEach(chk => chk.addEventListener("change", () => guardarNegocio(chk.dataset.impl)));
}
async function guardarNegocio(id) {
  const plan = $(`[data-plan="${id}"]`)?.value || null;
  const impl = $(`[data-impl="${id}"]`)?.checked || false;
  await supabase.from("aliados").update({ contaclub_plan: plan, contaclub_implementacion_pagada: impl }).eq("id", id);
}

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
  alert(`Listo -- ${data?.length || 0} negocio(s) superaron los $10.000.000 en ${pMes.slice(0, 7)} y quedaron con cobro pendiente.`);
  await cargarCobros();
}

async function cargarCobros() {
  const { data } = await supabase.from("contaclub_cobros_mensuales").select("*, aliados(nombre)").order("mes", { ascending: false });
  pintarCobros(data || []);
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

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

document.addEventListener("DOMContentLoaded", iniciar);
