# Plan front — refonte d'InducksButBetter

> Complément de [PLAN.md](PLAN.md), qui couvre la donnée et le moteur.
> Celui-ci couvre la coquille, la navigation et l'identité visuelle.
>
> Rédigé le 22/07/2026.

---

## 1. Constat

### 1.1 L'apparence n'a aucune identité — et c'est mesurable

Ce n'est pas une impression : `src/index.css` porte **le thème shadcn/ui par défaut, non modifié**.

```css
--primary: 221.2 83.2% 53.3%;   /* le bleu par défaut du template */
--background: 0 0% 100%;         /* blanc pur */
--foreground: 222.2 84% 4.9%;    /* quasi-noir */
--radius: 0.5rem;                /* la valeur par défaut */
```

Les surfaces sont des `zinc` standard, et `tailwind.config.js` ne déclare **aucune famille de
police** : le site s'affiche dans la police système.

D'où la sensation de « site généré » : c'est littéralement l'habillage que tout projet
échafaudé avec ces outils porte au premier jour. Le contraste blanc pur / quasi-noir explique
aussi le « trop sombre ou trop flash » — il n'y a aucune valeur intermédiaire chaude.

**Rien de tout cela n'évoque Inducks, ni la bande dessinée Disney.**

### 1.2 La coquille est verrouillée sur la hauteur de la fenêtre

`App.tsx` imbrique deux `h-screen`, et chaque onglet était en `overflow-hidden` :

```jsx
<div id="main-content" className="h-screen overflow-y-auto ...">   {/* ne déborde jamais */}
  <div className="flex flex-col h-screen shrink-0">                 {/* ...à cause de celui-ci */}
```

Conséquence : la page ne défile pas, et tout contenu plus haut que la fenêtre est coupé.
Chaque écran doit alors réimplémenter son propre ascenseur interne — ce que fait le
formulaire de recherche, mais pas le reste.

J'ai basculé les onglets en `overflow-y-auto` : **c'est un filet de sécurité, pas le
remède.** Mesuré, il reste inerte, parce que les composants enfants sont eux aussi en
`h-full` et remplissent exactement la zone. Le vrai correctif est de renoncer à la coquille
à hauteur fixe (§3.1).

### 1.3 La navigation est un empilement de conditions, pas un routeur

Six `useState` de codes sélectionnés, résolus par un ternaire en cascade. Cette forme a
directement produit un bug :

```jsx
{selectedIssuecode ? <IssueDetail onSelectStory={code => setSelectedStorycode(code)} />
 : selectedPublicationcode ? ...
```

Ouvrir une histoire depuis le sommaire d'un numéro posait bien le storycode — mais
`selectedIssuecode` étant testé d'abord, `IssueDetail` restait affiché. Il fallait cliquer
« retour » pour que l'histoire apparaisse enfin. **Corrigé**, mais la cause reste : sans
notion de pile de navigation, chaque nouvel écran rouvre le même risque.

### 1.4 Les réglages occupent un onglet plein écran

`activeTab === "settings"` masque toute la barre d'onglets et remplace la page. Un réglage
n'est pas une destination : c'est une parenthèse. On perd le contexte et on ne sait plus d'où
l'on vient.

---

## 2. Direction visuelle : ce que doit évoquer une base de données Picsou

Le sujet a une identité graphique très forte et parfaitement documentée — autant s'en servir
plutôt que d'inventer.

### 2.1 Ce qu'on vise

**Le papier plutôt que l'écran.** Les comics Disney de l'âge d'or sont imprimés sur du papier
journal crème, en trichromie grossière. Un fond légèrement chaud (crème, pas blanc pur) et
une encre brun-noir (pas `#0a0a0a`) suppriment d'un coup l'effet « interface clinique ».

**Une couleur d'accent issue du corpus, pas du template.** Le rouge vermillon des couvertures
Barks, ou le jaune-or de Picsou. Utilisée avec parcimonie — un accent, pas un aplat.

**La densité assumée d'un catalogue.** Inducks est un outil de recherche pour collectionneurs :
beaucoup d'information par écran, des tableaux lisibles, des codes bien alignés. Ce n'est pas
une landing page. La typographie doit servir la lecture en diagonale.

**Une typographie qui a un point de vue.** Une grotesque ou une serif de labeur pour le texte,
et surtout **une police à chasse fixe pour les codes Inducks** (`W OS  178-02`) : ce sont des
identifiants, l'alignement des colonnes compte autant que dans du code.

### 2.2 Ce qu'on évite

Les dégradés violet-bleu, le verre dépoli partout, les ombres portées diffuses, les coins
très arrondis, les émojis en guise d'icônes. Ce sont les marqueurs exacts de l'habillage par
défaut — c'est-à-dire de ce que tu as reconnu comme « très AI ».

### 2.3 Trois directions possibles

| | Fond | Accent | Impression |
|---|---|---|---|
| **A. Papier journal** | crème `#F7F3EA` | vermillon `#C8452F` | chaleureux, patrimonial, très marqué comics |
| **B. Catalogue sobre** | blanc cassé `#FAFAF8` | bleu canard `#1F6F78` | proche d'Inducks lui-même, austère et sérieux |
| **C. Kiosque** | crème | jaune-or `#E8A317` + encre | plus joyeux, évoque la couverture d'un Picsou Magazine |

Chacune décline un mode sombre — mais **un vrai** : encre chaude sur brun très foncé, pas le
`#020817` actuel qui donne l'aspect « terminal ».

**Ce choix t'appartient** : c'est le seul point du plan que je ne peux pas trancher à ta place,
parce qu'il engage le goût et pas la technique.

---

## 3. Chantiers

### Étape F1 — Libérer la mise en page *(prérequis de tout le reste)*

- [ ] Supprimer le `h-screen` imbriqué : la page défile naturellement, l'en-tête et la barre
      d'onglets deviennent `sticky` plutôt que des blocs à hauteur figée
- [ ] Retirer les `h-full` des écrans, qui ne servent qu'à compenser la coquille
- [ ] Vérifier chaque écran à 400, 620 et 900 px de haut, et en largeur mobile
- [ ] Conserver un conteneur défilant dédié **uniquement** là où c'est justifié (liste de
      résultats virtualisée)

> À faire en premier : retoucher les couleurs d'une mise en page cassée revient à repeindre
> un mur qui penche.

### Étape F2 — Une vraie navigation

- [ ] Introduire un routeur (react-router) et supprimer les six `useState` de codes
- [ ] Modéliser une **pile** : numéro → histoire → personnage, avec un « retour » qui remonte
      d'un cran au lieu de tout effacer
- [ ] URL lisibles et partageables, et titre de page cohérent (`useRouteMetadata` existe déjà)
- [ ] Conserver le routage par hash tant que l'hébergement est statique, ou configurer la
      réécriture côté Cloudflare Pages pour des URL propres

### Étape F3 — Identité visuelle

- [ ] Remplacer les jetons de couleur par la direction retenue (§2.3), **clair et sombre**
- [ ] Choisir et charger les polices en local (pas de CDN : la CSP des pages statiques et le
      hors-ligne l'imposent), dont une à chasse fixe pour les codes Inducks
- [ ] Réviser rayons, ombres et espacements : moins arrondi, ombres plus franches et rares
- [ ] Composant `<InducksCode>` dédié : chasse fixe, sélection facile, copie en un clic

### Étape F4 — Réglages en surcouche

- [ ] Transformer l'onglet Réglages en `Dialog` Radix, monté par-dessus la page
- [ ] Fond flouté (`backdrop-blur`) + voile sombre, animation d'entrée et de sortie
- [ ] Fermeture par `Échap`, par clic sur le voile, et piège de focus (Radix le fournit)
- [ ] Ne plus masquer la barre d'onglets : on ne quitte pas son contexte pour régler la langue

### Étape F5 — Fiabilité perçue

- [ ] États vides, de chargement et d'erreur cohérents sur tous les écrans
- [ ] La recherche d'histoires est encore lente (§4) : afficher une progression honnête plutôt
      qu'un squelette immobile, et rendre l'annulation possible
- [ ] Images : `loading="lazy"`, ratio réservé pour supprimer les sauts de mise en page,
      repli visuel propre quand la vignette manque
- [ ] Accessibilité : contrastes AA, navigation au clavier, libellés des champs

### Étape F6 — Finitions

- [ ] Traduire les libellés français en dur de `src/lib/constants.ts` (6 langues supportées,
      ces listes ne le sont pas)
- [ ] Corriger `manualChunks` dans `vite.config.ts:38` — `id.includes('react')` capture
      `react-day-picker`, `lucide-react`, etc., donc tout atterrit dans un seul paquet
- [ ] Le paquet `ai-vendor` pèse **5,95 Mo** (2,1 Mo compressés) : ne le charger qu'à
      l'ouverture réelle de l'assistant

---

## 4. Le point qui conditionne tout : la recherche est encore lente

Mesuré dans un vrai navigateur : **la recherche d'histoires met 30 à 60 secondes.**

La cause est connue et documentée : la requête produit une dizaine de sous-requêtes corrélées
par ligne affichée. J'en ai supprimé deux en les branchant sur les tables regroupées, il en
reste. La correction n'est pas un réglage mais un remaniement : récupérer les 24 identifiants
de la page, puis charger leurs annexes **en une passe groupée** au lieu d'une cascade par
ligne.

**Aucune refonte visuelle ne rendra acceptable un écran qui met une minute à répondre.** Ce
chantier appartient à la donnée, pas au front — mais il conditionne la perception de tout le
reste. Il devrait passer avant F3.

Ce qui est déjà rapide et peut être habillé dès maintenant : l'éditeur SQL, les fiches
histoire et numéro, les autocomplétions, la navigation par pays.

---

## 5. Ordre proposé

1. **La recherche d'histoires** (donnée) — sans quoi le reste est cosmétique
2. **F1** — libérer la mise en page
3. **F2** — la navigation, tant que les écrans sont peu nombreux
4. **F4** — les réglages en modale, petit chantier au bon rapport visible/effort
5. **F3** — l'identité, une fois la structure saine
6. **F5**, **F6**
