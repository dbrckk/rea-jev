# REA × Jev — interface web gratuite

Interface web pour importer un APK, EXE, DLL, archive, etc., saisir une consigne et obtenir un rapport d'inspection, sans Termux ni installation Android.

## Mode gratuit par défaut

- **REA 6.5.0 (MIT)** exécute des analyses statiques réelles via sa CLI.
- Le routage des commandes est **déterministe** par défaut (type de fichier et demande), sans appel payant.
- **OpenJev (Codiv)** est facultatif : si le serveur dispose d'une clé gratuite `CODIV_API_KEY`, il priorise les analyses et DiffusionGemma fournit une interprétation séparée des preuves. Codiv annonce 100 M tokens gratuits pour les décisions et 10 M pour la génération. Ce modèle n'est **pas** le Jev propriétaire de TypeSafe.
- Le rapport Markdown rassemble résultats, empreinte SHA-256, preuves, erreurs et limites.
- **Attention : le vrai Jev de TypeSafe n'est pas inclus dans le mode gratuit.** Il est propriétaire et facturé par API. Il sert à classifier et choisir, **pas** à créer du texte ou conduire une enquête autonome.
- L'ancien mode agent Claude + plugin REA–Jev reste disponible en option pour une installation privée, mais **n'est pas utilisé par défaut**.

## Utilisation depuis Android

Ouvrir **https://rea-jev-studio.onrender.com** dans le navigateur, sélectionner un fichier, décrire la recherche et lancer. **Aucun compte, mot de passe, jeton à entrer ou logiciel local n'est requis.** Le serveur attribue automatiquement une session privée (cookie signé, `HttpOnly`, `SameSite=Strict`, `Secure` en HTTPS). Les fichiers, tâches et rapports d'un navigateur sont isolés des autres sessions.

Les tâches peuvent être annulées et le rapport est téléchargeable. **Les fichiers sont temporairement stockés sur le serveur** et peuvent disparaître après redémarrage ou déploiement sur Render Free. Les rapports sont supprimés automatiquement au bout de 12 heures ; les imports sans tâche après 20 minutes. Les limites sont de 30 Mio par fichier sur Render, 3 imports conservés par navigateur, 12 imports globaux et 120 Mio cumulés. Télécharger immédiatement les rapports. **Une session anonyme ne garantit pas l'identité du visiteur ni une protection contre les abus ; ne pas importer de secrets professionnels ou de fichiers sensibles sans audit de sécurité et isolation renforcée.**

## Déploiement gratuit Render

Le dépôt comprend un `render.yaml` pour le déploiement Blueprint. Sur Render : `New > Blueprint`, sélectionner `dbrckk/rea-jev`, plan `Free`, valider le service. Le plan Free s'endort après 15 minutes d'inactivité, utilise 512 Mo de RAM, et a des quotas mensuels. Les très grands fichiers et certaines inspections dépassent les limites. Aucune facturation n'est nécessaire tant qu'aucune offre payante n'est activée. Vérifier les modalités actuelles sur https://render.com/docs/free.

Le service public existant est [REA × Jev Studio](https://rea-jev-studio.onrender.com), sur Render Free. **Aucun secret d'accès client n'est nécessaire.** Facultativement, l'exploitant du serveur peut ajouter `CODIV_API_KEY` en tant que secret Render pour OpenJev. Sans cette clé, REA fonctionne toujours en mode inspection statique par règles. Attention : un service anonyme public reste exposé au spam, aux limites de débit et aux attaques contre les parseurs de fichiers ; les quotas applicatifs ne remplacent pas un reverse proxy/WAF ni un conteneur d'analyse isolé.

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
