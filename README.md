# Partage de documents par QR code

Petite application web pour partager un document via un QR code, en collectant
l'email de chaque personne qui le récupère.

**Parcours :**
1. Sur la page d'accueil, saisir son **code d'accès à 6 chiffres** (vérifié
   uniquement côté serveur — les codes n'apparaissent jamais dans le frontend).
2. Importer un fichier (image, PDF…). L'application génère un **QR code**
   pointant vers la page publique `/d/{token}` (aperçu, export PNG, copie d'URL).
3. La personne qui scanne le QR code arrive sur `/d/{token}`, saisit son
   **email**, puis télécharge le document (pas d'envoi d'email).
4. Chaque utilisateur gère ses documents sur la page **« Mes documents »** :
   revoir/re-télécharger le QR code, **régénérer l'URL** (rotation du token,
   l'ancienne URL cesse de fonctionner), **supprimer** (les scans collectés
   sont conservés, marqués « supprimé »).
5. Les emails collectés sont consultables et exportables en CSV depuis la
   page d'accueil. Chaque utilisateur ne voit que **ses** documents et **ses**
   scans ; un **admin** (`is_admin: true`) voit tout, avec un filtre par
   propriétaire et l'accès aux documents « legacy » (importés avant la V1.1).

## Stack

- **Frontend** : HTML/CSS/JavaScript statique, sans framework ni build
  (la librairie [qrcode](https://github.com/soldair/node-qrcode) est vendue
  dans `public/js/vendor/`).
- **Backend** : Netlify Functions (`netlify/functions/`).
- **Stockage** : Netlify Blobs uniquement (`@netlify/blobs`) :
  - store `docs` : les fichiers, clé = token aléatoire, métadonnées = nom
    d'origine, taille en octets, date, type MIME ;
  - store `scans` : les emails collectés (token du document, email, date,
    user-agent) ;
  - store `admin_actions` : journal des actions d'un admin sur un document
    dont il n'est pas propriétaire (timestamp, admin, action delete/rotate,
    document, propriétaire ciblé).

## Arborescence

```
netlify/functions/
  _lib/utils.mjs     Utilitaires partagés (ACCESS_CODES, temps constant, propriété)
  auth.mjs           Vérifie un code (POST {code} -> {valide, label, isAdmin})
  upload.mjs         Reçoit un fichier, contrôle le quota individuel, renvoie /d/{token}
  deliver.mjs        Enregistre l'email du visiteur (public), renvoie l'URL de téléchargement
  download.mjs       Sert le fichier (route /download/{token}, public : le token est la clé)
  list-docs.mjs      Liste des documents (?scope=mine|all|legacy, all/legacy admin), nb de scans
  rotate-token.mjs   Rotation du token : nouvelle URL, ancienne invalidée, scans conservés
  delete-doc.mjs     Suppression d'un document, scans marqués document_deleted
  scans.mjs          Liste/exporte les emails collectés (JSON ou CSV, par utilisateur)
public/
  index.html         Page « Importer » (accueil)
  mes-documents.html Page « Mes documents » (QR, rotation d'URL, suppression)
  d.html             Page publique servie sur /d/{token} (réécriture netlify.toml)
  css/style.css      Style commun
  js/app.js          Logique de la page d'accueil
  js/documents.js    Logique de la page « Mes documents »
  js/landing.js      Logique de la page publique
  js/vendor/         Bundle navigateur qrcode
```

## Variables d'environnement

Voir `.env.example` :

| Variable       | Rôle                                                             |
|----------------|------------------------------------------------------------------|
| `ACCESS_CODES` | JSON des utilisateurs : code → `{label, max_bytes, is_admin?}`. Jamais envoyé au frontend. |

Exemple de valeur :

```json
{
  "123456": { "label": "Ghislain", "max_bytes": 104857600, "is_admin": true },
  "789012": { "label": "Marc",     "max_bytes": 52428800  },
  "345678": { "label": "Roxane",   "max_bytes": 209715200 }
}
```

Le quota (`max_bytes`, en octets) est **individuel** : la somme des documents
d'un utilisateur ne peut pas le dépasser.

**Migration douce depuis la V1** : si `ACCESS_CODES` est absent mais que les
anciennes variables `ACCESS_CODE`/`MAX_TOTAL_BYTES` existent, le serveur
reconstruit automatiquement un utilisateur unique « legacy » (admin) — la prod
V1 continue de fonctionner sans interruption pendant la transition.

## Développement local

```bash
npm install
cp .env.example .env   # puis ajustez les valeurs
npm run dev            # lance netlify dev sur http://localhost:8888
```

`netlify dev` émule les fonctions, les redirections et Netlify Blobs en local.

### Test manuel : fraîcheur de la liste « Mes documents »

La liste est toujours re-fetchée depuis le serveur (une seule source de
vérité) à chaque affichage d'une vue : chargement de page, changement
d'onglet, F5, navigation arrière/avant, et après chaque upload, suppression
ou rotation. Les réponses des fonctions portent `Cache-Control: no-store`
et les fetch de lecture passent `cache: "no-store"` : ni le navigateur ni un
intermédiaire ne peuvent resservir une liste périmée. Pour vérifier, **sans
jamais se déconnecter** :

1. Connectez-vous, importez un document : il apparaît immédiatement en tête
   de liste. Faites **F5** : il est toujours présent.
2. Supprimez ce document et confirmez : il disparaît immédiatement.
   Faites **F5** : il est toujours absent.
3. Changez d'onglet (« Emails collectés ») puis revenez sur « Mes
   documents » : la liste est re-demandée au serveur et reste à jour.
4. Sur un document, « Régénérer l'URL » : la ligne affiche immédiatement le
   nouveau QR code (l'ancienne URL renvoie désormais 404).
5. « Se déconnecter » : retour à l'écran du code ; rouvrir « Mes documents »
   sans code redirige vers l'accueil.

Note visibilité : le sélecteur « Tous les documents » et l'onglet
« Documents legacy » ne sont affichés que si **la réponse du serveur**
indique `isAdmin` (le stockage local n'est qu'une indication de départ) ;
côté serveur, le paramètre `scope` d'un non-admin est de toute façon ignoré.

## Déploiement

1. Connectez le CLI si nécessaire : `npx netlify login`.
2. Initialisez et liez le site au dépôt GitHub : `npx netlify init`
   (choisir l'équipe, le nom du site ; build command vide, publish `public`).
3. Définissez la variable d'environnement **avant** le premier usage
   (JSON sur une seule ligne, entre apostrophes) :
   ```bash
   npx netlify env:set ACCESS_CODES '{"123456": {"label": "Ghislain", "max_bytes": 104857600, "is_admin": true}, "789012": {"label": "Marc", "max_bytes": 52428800}}'
   ```
   (ou dans l'interface Netlify : *Site configuration → Environment variables*).
   Les anciennes variables `ACCESS_CODE`/`MAX_TOTAL_BYTES` peuvent ensuite
   être supprimées.
4. Déployez en production : `npx netlify deploy --prod` — ou poussez sur la
   branche `main` si le site est lié au dépôt Git (déploiement automatique).
