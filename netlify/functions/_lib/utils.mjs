// Utilitaires partagés par les fonctions Netlify.
// Ce dossier commence par "_" : il n'est pas exposé comme une fonction.

import { timingSafeEqual } from "node:crypto";

/**
 * Construit une réponse JSON avec le bon en-tête.
 */
export function json(donnees, statut = 200) {
  return new Response(JSON.stringify(donnees), {
    status: statut,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * Compare le code fourni au code attendu (variable d'environnement ACCESS_CODE)
 * en temps constant, pour ne pas divulguer d'information par mesure du temps.
 */
export function codeValide(codeFourni) {
  const attendu = process.env.ACCESS_CODE;
  if (!attendu) {
    // Variable non configurée : on refuse tout par sécurité.
    return false;
  }
  if (typeof codeFourni !== "string") return false;
  const a = Buffer.from(codeFourni);
  const b = Buffer.from(attendu);
  // timingSafeEqual exige des tampons de même longueur.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Vérifie le code d'accès transmis dans l'en-tête X-Access-Code d'une requête.
 * Renvoie une Response d'erreur si invalide, ou null si tout va bien.
 */
export function exigerCode(requete) {
  const code = requete.headers.get("x-access-code") || "";
  if (!codeValide(code)) {
    return json({ erreur: "Code d'accès invalide." }, 401);
  }
  return null;
}
