// ============================================================================
// UI — mini design-system maison (aucune dépendance).
// Toasts, modales, confirmations, skeletons, boutons en chargement,
// icônes Lucide inline, formatage des tailles et dates.
// Exposé en global : window.UI
// ============================================================================

(function () {
  "use strict";

  // ------------------------------------------------------------- Icônes ---
  // Famille unique : Lucide (https://lucide.dev), SVG inline, stroke courant.
  const gabaritSvg = (contenu, taille = 20) =>
    `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${contenu}</svg>`;

  const ICONES = {
    qrcode: (t) => gabaritSvg('<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>', t),
    fichier: (t) => gabaritSvg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>', t),
    televerser: (t) => gabaritSvg('<path d="M12 13v8"/><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m8 17 4-4 4 4"/>', t),
    telecharger: (t) => gabaritSvg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>', t),
    copier: (t) => gabaritSvg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', t),
    corbeille: (t) => gabaritSvg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>', t),
    rotation: (t) => gabaritSvg('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>', t),
    fermer: (t) => gabaritSvg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', t),
    valide: (t) => gabaritSvg('<path d="M20 6 9 17l-5-5"/>', t),
    alerte: (t) => gabaritSvg('<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>', t),
    info: (t) => gabaritSvg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', t),
    email: (t) => gabaritSvg('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>', t),
    deconnexion: (t) => gabaritSvg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>', t),
    plus: (t) => gabaritSvg('<path d="M5 12h14"/><path d="M12 5v14"/>', t),
    kebab: (t) => gabaritSvg('<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>', t),
    boiteVide: (t) => gabaritSvg('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>', t),
    archive: (t) => gabaritSvg('<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>', t),
    documents: (t) => gabaritSvg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>', t),
  };

  /** Renvoie le SVG d'une icône (chaîne HTML). */
  function icone(nom, taille = 20) {
    return ICONES[nom] ? ICONES[nom](taille) : "";
  }

  // ------------------------------------------------------------- Toasts ---

  let conteneurToasts = null;
  function assurerConteneurToasts() {
    if (!conteneurToasts) {
      conteneurToasts = document.createElement("div");
      conteneurToasts.className = "toasts";
      conteneurToasts.setAttribute("aria-live", "polite");
      document.body.appendChild(conteneurToasts);
    }
    return conteneurToasts;
  }

  /**
   * Affiche un toast. type : "succes" | "erreur" | "info".
   * Renvoie une fonction qui retire le toast immédiatement.
   */
  function toast(message, type = "info", duree = 4000) {
    const conteneur = assurerConteneurToasts();
    const element = document.createElement("div");
    element.className = `toast toast-${type}`;
    const nomIcone = type === "succes" ? "valide" : type === "erreur" ? "alerte" : "info";
    element.innerHTML = icone(nomIcone, 18);
    const texte = document.createElement("span");
    texte.textContent = message;
    element.appendChild(texte);
    conteneur.appendChild(element);

    let retire = false;
    const retirer = () => {
      if (retire) return;
      retire = true;
      element.remove();
    };
    if (duree > 0) setTimeout(retirer, duree);
    return retirer;
  }

  /**
   * Indicateur de chargement différé : n'affiche le toast info "Chargement…"
   * que si l'action dépasse 500 ms. Appeler fin() quand l'action se termine.
   */
  function chargementDiffere(message = "Chargement…") {
    let retirer = null;
    const minuteur = setTimeout(() => {
      retirer = toast(message, "info", 0);
    }, 500);
    return {
      fin() {
        clearTimeout(minuteur);
        if (retirer) retirer();
      },
    };
  }

  // ------------------------------------------- Boutons en cours d'action ---

  /**
   * Passe un bouton en état "chargement" : désactivé, spinner + texte.
   * Renvoie une fonction de restauration.
   */
  function boutonEnChargement(bouton, texteEnCours) {
    const contenuInitial = bouton.innerHTML;
    bouton.disabled = true;
    bouton.innerHTML = `<span class="spinner" aria-hidden="true"></span>${texteEnCours}`;
    return () => {
      bouton.disabled = false;
      bouton.innerHTML = contenuInitial;
    };
  }

  // ----------------------------------------------------------- Skeleton ---

  /** Groupe de rectangles gris animés, pour les listes en cours de chargement. */
  function skeleton(nombre = 3) {
    const groupe = document.createElement("div");
    groupe.className = "skeleton-groupe";
    groupe.setAttribute("aria-hidden", "true");
    for (let i = 0; i < nombre; i++) {
      const ligne = document.createElement("div");
      ligne.className = "skeleton-ligne";
      groupe.appendChild(ligne);
    }
    return groupe;
  }

  // ------------------------------------------------------------- Modale ---

  /**
   * Ouvre une modale générique.
   * options : { titre, contenu (Node), actions (Node[]), surFermeture() }
   * Renvoie { element, corps, fermer }.
   */
  function ouvrirModale({ titre, contenu, actions = [], surFermeture }) {
    const fond = document.createElement("div");
    fond.className = "modale-fond";

    const modale = document.createElement("div");
    modale.className = "modale";
    modale.setAttribute("role", "dialog");
    modale.setAttribute("aria-modal", "true");
    modale.setAttribute("aria-label", titre);

    const entete = document.createElement("div");
    entete.className = "modale-entete";
    const h2 = document.createElement("h2");
    h2.textContent = titre;
    const btnFermer = document.createElement("button");
    btnFermer.className = "btn-icone";
    btnFermer.setAttribute("aria-label", "Fermer");
    btnFermer.innerHTML = icone("fermer");
    entete.append(h2, btnFermer);

    const corps = document.createElement("div");
    corps.className = "modale-corps";
    if (contenu) corps.appendChild(contenu);

    modale.append(entete, corps);
    if (actions.length > 0) {
      const pied = document.createElement("div");
      pied.className = "modale-actions";
      pied.append(...actions);
      modale.appendChild(pied);
    }
    fond.appendChild(modale);
    document.body.appendChild(fond);

    // Focus : on mémorise l'élément actif pour le restaurer à la fermeture.
    const focusPrecedent = document.activeElement;
    const premierChamp = modale.querySelector("input, select, textarea, .btn");
    (premierChamp || btnFermer).focus();

    let fermee = false;
    function fermer() {
      if (fermee) return;
      fermee = true;
      fond.remove();
      document.removeEventListener("keydown", surTouche);
      if (focusPrecedent && focusPrecedent.focus) focusPrecedent.focus();
      if (surFermeture) surFermeture();
    }
    function surTouche(evenement) {
      if (evenement.key === "Escape") fermer();
    }

    btnFermer.addEventListener("click", fermer);
    fond.addEventListener("click", (evenement) => {
      if (evenement.target === fond) fermer();
    });
    document.addEventListener("keydown", surTouche);

    return { element: modale, corps, fermer };
  }

  /**
   * Modale de confirmation. Renvoie Promise<boolean>.
   * options : { titre, message (texte), nomMisEnAvant, texteConfirmer,
   *             varianteConfirmer ("danger"|"primaire") }
   */
  function confirmer({
    titre,
    message,
    nomMisEnAvant,
    texteConfirmer = "Confirmer",
    varianteConfirmer = "primaire",
  }) {
    return new Promise((resolve) => {
      const contenu = document.createElement("div");
      if (nomMisEnAvant) {
        const nom = document.createElement("p");
        const gras = document.createElement("strong");
        gras.textContent = nomMisEnAvant;
        nom.appendChild(gras);
        contenu.appendChild(nom);
      }
      const texte = document.createElement("p");
      texte.textContent = message;
      texte.style.color = "var(--texte-2)";
      contenu.appendChild(texte);

      const btnAnnuler = document.createElement("button");
      btnAnnuler.className = "btn btn-secondaire";
      btnAnnuler.textContent = "Annuler";

      const btnOk = document.createElement("button");
      btnOk.className = `btn btn-${varianteConfirmer}`;
      btnOk.textContent = texteConfirmer;

      const { fermer } = ouvrirModale({
        titre,
        contenu,
        actions: [btnAnnuler, btnOk],
        surFermeture: () => resolve(false),
      });

      btnAnnuler.addEventListener("click", fermer);
      btnOk.addEventListener("click", () => {
        resolve(true);
        // resolve(false) du surFermeture arrivera après : sans effet,
        // une promesse ne se résout qu'une fois.
        fermer();
      });
    });
  }

  // ------------------------------------------------------- Menu kebab ---

  let menuOuvert = null;
  document.addEventListener("click", (evenement) => {
    if (menuOuvert && !menuOuvert.contains(evenement.target)) {
      menuOuvert.querySelector(".menu-deroulant")?.remove();
      menuOuvert = null;
    }
  });

  /**
   * Crée un menu contextuel « trois points ».
   * items : [{ icone, libelle, action(), danger }]
   */
  function menuKebab(items) {
    const conteneur = document.createElement("div");
    conteneur.className = "menu-kebab";
    const declencheur = document.createElement("button");
    declencheur.className = "btn-icone";
    declencheur.setAttribute("aria-label", "Actions");
    declencheur.setAttribute("aria-haspopup", "true");
    declencheur.innerHTML = icone("kebab");
    conteneur.appendChild(declencheur);

    declencheur.addEventListener("click", (evenement) => {
      evenement.stopPropagation();
      // Un seul menu ouvert à la fois.
      if (menuOuvert) {
        menuOuvert.querySelector(".menu-deroulant")?.remove();
        if (menuOuvert === conteneur) { menuOuvert = null; return; }
      }
      const liste = document.createElement("div");
      liste.className = "menu-deroulant";
      liste.setAttribute("role", "menu");
      for (const item of items) {
        const bouton = document.createElement("button");
        bouton.setAttribute("role", "menuitem");
        if (item.danger) bouton.className = "item-danger";
        bouton.innerHTML = icone(item.icone, 16);
        const libelle = document.createElement("span");
        libelle.textContent = item.libelle;
        bouton.appendChild(libelle);
        bouton.addEventListener("click", () => {
          liste.remove();
          menuOuvert = null;
          item.action();
        });
        liste.appendChild(bouton);
      }
      conteneur.appendChild(liste);
      menuOuvert = conteneur;
    });

    return conteneur;
  }

  // ---------------------------------------------------------- Formatage ---

  /** Taille lisible : Ko / Mo / Go avec 1 décimale. */
  function tailleLisible(octets) {
    const n = Number(octets) || 0;
    if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(1) + " Go";
    if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(1) + " Mo";
    if (n >= 1024) return (n / 1024).toFixed(1) + " Ko";
    return n + " o";
  }

  /** Date lisible : relative si récente (« il y a 3 h »), sinon « 12 mars 2026 ». */
  function dateLisible(iso) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (isNaN(date)) return "—";
    const ecartMs = Date.now() - date.getTime();
    const minutes = Math.floor(ecartMs / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const heures = Math.floor(minutes / 60);
    if (heures < 24) return `il y a ${heures} h`;
    const jours = Math.floor(heures / 24);
    if (jours < 7) return `il y a ${jours} j`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }

  // ------------------------------------------------------------- Export ---

  window.UI = {
    icone,
    toast,
    chargementDiffere,
    boutonEnChargement,
    skeleton,
    ouvrirModale,
    confirmer,
    menuKebab,
    tailleLisible,
    dateLisible,
  };
})();
