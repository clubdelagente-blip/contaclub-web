import { supabase } from 'https://elclubdelagente.com/supabase.js';

const $ = (s) => document.querySelector(s);

$("#rec-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#rec-email").value.trim();
  if (!email) return;
  const btn = $("#rec-btn");
  btn.disabled = true;
  btn.textContent = "Enviando…";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/restablecer.html`,
  });
  btn.disabled = false;
  btn.textContent = "Enviar link";
  // Siempre se muestra éxito, sin importar si el correo existe o no --
  // así no se puede usar este formulario para averiguar qué correos
  // tienen cuenta (enumeración de usuarios).
  $("#rec-wrap").hidden = true;
  $("#rec-exito").hidden = false;
});
