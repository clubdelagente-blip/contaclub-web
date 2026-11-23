/* ============================================================
   ContaClub — completar perfil (primer login/registro). Solo
   nombre + foto -- la categoría ("Heladería", etc.) la pide el
   propio dashboard.js (abrirSelectorTipoNegocio) automáticamente
   en el primer ingreso, así que no se repite acá.
   ============================================================ */
import { supabase } from 'https://elclubdelagente.com/supabase.js';
import { comprimirImagen } from 'https://elclubdelagente.com/imagen.js';

const $ = (s) => document.querySelector(s);

let _negocio = null;
let _fotoFile = null;

async function cargarNegocio() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = "login.html"; return; }
  const { data: negocio } = await supabase.from("aliados").select("id, nombre, imagen_url").eq("user_id", session.user.id).maybeSingle();
  if (!negocio) { location.href = "login.html"; return; }
  _negocio = negocio;
  $("#fp-nombre").value = negocio.nombre || "";
  if (negocio.imagen_url) $("#fp-preview").style.backgroundImage = `url(${negocio.imagen_url})`;
}
cargarNegocio();

$("#fp-foto")?.addEventListener("change", () => {
  _fotoFile = $("#fp-foto").files?.[0] || null;
  if (_fotoFile) $("#fp-preview").style.backgroundImage = `url(${URL.createObjectURL(_fotoFile)})`;
});

$("#fp-btn")?.addEventListener("click", async () => {
  const nombre = $("#fp-nombre").value.trim();
  const err = $("#fp-error");
  err.hidden = true;
  if (!nombre) {
    err.textContent = "Escribe el nombre de tu negocio.";
    err.hidden = false;
    return;
  }
  const btn = $("#fp-btn");
  btn.disabled = true;
  btn.textContent = "Guardando…";

  const cambios = { nombre };
  if (_fotoFile) {
    const file = await comprimirImagen(_fotoFile);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `contaclub-perfil-${_negocio.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("contenido").upload(path, file, { upsert: true });
    if (upErr) {
      btn.disabled = false;
      btn.textContent = "Continuar";
      err.textContent = "No pudimos subir la foto. Intenta de nuevo.";
      err.hidden = false;
      return;
    }
    cambios.imagen_url = supabase.storage.from("contenido").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("aliados").update(cambios).eq("id", _negocio.id);
  btn.disabled = false;
  btn.textContent = "Continuar";
  if (error) {
    err.textContent = "Tu negocio se guardó, pero hubo un problema. Escríbenos.";
    err.hidden = false;
    return;
  }
  location.href = "pagar-implementacion.html";
});
