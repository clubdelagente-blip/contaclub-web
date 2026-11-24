/* ============================================================
   ContaClub — decide si una cuenta nace activa o pendiente de aprobar un
   pago, según el plan elegido ANTES de registrarse (ver index.js). Un plan
   con mensualidad fija (Básico/Pro) exige pagar el primer mes antes de
   usar el dashboard -- nace "contaclub_activo = false", y dashboard.js
   bloquea el panel hasta que el Admin apruebe el comprobante
   (pagar-implementacion.js). Un plan sin mensualidad fija (Premium, %
   variable) no tiene nada que cobrar de entrada -- nace activa; su
   implementación sigue siendo opcional.
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';

export async function calcularActivoInicial(planId) {
  if (!planId) return true; // sin plan elegido todavía, nada que bloquear
  const { data: plan } = await supabase.from("contaclub_planes").select("mensualidad").eq("id", planId).maybeSingle();
  return plan?.mensualidad == null;
}
