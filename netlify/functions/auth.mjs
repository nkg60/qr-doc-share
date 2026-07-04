// Fonction "auth" : vérifie le code d'accès à 6 chiffres.
// Le dictionnaire ACCESS_CODES n'est jamais envoyé au frontend : la
// comparaison se fait ici, côté serveur, en temps constant.

import { json, verifierCode } from "./_lib/utils.mjs";

export default async (requete) => {
  if (requete.method !== "POST") {
    return json({ erreur: "Méthode non autorisée." }, 405);
  }

  let corps;
  try {
    corps = await requete.json();
  } catch {
    return json({ erreur: "Corps de requête invalide." }, 400);
  }

  const utilisateur = verifierCode(String(corps.code ?? ""));
  if (!utilisateur) {
    return json({ valide: false });
  }

  // On ne renvoie que ce dont l'interface a besoin : jamais les codes,
  // jamais les quotas des autres utilisateurs.
  return json({
    valide: true,
    label: utilisateur.label,
    isAdmin: utilisateur.isAdmin,
  });
};
