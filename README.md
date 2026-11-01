# REA × Jev — interface web gratuite

Interface web pour importer un APK, EXE, DLL, archive, etc., saisir une consigne et obtenir un rapport d'inspection, sans Termux ni installation Android.

## Mode gratuit par défaut

- **REA 6.5.0 (MIT)** exécute des analyses statiques réelles via sa CLI.
- Le routage des commandes est **déterministe** par défaut (type de fichier et demande), sans appel payant.
- **Jev System One fonctionne côté serveur uniquement si son fournisseur est réellement connecté.** Sur Codiv, `CODIV_API_KEY` (secret configuré une seule fois côté Render) active OpenJev, compatible Jev : quatre points de contrôle réels (`route`, `gate`, `evidence`, `completeness`). La page teste une vraie décision API et annonce **connecté** seulement si elle reçoit une réponse conforme. Codiv annonce 100 M tokens d'entrée gratuits pour les décisions et 10 M pour la génération, avec quotas susceptibles d'évoluer. Le service demande une inscription gratuite et une clé serveur ; **aucun jeton n'est demandé aux visiteurs**. OpenJev n'est pas le Jev propriétaire de TypeSafe.
- Le rapport Markdown rassemble résultats, empreinte SHA-256, preuves, erreurs et limites.
- **Jev TypeSafe** n'est activable qu'avec `REA_JEV_PROVIDER=typesafe`, `TYPESAFE_API_KEY` et `REA_JEV_ALLOW_PAID=1` définis côté serveur. Ce mode a un coût : il est **désactivé par défaut**, afin d'éviter toute facturation. Jev décide et classe, il ne rédige pas de rapports ni ne remplace un agent de décompilation.
- L'ancien mode agent Claude + plugin REA–Jev reste disponible en option pour une installation privée, mais **n'est pas utilisé par défaut**.

## Utilisation depuis Android

Ouvrir **https://rea-jev-studio.onrender.com** dans le navigateur, sélectionner un fichier, décrire la recherche et lancer. **Aucun compte, mot de passe, jeton à entrer ou logiciel local n'est requis.** Le serveur attribue automatiquement une session privée (cookie signé, `HttpOnly`, `SameSite=Strict`, `Secure` en HTTPS). Les fichiers, tâches et rapports d'un navigateur sont isolés des autres sessions.

Les tâches peuvent être annulées et le rapport est téléchargeable. **Les fichiers sont temporairement stockés sur le serveur** et peuvent disparaître après redémarrage ou déploiement sur Render Free. Les rapports sont supprimés automatiquement au bout de 12 heures ; les imports sans tâche après 20 minutes. Les limites sont de 30 Mio par fichier sur Render, 3 imports conservés par navigateur, 12 imports globaux et 120 Mio cumulés. Télécharger immédiatement les rapports. **Une session anonyme ne garantit pas l'identité du visiteur ni une protection contre les abus ; ne pas importer de secrets professionnels ou de fichiers sensibles sans audit de sécurité et isolation renforcée.**

## Déploiement gratuit Render

Le dépôt comprend un `render.yaml` pour le déploiement Blueprint. Sur Render : `New > Blueprint`, sélectionner `dbrckk/rea-jev`, plan `Free`, valider le service. Le plan Free s'endort après 15 minutes d'inactivité, utilise 512 Mo de RAM, et a des quotas mensuels. Les très grands fichiers et certaines inspections dépassent les limites. Aucune facturation n'est nécessaire tant qu'aucune offre payante n'est activée. Vérifier les modalités actuelles sur https://render.com/docs/free.

Le service public existant est [REA × Jev Studio](https://rea-jev-studio.onrender.com), sur Render Free. **Aucun secret d'accès client n'est nécessaire.** Facultativement, l'exploitant du serveur peut ajouter `CODIV_API_KEY` en tant que secret Render pour OpenJev. Sans cette clé, REA fonctionne toujours en mode inspection statique par règles ; **le site indique explicitement que Jev est non connecté**. Le plan Render gratuit ne peut pas héberger localement le modèle OpenJev 26B, qui demande une grosse carte NVIDIA ou du matériel équivalent. Attention : un service anonyme public reste exposé au spam, aux limites de débit et aux attaques contre les parseurs de fichiers ; les quotas applicatifs ne remplacent pas un reverse proxy/WAF ni un conteneur d'analyse isolé.

## Exécution sur un serveur existant (optionnel, aucune installation sur Android)

Node 24.22.1+ :

```bash
git clone https://github.com/dbrckk/rea-jev.git
cd rea-jev
npm install
REA_JEV_HOST=0.0.0.0 npm start
```

Le moteur est `REA_JEV_ENGINE=free` par défaut. Il ne requiert ni `TYPESAFE_API_KEY`, ni `OPENROUTER_API_KEY`, ni `ANTHROPIC_API_KEY`. Le fichier est stocké par défaut dans `~/.rea-jev-gui` ; ajuster `REA_JEV_DATA_DIR`.

Les extensions et en-têtes connus déclenchent notamment `inspect-artifact` (APK et fichiers génériques), `inspect-pe-imports` (PE), `inspect-elf-notes` (ELF), `inspect-sqlite-database` ou `inspect-model-artifact` selon les moteurs disponibles. Chaque résultat provient réellement de la CLI ; lorsqu'une commande REA ne prend pas en charge un fichier, cela apparaît explicitement comme **non vérifié**.

**Précautions :** aucun fichier fourni n'est volontairement exécuté ; les analyseurs lisent néanmoins un contenu non fiable. Pour Ghidra/JADX (décompilation profonde), un serveur mieux doté et isolé est nécessaire. Le plan Render gratuit ne peut pas promettre une investigation approfondie de toute application. La session anonyme n'est pas une sandbox ni une solution complète contre les abus et les ressources CPU/stockage sont limitées.

## Développement

```bash
npm install
npm run check
npm test
```

Références : [REA](https://github.com/morluto/rea), [plugin REA–Jev](https://github.com/juan-viox/rea-jev), [prix Jev](https://typesafe.ai/), [Render Free](https://render.com/docs/free).

## Vérification Jev

Le dashboard interroge automatiquement le fournisseur côté serveur (une requête System One courte, mise en cache cinq minutes). Il distingue : `NON CONNECTÉ`, `configuré mais non fonctionnel`, ou `CONNECTÉ — réponse vérifiée`. Les décisions sont enregistrées dans le rapport, avec probabilités et incertitudes ; aucune estimation Jev n'est traitée comme une preuve. Les requêtes Jev ne servent jamais à exécuter un fichier, lancer une commande arbitraire ou publier des données. Si une API externe est activée, de courts extraits d'observations sont transmis au fournisseur ; pas les octets du binaire.

**État de la version déployée sans clé Codiv :** REA fonctionne, Jev/OpenJev **ne fonctionne pas encore** et ne peut être présenté comme actif. La création/connexion au compte tiers et la configuration de la clé serveur nécessitent l'autorisation et les identifiants de l'exploitant, pas un champ de jeton pour les visiteurs.

## Activation réelle d'OpenJev sur le Render existant

Le service `rea-jev-studio` tourne gratuitement sur Render et expose une interface sans jeton. Pour activer **la vraie intelligence System One OpenJev**, une authentification **entre le serveur et Codiv** est obligatoire. Aucune authentification n'est saisie par le visiteur.

Une seule configuration par l'administrateur du service :

1. Aller sur [Codiv](https://codiv.ai/), ouvrir le tableau de bord gratuit et générer une clé API (pas de carte bancaire dans l'offre gratuite publiée).
2. Dans [Render → rea-jev-studio](https://dashboard.render.com/web/srv-dbjjrp49v7es73aap6c0), choisir **Environment → Add Environment Variable**, nom `CODIV_API_KEY`, valeur = clé personnelle ; **Save, deploy**.
3. Ouvrir le [site](https://rea-jev-studio.onrender.com). La ligne **System One : OpenJev CONNECTÉ — réponse vérifiée** n'apparaît qu'après un aller-retour API réel. Si la clé est invalide, expirée, épuisée ou le réseau inaccessible, le site affiche un défaut et utilise les analyses REA déterministes.

La clé doit être enregistrée exclusivement dans les variables secrètes Render : **ne pas la placer dans le dépôt GitHub, dans un champ de l'interface ni dans une discussion publique**.

### Vérification technique et limites

Le CI GitHub couvre les contrôles HTTP anonymes et d'isolation, les appels REA réels sur des fichiers synthétiques, et un enchaînement REA → quatre étapes Jev → rapport avec réponses HTTP **simulées**. Ces tests prouvent le câblage logiciel, **pas la connexion au modèle hébergé**. Seule la sonde serveur `GET /api/status` (via la session automatique) vérifie la connexion API véritable. Les décisions ne remplacent pas un agent de génération de code ni la décompilation JADX/Ghidra. Les sorties envoyées à Codiv sont des projections limitées des preuves REA : aucun octet du fichier source n'est transmis par ce chemin, même si des informations techniques sur le fichier sont partagées avec le service tiers.
