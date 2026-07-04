// Fonction "upload" : reçoit un fichier, vérifie le quota INDIVIDUEL de
// l'utilisateur (somme des tailles de SES documents contre son max_bytes),
// puis l'enregistre dans le store "docs" avec son propriétaire.

import { randomBytes } from "node:crypto";
import { json, exigerUtilisateur, tailleLisible, ouvrirStore } from "./_lib/utils.mjs";

export default async (requete) => {
  if (requete.method !== "POST") {
    return json({ erreur: "Méthode non autorisée." }, 405);
  }

  // L'upload est protégé par le code d'accès (défense côté serveur : valider
  // le code une fois sur la page ne suffirait pas, un attaquant pourrait
  // appeler cette fonction directement).
  const { utilisateur, erreur } = exigerUtilisateur(requete);
  if (erreur) return erreur;

  // Nom de fichier d'origine, transmis encodé dans un en-tête.
  const nomBrut = requete.headers.get("x-file-name") || "document";
  const nom = decodeURIComponent(nomBrut);
  const typeMime = requete.headers.get("content-type") || "application/octet-stream";

  // Lecture du fichier envoyé en corps de requête binaire.
  const contenu = await requete.arrayBuffer();
  const taille = contenu.byteLength;
  if (taille === 0) {
    return json({ erreur: "Fichier vide ou manquant." }, 400);
  }

  const docs = ouvrirStore("docs");

  // --- Vérification du quota individuel --------------------------------
  // On additionne la taille des seuls documents dont owner_code est le code
  // de l'appelant, et on compare à SON max_bytes.
  let totalUtilise = 0;
  const { blobs } = await docs.list();
  for (const blob of blobs) {
    const meta = await docs.getMetadata(blob.key);
    if (meta?.metadata?.owner_code === utilisateur.code) {
      totalUtilise += Number(meta.metadata.taille) || 0;
    }
  }

  if (totalUtilise + taille > utilisateur.maxBytes) {
    return json(
      {
        erreur:
          `Quota dépassé pour ${utilisateur.label} : ${tailleLisible(totalUtilise)} ` +
          `utilisés sur ${tailleLisible(utilisateur.maxBytes)}. ` +
          `Ce fichier fait ${tailleLisible(taille)}.`,
      },
      413
    );
  }

  // --- Enregistrement ---------------------------------------------------
  // Token aléatoire non devinable (128 bits, encodé en base64 URL-safe).
  const token = randomBytes(16).toString("base64url");

  await docs.set(token, contenu, {
    metadata: {
      nom,                             // nom de fichier d'origine
      taille,                          // taille en octets
      date: new Date().toISOString(),  // date d'import
      type: typeMime,                  // type MIME, réutilisé au téléchargement
      owner_code: utilisateur.code,    // propriétaire du document
      owner_label: utilisateur.label,  // label figé au moment de l'upload
    },
  });

  // Le frontend générera le QR code à partir de cette URL publique.
  return json({ token, url: `/d/${token}` });
};
