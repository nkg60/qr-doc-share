// Logique de la page « Mes documents » (mes-documents.html).
// Liste les documents de l'utilisateur connecté, avec trois actions :
//   1. Voir / re-télécharger le QR code (le token ne change pas — tout se
//      fait côté client à partir du token renvoyé par list-docs) ;
//   2. Régénérer l'URL (rotation du token, avec confirmation) ;
//   3. Supprimer le document (avec confirmation, scans conservés).
// Un admin voit aussi les documents "legacy" (sans propriétaire) à part.

const labelUtilisateur = document.getElementById("label-utilisateur");
const badgeAdmin = document.getElementById("badge-admin");
const listeDocuments = document.getElementById("liste-documents");
const msgDocuments = document.getElementById("msg-documents");
const sectionLegacy = document.getElementById("section-legacy");
const listeLegacy = document.getElementById("liste-legacy");

const sectionQr = document.getElementById("section-qr");
const titreQr = document.getElementById("titre-qr");
const apercuQr = document.getElementById("apercu-qr");
const urlPublique = document.getElementById("url-publique");
const btnTelechargerQr = document.getElementById("btn-telecharger-qr");
const btnCopierUrl = document.getElementById("btn-copier-url");
const btnFermerQr = document.getElementById("btn-fermer-qr");
const msgQr = document.getElementById("msg-qr");

// Le code validé sur la page d'accueil est partagé via sessionStorage.
// Sans code, retour à l'accueil (le serveur re-vérifie de toute façon).
const codeAcces = sessionStorage.getItem("codeAcces") || "";
if (!codeAcces) location.href = "/";

// Déconnexion : efface tout l'état côté client et revient à l'écran du code.
document.getElementById("btn-deconnexion").addEventListener("click", () => {
  sessionStorage.removeItem("codeAcces");
  sessionStorage.removeItem("labelUtilisateur");
  sessionStorage.removeItem("isAdmin");
  location.href = "/";
});

/** Affiche un message d'état. */
function afficherMessage(element, texte, type) {
  element.textContent = texte;
  element.className = "message " + (type || "");
  element.hidden = !texte;
}

/** Formate une taille en octets de façon lisible (Ko/Mo). */
function tailleLisible(n) {
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " Mo";
  if (n >= 1024) return (n / 1024).toFixed(1) + " Ko";
  return n + " octets";
}

// --- Affichage du QR code d'un document ---------------------------------------

/** Affiche le QR code et l'URL publique d'un document (sans changer son token). */
async function afficherQr(doc) {
  const urlAbsolue = location.origin + "/d/" + doc.token;
  apercuQr.innerHTML = "";
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, urlAbsolue, { width: 260, margin: 2 });
  apercuQr.appendChild(canvas);

  titreQr.textContent = "QR code — " + doc.nom;
  urlPublique.textContent = urlAbsolue;
  afficherMessage(msgQr, "", "");
  sectionQr.hidden = false;
  sectionQr.scrollIntoView({ behavior: "smooth" });
}

btnTelechargerQr.addEventListener("click", () => {
  const canvas = apercuQr.querySelector("canvas");
  if (!canvas) return;
  const lien = document.createElement("a");
  lien.href = canvas.toDataURL("image/png");
  lien.download = "qr-code-document.png";
  lien.click();
});

btnCopierUrl.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(urlPublique.textContent);
    afficherMessage(msgQr, "URL copiée dans le presse-papiers.", "ok");
  } catch {
    afficherMessage(msgQr, "Impossible de copier automatiquement. Sélectionnez l'URL ci-dessus.", "erreur");
  }
});

btnFermerQr.addEventListener("click", () => {
  sectionQr.hidden = true;
});

// --- Actions serveur ------------------------------------------------------------

/** Appel POST JSON d'une fonction protégée, avec le code d'accès. */
async function appelerFonction(nom, corps) {
  const reponse = await fetch("/.netlify/functions/" + nom, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Access-Code": codeAcces,
    },
    body: JSON.stringify(corps),
  });
  const donnees = await reponse.json();
  if (!reponse.ok) throw new Error(donnees.erreur || "Erreur serveur.");
  return donnees;
}

/** Rotation du token : l'ancienne URL et l'ancien QR cessent de fonctionner. */
async function regenererUrl(doc) {
  const ok = confirm(
    "L'ancien QR code et l'ancienne URL ne fonctionneront plus. Continuer ?"
  );
  if (!ok) return;

  try {
    const donnees = await appelerFonction("rotate-token", { token: doc.token });
    await chargerDocuments();
    // On affiche immédiatement le nouveau QR code.
    await afficherQr({ token: donnees.token, nom: doc.nom });
    afficherMessage(msgQr, "Nouvelle URL générée. L'ancienne est désactivée.", "ok");
  } catch (erreur) {
    afficherMessage(msgDocuments, erreur.message, "erreur");
  }
}

/** Suppression définitive d'un document (les scans collectés sont conservés). */
async function supprimerDocument(doc) {
  const ok = confirm(
    `Supprimer définitivement ${doc.nom} ? ` +
    "Les scans déjà collectés seront conservés dans l'export CSV."
  );
  if (!ok) return;

  try {
    await appelerFonction("delete-doc", { token: doc.token });
    sectionQr.hidden = true;
    await chargerDocuments();
    afficherMessage(msgDocuments, `« ${doc.nom} » supprimé.`, "ok");
  } catch (erreur) {
    afficherMessage(msgDocuments, erreur.message, "erreur");
  }
}

// --- Construction du tableau ------------------------------------------------------

/** Construit le tableau d'une liste de documents (les miens, ou les legacy). */
function construireTableau(documents) {
  const table = document.createElement("table");
  const entete = table.insertRow();
  for (const titre of ["Nom", "Taille", "Date", "Scans", "Actions"]) {
    const th = document.createElement("th");
    th.textContent = titre;
    entete.appendChild(th);
  }

  for (const doc of documents) {
    const ligne = table.insertRow();
    ligne.insertCell().textContent = doc.nom;
    ligne.insertCell().textContent = tailleLisible(doc.taille);
    ligne.insertCell().textContent = doc.date
      ? new Date(doc.date).toLocaleString("fr-FR")
      : "—";
    ligne.insertCell().textContent = String(doc.nbScans);

    // Les 3 actions : QR (inoffensif), rotation et suppression (confirmées).
    const cellule = ligne.insertCell();
    cellule.className = "cellule-actions";

    const btnQr = document.createElement("button");
    btnQr.textContent = "QR code";
    btnQr.className = "petit";
    btnQr.addEventListener("click", () => afficherQr(doc));

    const btnRotation = document.createElement("button");
    btnRotation.textContent = "Régénérer l'URL";
    btnRotation.className = "petit secondaire";
    btnRotation.addEventListener("click", () => regenererUrl(doc));

    const btnSupprimer = document.createElement("button");
    btnSupprimer.textContent = "Supprimer";
    btnSupprimer.className = "petit danger";
    btnSupprimer.addEventListener("click", () => supprimerDocument(doc));

    cellule.append(btnQr, btnRotation, btnSupprimer);
  }
  return table;
}

/** Charge (ou recharge) les listes de documents depuis le serveur. */
async function chargerDocuments() {
  afficherMessage(msgDocuments, "Chargement…", "");
  try {
    const reponse = await fetch("/.netlify/functions/list-docs", {
      headers: { "X-Access-Code": codeAcces },
    });
    const donnees = await reponse.json();
    if (!reponse.ok) {
      // Code devenu invalide (retiré d'ACCESS_CODES par exemple) : retour accueil.
      if (reponse.status === 401) {
        sessionStorage.clear();
        location.href = "/";
        return;
      }
      afficherMessage(msgDocuments, donnees.erreur || "Échec du chargement.", "erreur");
      return;
    }

    labelUtilisateur.textContent = donnees.label;
    badgeAdmin.hidden = !donnees.isAdmin;

    // Mes documents.
    listeDocuments.innerHTML = "";
    if (donnees.documents.length === 0) {
      afficherMessage(msgDocuments, "Vous n'avez encore aucun document.", "");
    } else {
      listeDocuments.appendChild(construireTableau(donnees.documents));
      afficherMessage(msgDocuments, "", "");
    }

    // Documents legacy : uniquement si admin et s'il en reste.
    if (donnees.isAdmin && donnees.legacy.length > 0) {
      listeLegacy.innerHTML = "";
      listeLegacy.appendChild(construireTableau(donnees.legacy));
      sectionLegacy.hidden = false;
    } else {
      sectionLegacy.hidden = true;
    }
  } catch {
    afficherMessage(msgDocuments, "Erreur réseau.", "erreur");
  }
}

chargerDocuments();

// La liste est TOUJOURS re-fetchée depuis le serveur (une seule source de
// vérité) : au chargement, après suppression et après rotation. Reste le cas
// du bfcache : si le navigateur restaure cette page depuis son cache
// arrière/avant (retour après un upload sur la page d'import, par exemple),
// les scripts ne sont pas relancés — on re-fetch alors explicitement.
window.addEventListener("pageshow", (evenement) => {
  if (evenement.persisted) chargerDocuments();
});
