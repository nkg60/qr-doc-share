// Fonction "auth" : vérifie le code d'accès à 6 chiffres.
// Le code n'est jamais présent dans le frontend : il est comparé ici,
// côté serveur, à la variable d'environnement ACCESS_CODE.

import { json, codeValide } from "./_lib/utils.mjs";

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

  const valide = codeValide(String(corps.code ?? ""));
  // On répond simplement valide/invalide, sans jamais renvoyer le code attendu.
  return json({ valide });
};
