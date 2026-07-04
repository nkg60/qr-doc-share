// ============================================================================
// Page principale authentifiée (mes-documents.html).
// Trois vues (hash de l'URL) : #documents, #emails, #legacy (admin).
// Import via modale (glisser-déposer, quota restant, barre de progression),
// QR code en modale, confirmations en modale, toasts, skeletons, états vides.
// Le filtrage par scope reste appliqué CÔTÉ SERVEUR (list-docs) ; l'interface
// ne fait que choisir la vue.
// ============================================================================

// --- Session -----------------------------------------------------------------
const codeAcces = sessionStorage.getItem("codeAcces") || "";
if (!codeAcces) location.replace("/");

const monLabel = sessionStorage.getItem("labelUtilisateur") || "";
let suisAdmin = sessionStorage.getItem("isAdmin") === "1";

// --- Références DOM ------------------------------------------------------------
const marque = document.getElementById("marque");
const labelUtilisateur = document.getElementById("label-utilisateur");
const badgeAdmin = document.getElementById("badge-admin");
const btnDeconnexion = document.getElementById("btn-deconnexion");
const ongletsNav = document.querySelectorAll(".onglet-nav");
const ongletLegacy = document.getElementById("onglet-legacy");
const btnImporter = document.getElementById("btn-importer");
const titreVue = document.getElementById("titre-vue");
const aideVue = document.getElementById("aide-vue");
const segmenteScope = document.getElementById("segmente-scope");
const outilsEmails = document.getElementById("outils-emails");
const filtreLabel = document.getElementById("filtre-label");
const btnExportCsv = document.getElementById("btn-export-csv");
const conteneurListe = document.getElementById("conteneur-liste");

// --- État ---------------------------------------------------------------------
let scopeDocs = "mine";        // "mine" | "all" (sélecteur segmenté, admin)
let quotaInfo = null;           // { maxBytes, utilise } renvoyé par list-docs
let scansCharges = [];          // scans en mémoire pour le filtre par label

// --- En-tête et navigation ------------------------------------------------------
marque.innerHTML = UI.icone("qrcode", 24) + "<span>qr-doc-share</span>";
labelUtilisateur.textContent = monLabel;
badgeAdmin.hidden = !suisAdmin;
ongletLegacy.hidden = !suisAdmin;
btnDeconnexion.innerHTML = UI.icone("deconnexion");
btnImporter.innerHTML = UI.icone("plus", 18) + "<span>Importer</span>";
btnExportCsv.innerHTML = UI.icone("telecharger", 16) + "<span>Exporter en CSV</span>";

// Déconnexion : efface tout l'état côté client et revient à l'écran du code.
// Pas de confirmation : action peu coûteuse à annuler.
btnDeconnexion.addEventListener("click", () => {
  sessionStorage.removeItem("codeAcces");
  sessionStorage.removeItem("labelUtilisateur");
  sessionStorage.removeItem("isAdmin");
  location.href = "/";
});

// --- Routage entre vues (hash de l'URL) -----------------------------------------

const VUES = {
  documents: { titre: "Mes documents", titreOnglet: "Mes documents" },
  emails: { titre: "Emails collectés", titreOnglet: "Emails collectés" },
  legacy: { titre: "Documents legacy", titreOnglet: "Documents legacy" },
};

function vueCourante() {
  const hash = location.hash.replace("#", "");
  if (hash === "emails") return "emails";
  if (hash === "legacy" && suisAdmin) return "legacy";
  return "documents";
}

function afficherVue() {
  const vue = vueCourante();

  // Onglet actif + titre de page (fenêtre et écran).
  for (const onglet of ongletsNav) {
    onglet.classList.toggle("actif", onglet.dataset.vue === vue);
  }
  document.title = VUES[vue].titreOnglet + " · qr-doc-share";
  titreVue.textContent = vue === "documents" && scopeDocs === "all"
    ? "Tous les documents"
    : VUES[vue].titre;

  // Outils spécifiques à chaque vue.
  segmenteScope.hidden = !(vue === "documents" && suisAdmin);
  outilsEmails.hidden = vue !== "emails";
  aideVue.hidden = true;

  if (vue === "documents") chargerDocuments();
  else if (vue === "emails") chargerEmails();
  else chargerLegacy();
}

for (const onglet of ongletsNav) {
  onglet.addEventListener("click", () => {
    location.hash = onglet.dataset.vue === "documents" ? "" : onglet.dataset.vue;
  });
}
window.addEventListener("hashchange", afficherVue);

// Sélecteur Les miens / Tous (admin) : le serveur re-filtre de toute façon.
for (const bouton of segmenteScope.querySelectorAll("button")) {
  bouton.addEventListener("click", () => {
    scopeDocs = bouton.dataset.scope;
    for (const b of segmenteScope.querySelectorAll("button")) {
      b.classList.toggle("actif", b === bouton);
    }
    afficherVue();
  });
}

// --- Appels serveur ---------------------------------------------------------------

/** GET JSON d'une fonction protégée. Redirige vers l'accueil si le code a expiré. */
async function lireFonction(cheminEtParametres) {
  const reponse = await fetch("/.netlify/functions/" + cheminEtParametres, {
    headers: { "X-Access-Code": codeAcces },
  });
  if (reponse.status === 401) {
    sessionStorage.clear();
    location.replace("/");
    throw new Error("Session expirée");
  }
  const donnees = await reponse.json();
  if (!reponse.ok) throw new Error(donnees.erreur || "Erreur serveur.");
  return donnees;
}

/** POST JSON d'une fonction protégée. */
async function appelerFonction(nom, corps) {
  const reponse = await fetch("/.netlify/functions/" + nom, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Access-Code": codeAcces },
    body: JSON.stringify(corps),
  });
  const donnees = await reponse.json();
  if (!reponse.ok) throw new Error(donnees.erreur || "Erreur serveur.");
  return donnees;
}

// --- Vue Documents (et Legacy) ------------------------------------------------------

/** Construit un état vide avec icône, texte et action optionnelle. */
function etatVide(nomIcone, texte, boutonTexte, boutonAction) {
  const bloc = document.createElement("div");
  bloc.className = "etat-vide";
  bloc.innerHTML = UI.icone(nomIcone, 48);
  const p = document.createElement("p");
  p.textContent = texte;
  bloc.appendChild(p);
  if (boutonTexte) {
    const bouton = document.createElement("button");
    bouton.className = "btn btn-primaire";
    bouton.innerHTML = UI.icone("plus", 18);
    const libelle = document.createElement("span");
    libelle.textContent = boutonTexte;
    bouton.appendChild(libelle);
    bouton.addEventListener("click", boutonAction);
    bloc.appendChild(bouton);
  }
  return bloc;
}

/** Construit la ligne/carte d'un document, avec ses actions. */
function elementDocument(doc, avecProprietaire) {
  const article = document.createElement("article");
  article.className = "doc";

  const icone = document.createElement("div");
  icone.className = "doc-icone";
  icone.innerHTML = UI.icone("fichier", 20);

  const infos = document.createElement("div");
  infos.className = "doc-infos";
  const nom = document.createElement("p");
  nom.className = "doc-nom";
  nom.textContent = doc.nom;
  nom.title = doc.nom;
  const meta = document.createElement("p");
  meta.className = "doc-meta";
  const morceaux = [
    UI.tailleLisible(doc.taille),
    UI.dateLisible(doc.date),
    `${doc.nbScans} scan${doc.nbScans > 1 ? "s" : ""}`,
  ];
  if (avecProprietaire) morceaux.push(doc.proprietaire || "— (legacy)");
  meta.textContent = morceaux.join(" · ");
  infos.append(nom, meta);

  // Les trois actions, définies une fois, présentées deux fois :
  // boutons explicites sur desktop, menu kebab sur mobile.
  const actions = [
    { icone: "qrcode", libelle: "Voir le QR code", action: () => modaleQr(doc.token, doc.nom) },
    { icone: "rotation", libelle: "Régénérer l'URL", action: () => regenererUrl(doc) },
    { icone: "corbeille", libelle: "Supprimer", action: () => supprimerDocument(doc), danger: true },
  ];

  const zoneActions = document.createElement("div");
  zoneActions.className = "doc-actions";

  const detaillees = document.createElement("div");
  detaillees.className = "actions-detaillees";
  for (const action of actions) {
    const bouton = document.createElement("button");
    bouton.className = "btn-icone" + (action.danger ? " item-danger" : "");
    bouton.title = action.libelle;
    bouton.setAttribute("aria-label", action.libelle);
    bouton.innerHTML = UI.icone(action.icone, 18);
    if (action.danger) bouton.style.color = "var(--danger)";
    bouton.addEventListener("click", action.action);
    detaillees.appendChild(bouton);
  }

  zoneActions.append(detaillees, UI.menuKebab(actions));
  article.append(icone, infos, zoneActions);
  return article;
}

/** Charge et affiche la vue Documents (scope mine/all selon le sélecteur). */
async function chargerDocuments() {
  conteneurListe.innerHTML = "";
  conteneurListe.appendChild(UI.skeleton(3));
  try {
    const donnees = await lireFonction("list-docs?scope=" + (suisAdmin ? scopeDocs : "mine"));
    majDroits(donnees);
    quotaInfo = donnees.quota || null;

    conteneurListe.innerHTML = "";
    if (donnees.documents.length === 0) {
      conteneurListe.appendChild(
        donnees.scope === "mine"
          ? etatVide("documents", "Vous n'avez pas encore importé de document.",
              "Importer un document", ouvrirModaleImport)
          : etatVide("documents", "Aucun document stocké pour le moment.")
      );
      return;
    }
    const liste = document.createElement("div");
    liste.className = "liste-docs";
    for (const doc of donnees.documents) {
      liste.appendChild(elementDocument(doc, donnees.scope !== "mine"));
    }
    conteneurListe.appendChild(liste);
  } catch (erreur) {
    conteneurListe.innerHTML = "";
    UI.toast(erreur.message || "Erreur réseau, réessayez.", "erreur");
  }
}

/** Charge et affiche la vue Documents legacy (admin). */
async function chargerLegacy() {
  conteneurListe.innerHTML = "";
  conteneurListe.appendChild(UI.skeleton(2));
  aideVue.textContent =
    "Documents importés avant le multi-utilisateurs, sans propriétaire. À vous de décider quoi en faire.";
  aideVue.hidden = false;
  try {
    const donnees = await lireFonction("list-docs?scope=legacy");
    majDroits(donnees);
    conteneurListe.innerHTML = "";
    if (donnees.documents.length === 0) {
      conteneurListe.appendChild(etatVide("archive", "Aucun document legacy : tout est attribué."));
      return;
    }
    const liste = document.createElement("div");
    liste.className = "liste-docs";
    for (const doc of donnees.documents) liste.appendChild(elementDocument(doc, true));
    conteneurListe.appendChild(liste);
  } catch (erreur) {
    conteneurListe.innerHTML = "";
    UI.toast(erreur.message || "Erreur réseau, réessayez.", "erreur");
  }
}

/** Met à jour les éléments qui dépendent des droits renvoyés par le serveur. */
function majDroits(donnees) {
  if (typeof donnees.isAdmin === "boolean" && donnees.isAdmin !== suisAdmin) {
    suisAdmin = donnees.isAdmin;
    sessionStorage.setItem("isAdmin", suisAdmin ? "1" : "");
    badgeAdmin.hidden = !suisAdmin;
    ongletLegacy.hidden = !suisAdmin;
    segmenteScope.hidden = !(vueCourante() === "documents" && suisAdmin);
  }
  if (donnees.label) labelUtilisateur.textContent = donnees.label;
}

// --- Actions sur un document ---------------------------------------------------------

/** Modale QR : aperçu, téléchargement PNG, copie de l'URL. Le token ne change pas. */
async function modaleQr(token, nomDoc) {
  const urlAbsolue = location.origin + "/d/" + token;

  const contenu = document.createElement("div");
  contenu.className = "bloc-qr";
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, urlAbsolue, { width: 280, margin: 2 });
  contenu.appendChild(canvas);
  const url = document.createElement("p");
  url.className = "url-publique";
  url.textContent = urlAbsolue;
  contenu.appendChild(url);
  const aide = document.createElement("p");
  aide.className = "aide";
  aide.textContent = "Toute personne qui scanne ce QR code accède à la page de récupération du document.";
  contenu.appendChild(aide);

  const btnPng = document.createElement("button");
  btnPng.className = "btn btn-secondaire";
  btnPng.innerHTML = UI.icone("telecharger", 16) + "<span>Télécharger PNG</span>";
  btnPng.addEventListener("click", () => {
    const lien = document.createElement("a");
    lien.href = canvas.toDataURL("image/png");
    lien.download = "qr-" + (nomDoc || "document") + ".png";
    lien.click();
  });

  const btnCopier = document.createElement("button");
  btnCopier.className = "btn btn-primaire";
  btnCopier.innerHTML = UI.icone("copier", 16) + "<span>Copier l'URL</span>";
  btnCopier.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(urlAbsolue);
      UI.toast("Lien copié", "succes");
    } catch {
      UI.toast("Impossible de copier automatiquement. Sélectionnez l'URL affichée.", "erreur");
    }
  });

  UI.ouvrirModale({
    titre: "QR code — " + (nomDoc || "document"),
    contenu,
    actions: [btnPng, btnCopier],
  });
}

/** Rotation d'URL, avec confirmation explicite sur les conséquences. */
async function regenererUrl(doc) {
  const accepte = await UI.confirmer({
    titre: "Régénérer l'URL ?",
    nomMisEnAvant: doc.nom,
    message:
      "L'URL actuelle cessera de fonctionner : les QR codes déjà imprimés ou partagés " +
      "deviendront invalides. L'historique des scans est conservé.",
    texteConfirmer: "Régénérer l'URL",
    varianteConfirmer: "primaire",
  });
  if (!accepte) return;

  const chargement = UI.chargementDiffere("Régénération…");
  try {
    const donnees = await appelerFonction("rotate-token", { token: doc.token });
    UI.toast("URL régénérée", "succes");
    await afficherVue();                    // la liste reflète le nouveau token
    modaleQr(donnees.token, doc.nom);       // et on montre le nouveau QR
  } catch (erreur) {
    UI.toast(erreur.message, "erreur");
  } finally {
    chargement.fin();
  }
}

/** Suppression définitive, avec confirmation nominative. */
async function supprimerDocument(doc) {
  const accepte = await UI.confirmer({
    titre: "Supprimer ce document ?",
    nomMisEnAvant: doc.nom,
    message:
      "Cette action est définitive. Les emails déjà collectés pour ce document " +
      "restent disponibles dans l'export CSV.",
    texteConfirmer: "Supprimer définitivement",
    varianteConfirmer: "danger",
  });
  if (!accepte) return;

  const chargement = UI.chargementDiffere("Suppression…");
  try {
    await appelerFonction("delete-doc", { token: doc.token });
    UI.toast("Document supprimé", "succes");
    afficherVue();                          // le document disparaît de la liste
  } catch (erreur) {
    UI.toast(erreur.message, "erreur");
  } finally {
    chargement.fin();
  }
}

// --- Import (modale avec glisser-déposer, quota, progression) --------------------------

btnImporter.addEventListener("click", ouvrirModaleImport);

/** Upload en XHR pour disposer de l'événement progress. */
function televerser(fichier, surProgression) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/.netlify/functions/upload");
    xhr.setRequestHeader("X-Access-Code", codeAcces);
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(fichier.name));
    xhr.setRequestHeader("Content-Type", fichier.type || "application/octet-stream");
    xhr.upload.addEventListener("progress", (evenement) => {
      if (evenement.lengthComputable) {
        surProgression(Math.round((evenement.loaded / evenement.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      let donnees = {};
      try { donnees = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(donnees);
      else reject(new Error(donnees.erreur || "Échec de l'import."));
    });
    xhr.addEventListener("error", () => reject(new Error("Erreur réseau, réessayez.")));
    xhr.send(fichier);
  });
}

function ouvrirModaleImport() {
  let fichierChoisi = null;

  const contenu = document.createElement("div");

  // Zone de glisser-déposer (clic = parcourir).
  const zone = document.createElement("div");
  zone.className = "zone-drop";
  zone.setAttribute("role", "button");
  zone.setAttribute("tabindex", "0");
  zone.innerHTML =
    UI.icone("televerser", 32) +
    "<p><strong>Glissez-déposez un fichier ici</strong></p><p>ou cliquez pour parcourir</p>";
  const champFichier = document.createElement("input");
  champFichier.type = "file";
  champFichier.hidden = true;

  // Quota restant, affiché en clair (données renvoyées par list-docs).
  const ligneQuota = document.createElement("p");
  ligneQuota.className = "aide";
  if (quotaInfo) {
    const restant = Math.max(0, quotaInfo.maxBytes - quotaInfo.utilise);
    ligneQuota.textContent =
      `Quota restant : ${UI.tailleLisible(restant)} sur ${UI.tailleLisible(quotaInfo.maxBytes)}.`;
  }

  // Aperçu du fichier sélectionné (nom, taille) avant validation.
  const apercu = document.createElement("div");
  apercu.hidden = true;

  // Barre de progression.
  const blocProgression = document.createElement("div");
  blocProgression.hidden = true;
  blocProgression.innerHTML =
    '<div class="progression"><div class="progression-barre"></div></div>' +
    '<p class="progression-texte">0 %</p>';

  contenu.append(zone, champFichier, ligneQuota, apercu, blocProgression);

  const btnAnnuler = document.createElement("button");
  btnAnnuler.className = "btn btn-secondaire";
  btnAnnuler.textContent = "Annuler";

  const btnValider = document.createElement("button");
  btnValider.className = "btn btn-primaire";
  btnValider.innerHTML = UI.icone("televerser", 16) + "<span>Importer</span>";
  btnValider.disabled = true;

  const { fermer } = UI.ouvrirModale({
    titre: "Importer un document",
    contenu,
    actions: [btnAnnuler, btnValider],
  });
  btnAnnuler.addEventListener("click", fermer);

  function choisirFichier(fichier) {
    if (!fichier) return;
    fichierChoisi = fichier;
    apercu.innerHTML = "";
    apercu.className = "fichier-choisi";
    apercu.hidden = false;
    const icone = document.createElement("div");
    icone.className = "doc-icone";
    icone.innerHTML = UI.icone("fichier", 16);
    const texte = document.createElement("span");
    texte.textContent = `${fichier.name} — ${UI.tailleLisible(fichier.size)}`;
    apercu.append(icone, texte);
    btnValider.disabled = false;
  }

  zone.addEventListener("click", () => champFichier.click());
  zone.addEventListener("keydown", (evenement) => {
    if (evenement.key === "Enter" || evenement.key === " ") {
      evenement.preventDefault();
      champFichier.click();
    }
  });
  champFichier.addEventListener("change", () => choisirFichier(champFichier.files[0]));
  zone.addEventListener("dragover", (evenement) => {
    evenement.preventDefault();
    zone.classList.add("survol");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("survol"));
  zone.addEventListener("drop", (evenement) => {
    evenement.preventDefault();
    zone.classList.remove("survol");
    choisirFichier(evenement.dataTransfer.files[0]);
  });

  btnValider.addEventListener("click", async () => {
    if (!fichierChoisi) return;
    const restaurer = UI.boutonEnChargement(btnValider, "Import en cours…");
    btnAnnuler.disabled = true;
    blocProgression.hidden = false;
    const barre = blocProgression.querySelector(".progression-barre");
    const texte = blocProgression.querySelector(".progression-texte");

    try {
      const nomDoc = fichierChoisi.name;
      const donnees = await televerser(fichierChoisi, (pourcent) => {
        barre.style.width = pourcent + "%";
        texte.textContent = pourcent + " %";
      });
      fermer();
      UI.toast("Document importé", "succes");
      // Retour sur Mes documents, nouveau document en tête de liste.
      scopeDocs = "mine";
      location.hash = "";
      await afficherVue();
      modaleQr(donnees.token, nomDoc);
    } catch (erreur) {
      // Cas notables : quota dépassé (message serveur détaillé), erreur réseau.
      UI.toast(erreur.message, "erreur");
      restaurer();
      btnAnnuler.disabled = false;
      blocProgression.hidden = true;
      barre.style.width = "0%";
    }
  });
}

// --- Vue Emails collectés ----------------------------------------------------------

/** Construit la carte/rangée d'un scan. */
function elementScan(scan) {
  const article = document.createElement("article");
  article.className = "scan";

  const colonneEmail = document.createElement("div");
  const email = document.createElement("p");
  email.className = "scan-email";
  email.textContent = scan.email;
  colonneEmail.appendChild(email);

  const colonneDoc = document.createElement("div");
  const doc = document.createElement("p");
  doc.className = "scan-meta";
  doc.style.textAlign = "left";
  const morceauxDoc = [scan.document + (scan.documentSupprime ? " (supprimé)" : "")];
  if (suisAdmin) morceauxDoc.push(scan.proprietaire);
  doc.textContent = morceauxDoc.join(" · ");
  colonneDoc.appendChild(doc);

  const colonneDate = document.createElement("p");
  colonneDate.className = "scan-meta";
  colonneDate.textContent = UI.dateLisible(scan.date);
  colonneDate.title = scan.date ? new Date(scan.date).toLocaleString("fr-FR") : "";

  article.append(colonneEmail, colonneDoc, colonneDate);
  return article;
}

/** Affiche la liste des scans selon le filtre courant (admin). */
function afficherListeScans() {
  const filtre = filtreLabel.value;
  const lignes = filtre
    ? scansCharges.filter((s) => s.proprietaire === filtre)
    : scansCharges;

  conteneurListe.innerHTML = "";
  if (lignes.length === 0) {
    conteneurListe.appendChild(etatVide("email", "Aucun email collecté pour l'instant."));
    return;
  }
  const liste = document.createElement("div");
  liste.className = "liste-scans";
  for (const scan of lignes) liste.appendChild(elementScan(scan));
  conteneurListe.appendChild(liste);
}

/** Charge la vue Emails collectés. */
async function chargerEmails() {
  conteneurListe.innerHTML = "";
  conteneurListe.appendChild(UI.skeleton(3));
  try {
    const donnees = await lireFonction("scans");
    majDroits(donnees);
    scansCharges = donnees.scans;

    // Filtre par propriétaire : uniquement pour un admin.
    if (donnees.isAdmin) {
      const labels = [...new Set(scansCharges.map((s) => s.proprietaire))].sort();
      filtreLabel.innerHTML = "";
      const optionTous = document.createElement("option");
      optionTous.value = "";
      optionTous.textContent = "Tous les propriétaires";
      filtreLabel.appendChild(optionTous);
      for (const label of labels) {
        const option = document.createElement("option");
        option.value = label;
        option.textContent = "Documents de " + label;
        filtreLabel.appendChild(option);
      }
      filtreLabel.hidden = false;
    } else {
      filtreLabel.hidden = true;
    }

    afficherListeScans();
  } catch (erreur) {
    conteneurListe.innerHTML = "";
    UI.toast(erreur.message || "Erreur réseau, réessayez.", "erreur");
  }
}

filtreLabel.addEventListener("change", afficherListeScans);

// Export CSV : via fetch pour joindre l'en-tête X-Access-Code.
btnExportCsv.addEventListener("click", async () => {
  const restaurer = UI.boutonEnChargement(btnExportCsv, "Export…");
  try {
    const reponse = await fetch("/.netlify/functions/scans?format=csv", {
      headers: { "X-Access-Code": codeAcces },
    });
    if (!reponse.ok) {
      const donnees = await reponse.json().catch(() => ({}));
      throw new Error(donnees.erreur || "Échec de l'export.");
    }
    const blob = await reponse.blob();
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(blob);
    lien.download = "scans.csv";
    lien.click();
    URL.revokeObjectURL(lien.href);
    UI.toast("Fichier scans.csv téléchargé", "succes");
  } catch (erreur) {
    UI.toast(erreur.message, "erreur");
  } finally {
    restaurer();
  }
});

// --- Démarrage -----------------------------------------------------------------------

afficherVue();

// Une seule source de vérité (le serveur) : si le navigateur restaure la page
// depuis son cache arrière/avant, on re-fetch la vue courante.
window.addEventListener("pageshow", (evenement) => {
  if (evenement.persisted) afficherVue();
});
