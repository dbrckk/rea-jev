# REA × Jev — Interface d'analyse

Interface web (ordinateur ou Android) pour envoyer un APK, EXE, DLL, ELF, ASAR, JAR, ZIP ou autre artefact et déclencher une investigation assistée par **REA + Jev**.

**Important :** Jev est un moteur de décisions rapides, pas un agent autonome. Le raisonnement et les appels aux outils REA sont effectués par **Claude Code** via le plugin [juan-viox/rea-jev](https://github.com/juan-viox/rea-jev) (MIT). Sans clé Jev, REA et l'agent continuent à fonctionner, mais les décisions Jev sont désactivées. Claude Code peut nécessiter un abonnement ou une facturation API.

## Installation sur Linux / serveur

Prérequis : Node.js compatible avec REA (suivre les [exigences officielles](https://github.com/morluto/rea)), npm, git, Claude Code authentifié et les outils d'analyse requis (Java + JADX pour APK ; Ghidra ou Hopper pour analyse native profonde).

```bash
git clone https://github.com/dbrckk/rea-jev.git
cd rea-jev
bash scripts/setup.sh
export REA_JEV_TOKEN="$(openssl rand -hex 24)"
# Optionnel : export TYPESAFE_API_KEY="..."
npm start
```

Le script installe le plugin upstream à une révision fixe, et, si Java/Javac sont présents, télécharge la version du moteur JADX indiquée par REA après contrôle SHA-256. Pour les APK sans JDK, installer un JDK complet et lancer `bash scripts/install-android.sh`. Pour l'analyse native profonde (EXE/ELF), configurer Ghidra 12.1.x dans `GHIDRA_INSTALL_DIR`.

Ouvrir http://127.0.0.1:3099 sur le même PC. Pour un Android relié à un serveur, préférer un tunnel SSH ou un réseau privé (ex. Tailscale) et définir REA_JEV_HOST=0.0.0.0 avec REA_JEV_TOKEN obligatoire. L'interface est pensée pour un usage privé, **pas** pour être publiée sans authentification HTTPS et isolation renforcée.

```bash
REA_JEV_HOST=0.0.0.0 REA_JEV_TOKEN="une-longue-valeur-aleatoire" npm start
```

Le premier accès demande le jeton d'accès si configuré. Aucun jeton n'est enregistré dans les fichiers du projet.

## Fonctionnement

1. Déposer un fichier (jusqu'à 256 Mio, configurable via REA_JEV_MAX_UPLOAD_MB).
2. Décrire la fonctionnalité à comprendre. Par défaut, l'enquête reste statique et limitée au fichier.
3. L'interface crée une tâche, lance Claude Code en mode non interactif avec le plugin REA–Jev, affiche les traces et conserve un rapport Markdown.
4. Les tâches s'exécutent une par une. On peut interrompre un travail et supprimer les fichiers d'une tâche terminée.

Les artefacts et rapports résident dans `REA_JEV_DATA_DIR` (par défaut `~/.rea-jev-gui`) et ne sont jamais ajoutés à Git. Un jeton n'est requis que si le service n'écoute pas uniquement sur localhost, mais il est recommandé dans tous les cas.

**Règles de sécurité :** analyser uniquement des programmes dont l'inspection est autorisée ; aucune exécution volontaire du binaire ; pas d'interaction réseau avec le programme ; aucune commande shell de l'agent n'est autorisée par cette interface. Le sous-processus et les moteurs d'analyse ont néanmoins accès aux ressources de leur compte système : faire tourner le service dans un compte dédié et un environnement isolé lorsque les fichiers ne sont pas fiables.

### Variables utiles

| Variable | Usage |
| --- | --- |
| `REA_JEV_HOST` / `PORT` | Adresse d'écoute / port (127.0.0.1:3099 par défaut) |
| `REA_JEV_TOKEN` | Secret Bearer pour l'API |
| `REA_JEV_PLUGIN_DIR` | Chemin vers le plugin upstream téléchargé |
| `REA_JEV_DATA_DIR` | Stockage privé des analyses |
| `REA_JEV_MAX_UPLOAD_MB` | Taille maximale d'un fichier, défaut 256 |
| `REA_JEV_MAX_TURNS` | Nombre maximal de tours de l'agent, défaut 35 |
| `REA_JEV_TIMEOUT_MIN` | Durée maximale d'une tâche, défaut 30 |
| `TYPESAFE_API_KEY` / `OPENROUTER_API_KEY` | Activation facultative de Jev |
| `REA_JEV_MODE` | Mode Jev, défaut `advise` |

## Limites

La présence de REA et Jev dans le dépôt ne signifie pas que les dépendances natives sont disponibles sur votre serveur. Le diagnostic `/api/status` permet de voir si Claude et le plugin sont détectés ; la configuration Ghidra/JADX doit être vérifiée avec les outils REA sur la machine cible. Les résultats dépendent de l'artefact, des moteurs disponibles, et des limites de session ou de crédits de l'agent.

Origine : plugin [juan-viox/rea-jev](https://github.com/juan-viox/rea-jev) + moteur [morluto/rea](https://github.com/morluto/rea). Cette interface est une application distincte et ne remplace pas leurs outils. La version upstream est épinglée par le script d'installation.

## Développement

```bash
npm test
npm run check
```
