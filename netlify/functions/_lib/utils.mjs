// Utilitaires partagés par les fonctions Netlify.
// Ce dossier commence par "_" : il n'est pas exposé comme une fonction.

import { timingSafeEqual, randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";

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
 * Formate une taille en octets de façon lisible (octets, Ko ou Mo).
 */
export function tailleLisible(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${n} octets`;
}

// Quota legacy par défaut si MAX_TOTAL_BYTES n'était pas défini : 100 Mo.
const QUOTA_LEGACY_PAR_DEFAUT = 100 * 1024 * 1024;

/**
 * Charge le dictionnaire des utilisateurs depuis la variable ACCESS_CODES :
 *   { "123456": { "label": "Ghislain", "max_bytes": 104857600, "is_admin": true }, ... }
 *
 * Migration douce V1 -> V1.1 : si ACCESS_CODES est absent mais que l'ancien
 * ACCESS_CODE existe, on reconstruit à la volée un dictionnaire équivalent
 * avec un seul utilisateur "legacy" (admin, comme en V1 où le code unique
 * voyait tout) et l'ancien quota MAX_TOTAL_BYTES.
 *
 * Ce dictionnaire ne quitte JAMAIS le serveur.
 */
export function chargerUtilisateurs() {
  const brut = process.env.ACCESS_CODES;
  if (brut) {
    let dico;
    try {
      dico = JSON.parse(brut);
    } catch {
      // JSON invalide : on refuse tout plutôt que d'ouvrir l'accès.
      console.error("ACCESS_CODES n'est pas un JSON valide : tous les accès sont refusés.");
      return {};
    }
    const utilisateurs = {};
    for (const [code, infos] of Object.entries(dico)) {
      utilisateurs[code] = {
        label: String(infos?.label ?? code),
        maxBytes: Number(infos?.max_bytes) || 0,
        isAdmin: infos?.is_admin === true,
      };
    }
    return utilisateurs;
  }

  // Migration douce : anciennes variables V1.
  const ancienCode = process.env.ACCESS_CODE;
  if (ancienCode) {
    return {
      [ancienCode]: {
        label: "legacy",
        maxBytes: Number(process.env.MAX_TOTAL_BYTES) || QUOTA_LEGACY_PAR_DEFAUT,
        isAdmin: true,
      },
    };
  }

  return {};
}

/**
 * Compare deux chaînes en temps constant.
 */
function memesChaines(a, b) {
  const ta = Buffer.from(String(a));
  const tb = Buffer.from(String(b));
  if (ta.length !== tb.length) return false;
  return timingSafeEqual(ta, tb);
}

/**
 * Vérifie un code fourni contre TOUS les codes connus, sans sortie anticipée :
 * le temps de réponse ne dépend ni de l'existence du code ni de sa position.
 * Renvoie l'utilisateur { code, label, maxBytes, isAdmin } ou null.
 */
export function verifierCode(codeFourni) {
  const utilisateurs = chargerUtilisateurs();
  let trouve = null;
  for (const [code, infos] of Object.entries(utilisateurs)) {
    if (memesChaines(codeFourni, code)) {
      trouve = { code, ...infos };
    }
  }
  return trouve;
}

/**
 * Exige un code d'accès valide dans l'en-tête X-Access-Code.
 * Renvoie { utilisateur } si valide, sinon { erreur: Response 401 }.
 */
export function exigerUtilisateur(requete) {
  const code = requete.headers.get("x-access-code") || "";
  const utilisateur = verifierCode(code);
  if (!utilisateur) {
    return { erreur: json({ erreur: "Code d'accès invalide." }, 401) };
  }
  return { utilisateur };
}

/**
 * Vérifie qu'un utilisateur a le droit d'agir sur un document :
 * il en est le propriétaire, OU il est admin (ce qui couvre aussi les
 * documents "legacy" sans owner_code, sinon personne ne pourrait les gérer).
 * Renvoie null si autorisé, sinon une Response 403.
 */
export function exigerProprietaire(utilisateur, metadonneesDoc) {
  const proprietaire = metadonneesDoc?.owner_code;
  const autorise = proprietaire === utilisateur.code || utilisateur.isAdmin;
  if (!autorise) {
    return json({ erreur: "Vous n'êtes pas le propriétaire de ce document." }, 403);
  }
  return null;
}

/**
 * Traçabilité : journalise dans le store "admin_actions" toute action d'un
 * admin sur un document dont il n'est PAS propriétaire (y compris legacy).
 * À appeler après exigerProprietaire : si l'appelant n'est pas propriétaire
 * et a quand même été autorisé, c'est nécessairement un admin.
 */
export async function journaliserActionAdmin(utilisateur, action, token, metadonneesDoc) {
  if (metadonneesDoc?.owner_code === utilisateur.code) return; // action sur son propre document : rien à tracer
  const journal = getStore("admin_actions");
  const cle = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  await journal.setJSON(cle, {
    timestamp: new Date().toISOString(),
    admin_code: utilisateur.code,
    admin_label: utilisateur.label,
    action,                                          // "delete" ou "rotate"
    document_id: token,
    owner_code: metadonneesDoc?.owner_code ?? null,  // null = document legacy
  });
}
