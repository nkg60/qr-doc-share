// Logique de la page publique /d/{token} (d.html).
// Le visiteur saisit son email ; la fonction deliver l'enregistre dans le
// store "scans" puis renvoie l'URL de téléchargement du document.
// V1 : pas d'envoi d'email — le bouton de téléchargement s'affiche directement.

const sectionEmail = document.getElementById("section-email");
const sectionTelechargement = document.getElementById("section-telechargement");
const formEmail = document.getElementById("form-email");
const champEmail = document.getElementById("champ-email");
const btnEmail = document.getElementById("btn-email");
const msgEmail = document.getElementById("msg-email");
const nomDocument = document.getElementById("nom-document");
const lienTelechargement = document.getElementById("lien-telechargement");

// Le token est le dernier segment de l'URL : /d/{token}
const token = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");

/** Affiche un message d'état sous le formulaire. */
function afficherMessage(texte, type) {
  msgEmail.textContent = texte;
  msgEmail.className = "message " + (type || "");
  msgEmail.hidden = !texte;
}

// URL malformée (pas de token) : on désactive le formulaire d'emblée.
if (!token || token === "d") {
  formEmail.querySelectorAll("input, button").forEach((el) => (el.disabled = true));
  afficherMessage("Lien invalide : aucun document n'est associé à cette adresse.", "erreur");
}

formEmail.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  btnEmail.disabled = true;
  afficherMessage("Vérification…", "");

  try {
    const reponse = await fetch("/.netlify/functions/deliver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email: champEmail.value.trim() }),
    });
    const donnees = await reponse.json();

    if (!reponse.ok) {
      afficherMessage(donnees.erreur || "Une erreur est survenue.", "erreur");
      return;
    }

    // Email enregistré : on affiche le bouton de téléchargement.
    nomDocument.textContent = "Document : " + donnees.nom;
    lienTelechargement.href = donnees.urlTelechargement;
    sectionEmail.hidden = true;
    sectionTelechargement.hidden = false;
  } catch {
    afficherMessage("Erreur réseau. Réessayez.", "erreur");
  } finally {
    btnEmail.disabled = false;
  }
});
