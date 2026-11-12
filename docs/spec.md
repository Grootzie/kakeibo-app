# Spécifications · appli kakeibo (V1)

> Copie du [document de spécifications](https://claude.ai/artifact/71tMXdJNxRnPD14BioaLJb), révision 847, exportée le 12 novembre 2026. Si les deux diffèrent, le document en ligne fait foi : le propriétaire fait ré-exporter cette copie quand il le change.

## Résumé

Ce document est la référence unique des agents qui développent l'appli : ce qu'il faut construire, les règles du jeu au chiffre près, les données, l'architecture et la façon de travailler. Quand il tranche, l'agent applique sans demander ; quand il ne tranche pas, l'agent s'arrête et pose la question (voir Organisation des agents).

**Le produit.** Une appli de kakeibo, le carnet de comptes japonais, pour iPhone et Android, en français, puis traduite dans d'autres langues, entièrement hors ligne, sans compte ni connexion bancaire. Ce n'est pas un outil de comptabilité mais un outil de prise de conscience : on note soi-même chaque dépense et on clôture sa journée chaque soir. Cette régularité fait vivre une maison japonaise : une semaine complète fait gagner un objet, une semaine hors budget fêle un objet, que la régularité répare à l'or, comme le kintsugi.

**Validé :** saisie manuelle sans lien bancaire, clôture du soir, tampons, poussière, objets qui se fêlent et se réparent par la régularité, 7 tampons sur 7 pour l'objet de la semaine, en capsule et sans hasard, une pièce par mois, le style estampe vu de face et le nom « Kakeibo, budget à la japonaise ».

**À trancher :** la publicité dans la version gratuite, le prix de l'abonnement et quelques règles secondaires. Chaque point a une valeur par défaut que les agents appliquent en attendant (voir Décisions ouvertes).

## Principes du produit

Ces principes passent avant tout le reste : une fonctionnalité qui en contredit un est refusée, même si elle paraît utile.

1. **Prise de conscience, pas comptabilité.** L'utilisateur note lui-même chaque dépense. Ni import bancaire, ni scan de tickets, ni saisie automatique.
2. **Un mois : une pièce.** Une nouvelle année : un reset de toutes les pièces et de tous les objets (mais historisés).
3. **Récompenser l'honnêteté plus que la vertu.** La récompense principale vient de la régularité, pas du fait de peu dépenser. Dépasser son budget coûte peu (une fêlure réparable), pour que mentir ne rapporte rien.
4. **Aucune spirale de punition.** Rien ne se perd définitivement et aucun message ne culpabilise. Une punition trop dure fait fuir l'utilisateur au moment où il en a le plus besoin (l'effet autruche).
5. **Rapide.** Noter une dépense prend moins de 5 secondes depuis l'accueil ; clôturer sa journée, une touche.
6. **Privé par construction.** Les données restent sur le téléphone : aucun compte, aucun serveur, aucun traceur tiers.
7. **L'argent n'achète jamais ce que la régularité fait gagner.** Ni objets, ni réparations, ni tampons payants.
8. **Peu de sollicitations.** Une notification par jour au plus, désactivable.
9. **Accessible à tous.** Niveau AA des règles WCAG 2.2, lecteurs d'écran, grands caractères.
10. **Toujours expliquer.** Chaque mécanique est expliquée la première fois qu'elle apparaît, en une ou deux phrases : la méthode, les tampons, la capsule gashapon, la poussière, le kintsugi, chaque objet. Tout reste consultable dans Comprendre (E12).

## Périmètre de la V1

La V1 contient tout ce qu'il faut pour vivre la boucle complète pendant plusieurs mois, et rien de plus.

| Dans la V1 | Pas dans la V1 |
| --- | --- |
| Accueil : la maison, l'enveloppe de la semaine, la carte de tampons | import de relevés, scan de tickets, saisie vocale |
| Saisie, modification et suppression d'une dépense | Compte, synchronisation entre appareils, kakeibo à deux |
| Clôture du jour et rattrapage des jours oubliés | Placement libre des objets (emplacements fixes en V1) |
| Bilan de la semaine et bilan du mois | Autres langues et devises |
| La maison : 12 pièces, 36 objets de base, 52 objets à gagner, poussière, fêlures, réparations | Widgets, montre, verrouillage par code (prévus en V1.1) |
| Carnet : historique par semaine et par mois | Habillages B et D, autres maisons, achat définitif (à voir) |
| Réglages | Toute fonction qui envoie des données hors du téléphone |
| Essai gratuit d'un mois, puis le modèle retenu (voir Monétisation) | Export CSV, sauvegarde et restauration |
| Français et euro uniquement |  |

## Écrans et parcours

L'appli tient en un écran d'accueil d'où l'on ouvre tout le reste. Les écrans sont numérotés pour être cités dans les tickets ; les maquettes des pistes de style montrent l'accueil.

### E1 · Bienvenue (première ouverture)

1. **La méthode en une minute :** noter, clôturer chaque soir, faire le bilan, avec la maison en illustration.
2. **Les quatre catégories :** Essentiel, Envies, Culture, Imprévus, avec deux exemples chacune.
3. **Mon mois :** revenus, charges fixes, épargne visée. L'écran affiche le budget du mois et l'enveloppe de la semaine. On ne continue que si le budget du mois est supérieur à zéro.
4. **Mon rappel du soir :** heure (21 h par défaut), puis demande d'autorisation des notifications. Un refus n'empêche rien.

L'utilisateur arrive ensuite sur l'accueil, avec la pièce du mois et ses 3 objets de base.

### E2 · Accueil

- **En-tête :** la date du jour, l'accès au carnet et aux réglages.
- **La maison :** la pièce affichée, avec la poussière éventuelle. Un glissement passe d'une pièce débloquée à l'autre ; toucher la maison ouvre E8.
- **L'enveloppe :** « Il te reste 63 € jusqu'à dimanche », le budget de la semaine et une jauge. En cas de dépassement : « Tu as dépassé de 12 € cette semaine », sans alerte rouge.
- **La carte de tampons :** 7 cases du lundi au dimanche. Une case peut être clôturée, à clôturer aujourd'hui, oubliée mais rattrapable, hors décompte (avant l'installation) ou à venir.
- **Deux boutons :** « Noter une dépense » (principal) et « Clôturer ma journée », qui devient « Journée clôturée » une fois fait.
- **Un seul bandeau à la fois**, par ordre de priorité : bilan de la semaine prêt, bilan du mois prêt, jour à rattraper, résolution du mois.

### E3 · Noter une dépense

- Une feuille monte du bas, le pavé numérique ouvert sur le montant.
- Quatre boutons de catégorie : toucher une catégorie enregistre la dépense et ferme la feuille.
- Avant de choisir la catégorie, on peut ajouter une note (80 caractères au plus) et changer la date, parmi les jours des semaines encore ouvertes.
- Montant accepté : de 0,01 € à 99 999,99 €.
- Après l'enregistrement, l'enveloppe se met à jour et un message « Annuler » reste visible 5 secondes.
- On peut enregistrer une dépense hebdomadaire ou mensuelle, visible sur un calendrier (abonnements Spotify, YouTube, etc.)

### E4 · Clôturer ma journée

- On y arrive par la notification du soir, par le bouton de l'accueil ou par un jour à rattraper.
- L'écran liste les dépenses du jour avec le total par catégorie, et propose « Ajouter une dépense oubliée ».
- Un seul bouton de validation : « J'ai tout noté » s'il y a au moins une dépense, « Rien dépensé aujourd'hui » sinon. Le tampon se pose avec une animation, un jeton tombe dans la machine, puis retour à l'accueil.
- Une clôture ne s'annule pas. On peut encore ajouter une dépense oubliée à un jour clôturé tant que sa semaine est ouverte.

### E5 · Rattraper un jour

Identique à E4, pour un jour passé d'une semaine encore ouverte, avec un titre explicite : « Rattraper mercredi 4 novembre ».

### E6 · Bilan de la semaine

Il s'ouvre à la première ouverture de l'appli après le scellement de la semaine, en quatre temps animés :

1. Les tampons de la semaine (par exemple 7 sur 7).
2. Le dépensé face à l'enveloppe.
3. Le résultat, selon les règles : si la semaine a tous ses jetons, l'utilisateur tire la tirette (bouton « Tirer la tirette »), la capsule tombe et s'ouvre sur l'objet de la semaine ; sinon la poussière ; parfois un objet qui se fêle.
4. L'objet apparaît dans la maison, avec une phrase de conclusion.

Après une longue absence, un seul écran récapitule les semaines manquées.

### E7 · Bilan du mois

- Il s'ouvre à la première ouverture de l'appli à partir du 1er du mois suivant.
- Les trois premières questions sont déjà chiffrées : ce que j'avais, ce que je voulais mettre de côté, ce que j'ai dépensé (par catégorie), puis ce que j'ai vraiment épargné.
- La quatrième, « Comment puis-je faire mieux ? », se remplit en texte libre (140 caractères au plus). Elle devient la résolution affichée sur l'accueil le mois suivant.
- Puis : confirmation du budget du nouveau mois (pré-rempli) et déblocage de la pièce du nouveau mois.

### E8 · La maison

- Les pièces débloquées, les objets à leur place, les emplacements libres signalés discrètement.
- Un objet fêlé affiche sa réparation en cours : « Réparation : 4 jours sur 7 ».
- Toucher un objet ouvre sa fiche : son nom, ce qu'il représente au Japon et son histoire : « Gagné la semaine du 2 novembre. Fêlé le 15, réparé à l'or le 22. »
- L'album : les maisons des années passées, chacune telle qu'elle était à la fin de son année.

### E9 · Carnet

- Les dépenses par semaine, groupées par jour, avec les totaux par catégorie et un filtre par mois.
- Modifier ou supprimer une dépense.
- Les semaines scellées affichent leur résultat (tampons, budget).
- Le calendrier des dépenses récurrentes : les échéances du mois et leur total. Toucher une échéance ouvre sa fiche, pour la modifier ou l'arrêter.

### E10 · Réglages

- **Budget du mois :** revenus, épargne visée, et charges fixes détaillées en dépenses récurrentes.
- **Rappel du soir :** heure, activé ou non.
- **Données :** tout effacer, avec double confirmation (l'export et la sauvegarde viendront après la V1).
- **Abonnement :** formule en cours, gérer mon abonnement, restaurer mes achats.
- **Publicité, si elle est retenue :** revoir son consentement, à tout moment.
- **À propos :** la méthode, la confidentialité, les mentions légales, le contact.

### E11 · Écran d'achat

Il s'affiche à la fin du mois d'essai, puis reste accessible depuis les réglages. Il présente les formules (voir Monétisation) avec leurs prix TTC et un bouton de fermeture bien visible. Refuser ne bloque rien d'essentiel : la version gratuite garde toute la méthode, et les données ne sont jamais prises en otage. La méthode de rémunération reste encore à définir ; pour l'instant, partir sur : essai gratuit d'un mois, puis possibilité d'acheter tous les jours, ou refuser, avec de la pub dans l'application.

### E12 · Comprendre

- À chaque première fois, une carte d'explication s'affiche, qu'on ferme d'un geste : méthode, catégories, budget et enveloppe, première dépense, premier tampon, première capsule, premier jour à rattraper, première poussière, première fêlure, première réparation, premier bilan du mois, nouvelle pièce, nouvelle année. Les textes sont dans Textes et ton.
- Chaque carte propose « En savoir plus », qui ouvre l'écran Comprendre, accessible aussi depuis les réglages.
- Comprendre rassemble la méthode kakeibo, les quatre catégories, les quatre questions, les règles de la maison, le kintsugi, les gashapon, les fêtes de chaque mois et la fiche de chaque objet obtenu.

## Règles du jeu

Toutes les règles sont des fonctions pures du domaine (voir Architecture). Les nombres ci-dessous sont des valeurs exactes, pas des exemples.

### Définitions

- **Jour :** date civile locale du téléphone, au format AAAA-MM-JJ. Chaque dépense est rattachée à un jour, aujourd'hui par défaut.
- **Semaine :** du lundi 00:00 au dimanche 23:59, heure locale, identifiée par son numéro ISO 8601 (par exemple 2026-W45).
- **Jour décompté :** jour postérieur ou égal au jour d'installation. Hors première semaine, une semaine compte donc 7 jours décomptés.
- **Semaine ouverte :** la semaine en cours, et la semaine précédente jusqu'au lundi 12:00 (délai de grâce), tant qu'elle n'est pas scellée.
- **Clôture :** confirmation par l'utilisateur qu'un jour est complet. Possible seulement pour un jour décompté, pas dans le futur, d'une semaine ouverte. Définitive.
- **Tampon :** un jour clôturé.

### Budget et enveloppe

- **Budget du mois** = revenus − charges fixes − épargne visée, en centimes, strictement positif.
- **Enveloppe d'une semaine** = somme, pour chacun de ses jours décomptés, du budget du mois de ce jour divisé par le nombre de jours de ce mois. Calcul exact, arrondi au centime le plus proche à la fin.
- **Budget pris en compte :** la version du budget en vigueur le lundi 00:00 de la semaine. Un changement de budget s'applique à l'enveloppe à partir de la semaine suivante.
- **Mois sans version de budget :** si le mois d'un jour décompté n'a aucune version de budget, l'enveloppe de ce jour utilise la version en vigueur la plus récente, tous mois confondus (reconduction).
- **Dépensé de la semaine :** somme des dépenses datées des jours de la semaine.
- **Dans le budget :** dépensé ≤ enveloppe. Le reste affiché vaut enveloppe − dépensé et peut être négatif.
- **Dépenses récurrentes :** loyer, abonnements et autres charges qui reviennent chaque semaine ou chaque mois (montant, fréquence, jour). Ce sont des charges fixes : la somme de leurs échéances du mois donne les charges fixes du budget, et elles n'entrent ni dans l'enveloppe ni dans le dépensé. Le montant saisi en E1 devient une première charge mensuelle, « Charges fixes », à détailler ensuite ; chaque changement crée une nouvelle version du budget.

### Scellement de la semaine

Une semaine est scellée au premier de ces deux moments :

1. dès que tous ses jours décomptés sont clôturés ;
2. le lundi suivant à 12:00, heure locale.

Une fois scellée, son résultat est figé. Ses dépenses restent modifiables dans le carnet, sans effet sur le résultat. Le bilan (E6) s'affiche à la première ouverture qui suit.

### Résultat d'une semaine

N est le nombre de jours décomptés de la semaine, T son nombre de tampons.

| Tampons | Budget | Résultat |
| --- | --- | --- |
| T = N | dans le budget | 1 objet, format gashapon |
| T = N | hors budget | 1 objet, format gashapon, et 1 objet se fêle |
| T < N | dans le budget | pas d'objet, mais l'environnement devient poussiéreux (toiles d'araignée, etc.), avec un message d'encouragement |
| T < N | hors budget | pas d'objet, mais l'environnement devient poussiéreux (toiles d'araignée, etc.), avec un message d'encouragement, et 1 objet se fêle |

Une semaine sans tampon ni dépense ne donne rien et ne fêle rien : l'absence n'est punie que par la poussière.

### Objets et pièces

- Chaque objet du catalogue appartient à une pièce et à un emplacement. Chaque pièce a 3 objets de base et 5 emplacements d'objets à gagner.
- Un mois, une pièce : douze pièces, de janvier à décembre. À l'installation, la pièce du mois de la semaine en cours s'ouvre avec ses 3 objets de base ; celle du mois suivant se débloque quand le bilan du mois est validé.
- **Objet de la semaine, format gashapon :** chaque jour clôturé fait tomber un jeton dans la machine ; les jetons d'une semaine sont ses tampons, ils ne se gardent pas d'une semaine à l'autre et ne s'obtiennent jamais contre de l'argent ni une publicité. Si la semaine a tous ses jetons (T = N), l'utilisateur tire la tirette au bilan : une capsule tombe de la machine et s'ouvre sur l'objet. Pas de hasard : c'est le prochain objet non obtenu de la pièce du mois, dans l'ordre du catalogue. Une semaine appartient au mois qui contient son jeudi.
- **Mois de 5 semaines :** selon l'année, un mois compte 4 ou 5 semaines. Le 5e emplacement n'apparaît que les années où le mois compte 5 semaines. Chaque semaine incomplète laisse un emplacement vide jusqu'à la fin de l'année.
- **Pièce pas encore débloquée :** si le bilan du mois précédent n'est pas validé, l'objet gagné attend, puis entre dans sa pièce dès le déblocage. Valider un bilan débloque aussi les pièces des mois sautés depuis le précédent bilan validé (ou depuis l'installation), avec leurs objets en attente.
- **Nouvelle année :** le lundi de la semaine 1 (norme ISO 8601), la maison repart de la pièce de janvier et de ses objets de base. La maison de l'année écoulée rejoint l'album telle quelle : objets, emplacements vides, fêlures et réparations. La file de réparation repart à zéro. La pièce de janvier s'ouvre sans attendre le bilan de décembre, qui ne débloque rien.

### Poussière

J = nombre de jours entre le dernier jour clôturé et hier (0 si le dernier jour clôturé est hier ou aujourd'hui ; sans aucune clôture, on part de la veille du jour d'installation).

| J | Niveau | Effet visuel |
| --- | --- | --- |
| 0 ou 1 | 0 | maison propre |
| 2 ou 3 | 1 | voile de poussière |
| 4 et plus | 2 | poussière, lumière baissée, toile d'araignée |

Clôturer un jour plus récent que le dernier jour clôturé recalcule le niveau ; clôturer aujourd'hui le remet à 0. La poussière n'abîme jamais un objet.

Après une semaine incomplète, la maison garde au moins le niveau 1 jusqu'à la prochaine semaine complète, même si les jours suivants sont clôturés.

### Fêlure et réparation

- **États d'un objet :** intact, puis fêlé, puis réparé à l'or. Un objet réparé ne se fêle plus : il garde ses veines d'or.
- **Quel objet se fêle :** l'objet intact obtenu le plus récemment dans l'année, hors objet gagné lors du même bilan ; à date égale, comme pour les objets de base, le dernier dans l'ordre du catalogue. S'il n'y en a aucun, rien ne se fêle.
- **File de réparation :** les objets fêlés sont réparés un par un, dans l'ordre où ils se sont fêlés.
- **Jour de départ :** pour le premier objet de la file, le lundi qui suit la semaine fautive ; pour les suivants, le lendemain de la réparation précédente, ou le lundi qui suit leur propre semaine fautive si ce lundi est plus tardif.
- **Réparation :** l'objet est réparé dès que 7 jours consécutifs, tous postérieurs ou égaux au jour de départ, sont clôturés. Une clôture de rattrapage peut donc compléter la série.
- **Affichage :** « Réparation : x jours sur 7 », où x est la longueur de la série de jours clôturés qui se termine au dernier jour clôturé, sans remonter avant le jour de départ.

### Bilan du mois

- Q1 = revenus − charges fixes ; Q2 = épargne visée ; Q3 = somme des dépenses datées du mois, toutes semaines confondues, hors dépenses récurrentes, déjà comptées dans les charges fixes.
- Épargne réelle = Q1 − Q3. Objectif atteint si l'épargne réelle est supérieure ou égale à Q2.
- Q4 : texte libre, de 0 à 140 caractères.
- Valider le bilan débloque la pièce du mois suivant, quel que soit le résultat (en décembre, voir Nouvelle année) : on récompense le fait de faire le bilan.
- Le bilan utilise la dernière version du budget du mois ou, si le mois n'en a aucune, la version en vigueur la plus récente (reconduction, comme pour l'enveloppe). Après plusieurs mois d'absence, seul le dernier mois terminé est proposé.

### Ordre de traitement

À chaque ouverture de l'appli et à chaque clôture, dans cet ordre :

1. Sceller les semaines dont le délai est dépassé, de la plus ancienne à la plus récente.
2. Enregistrer la clôture, s'il y en a une.
3. Calculer les réparations.
4. Sceller la semaine si tous ses jours décomptés sont clôturés.
5. Enregistrer les résultats et préparer les bilans à afficher.

## Scénarios de test

Ces 25 scénarios deviennent des tests automatisés du domaine avant toute implémentation ; un ticket qui en casse un n'est pas terminé. Contexte commun :

- Installation le lundi 2 novembre 2026.
- Budget de novembre et de décembre 2026 : revenus 2 000 €, charges fixes 1 100 €, épargne visée 300 €, donc 600 € par mois.
- Novembre compte 30 jours : 20 € par jour, soit 140 € pour une semaine entière de novembre.
- Semaine 45 : du lundi 2 au dimanche 8 novembre. Sauf mention contraire, chaque jour est clôturé le soir même.

| N° | Situation | Résultat attendu |
| --- | --- | --- |
| 1 | Semaine 45 : 7 clôtures, 120 € dépensés | Scellée à la clôture du dimanche 8. Le 1er objet à gagner de la pièce de novembre sort de sa capsule, rien ne se fêle |
| 2 | Semaine 45 : 7 clôtures, 150 € dépensés | Le même objet sort de sa capsule, et le 3e objet de base de novembre se fêle : à date égale, c'est le dernier dans l'ordre du catalogue |
| 3 | Semaine 45 : mercredi 4 jamais clôturé, 100 € dépensés | Scellée le lundi 9 à 12:00 avec 6 tampons. Pas de capsule, et la poussière reste au moins au niveau 1 jusqu'à la prochaine semaine complète |
| 4 | Comme le 3, avec 150 € dépensés | Pas de capsule, poussière comme au 3, et le même objet qu'au 2 se fêle |
| 5 | Mercredi 4 rattrapé le jeudi 5 à 8:00, les autres jours clôturés le soir | 7 tampons : même résultat que le 1 ou le 2 selon le dépensé |
| 6 | Dimanche 8 non clôturé le soir, clôturé le lundi 9 à 10:00 | Accepté : 7 tampons, scellement à cette clôture. À 12:01, la même clôture est refusée : semaine déjà scellée à 12:00 avec 6 tampons |
| 7 | Installation le jeudi 5 novembre, 4 clôtures, 70 € dépensés | 4 jours décomptés, enveloppe de 80 €. Le 1er objet à gagner de novembre sort de sa capsule |
| 8 | Semaine du lundi 30 novembre au dimanche 6 décembre | Enveloppe de 136,13 € : 20 € pour le 30 novembre, plus 6 × 600/31 € |
| 9 | Dernière clôture le lundi 2 | Jeudi 5 : poussière niveau 1. Samedi 7 : niveau 2. Après rattrapage du vendredi 6 : niveau 0 |
| 10 | Objet fêlé au bilan de la semaine 45, clôtures du lundi 9 au dimanche 15 | Réparé à la clôture du dimanche 15 |
| 11 | Fêlé en semaine 45 ; clôtures les 9 et 10, puis du 12 au 18 ; mercredi 11 jamais rattrapé | Affiche « 4 jours sur 7 » le dimanche 15. Réparé à la clôture du mercredi 18 |
| 12 | Objet A fêlé en semaine 45, objet B fêlé en semaine 46 ; clôtures sans interruption à partir du lundi 9 | A réparé dimanche 15, avant le scellement de la semaine 46 ; B réparé dimanche 22 |
| 13 | Semaine hors budget alors que tous les objets possédés sont fêlés ou réparés | Rien ne se fêle |
| 14 | Aucune ouverture entre le lundi 9 novembre et le mardi 1er décembre au matin | Semaines 46 à 48 scellées sans capsule ni fêlure, un seul écran récapitulatif, poussière niveau 2, bilan de novembre proposé. Le lundi 30 novembre reste rattrapable |
| 15 | Une dépense de la semaine 45 modifiée le mardi 10 | Résultat de la semaine 45 inchangé, le carnet affiche le nouveau montant |
| 16 | Le mercredi 4, le budget de novembre passe à 900 € | Enveloppe de la semaine 45 inchangée (140 €), semaine 46 à 210 € |
| 17 | Bilan de novembre avec 520 € dépensés dans le mois | Q1 900 €, Q2 300 €, Q3 520 €, épargne réelle 380 €, objectif atteint. Pièce de décembre débloquée à la validation |
| 18 | Semaine 49, du 30 novembre au 6 décembre, complète et dans le budget ; bilan de novembre pas encore validé | L'objet appartient à décembre (jeudi 3) : il attend, puis entre dans la pièce de décembre à la validation du bilan de novembre |
| 19 | Le lundi 9, clôture du mardi 10 ; dépense datée du jeudi 29 octobre | Les deux sont refusées : jour futur, jour avant l'installation |
| 20 | Semaines de novembre et de décembre 2026 | Novembre : semaines 45 à 48, donc 4 emplacements. Décembre : semaines 49 à 53, donc 5, car le jeudi de la semaine 53 tombe le 31 décembre |
| 21 | Semaine 53 complète ; le dimanche 3 janvier est rattrapé le lundi 4 janvier 2027 à 10:00 | La maison 2027 a démarré le lundi 4 à 00:00 : pièce de janvier, ses 3 objets de base, file de réparation vide. L'objet de la semaine 53 entre dans la pièce de décembre de la maison 2026, dans l'album |
| 22 | Semaines 45 à 47 complètes et dans le budget (objets A, B et C) ; semaine 48 : 7 tampons, hors budget | L'objet D sort de sa capsule et C se fêle : l'objet gagné au même bilan ne se fêle jamais |
| 23 | Le mardi 3 novembre, ajout d'un abonnement de 12 € le 15 de chaque mois | Nouvelle version du budget : charges fixes de 1 112 €, budget de novembre de 588 €. Semaine 45 inchangée (140 €), semaine 46 à 137,20 €. L'échéance du 15 n'entre pas dans le dépensé |
| 24 | Semaine du lundi 30 novembre au dimanche 6 décembre, aucune version de budget pour décembre | Décembre reprend la version de novembre (600 €) : enveloppe de 136,13 €, comme au 8 |
| 25 | Bilan de décembre, aucune version de budget pour décembre, 450 € dépensés dans le mois | Le bilan reprend la version de novembre : Q1 900 €, Q2 300 €, Q3 450 €, épargne réelle 450 €, objectif atteint |

## Modèle de données

Tout est stocké en local dans une base SQLite, avec des migrations versionnées. Les montants sont des entiers en centimes, les jours des chaînes AAAA-MM-JJ, les instants des dates ISO 8601 avec fuseau. Les noms techniques sont en anglais, comme le reste du code.

| Table | Champs principaux | Règles |
| --- | --- | --- |
| `settings` | install\_id, install\_day, reminder\_time, reminder\_enabled, trial\_start, plan, seen\_explanations, schema\_version | Une seule ligne ; plan : trial, free, subscribed ou lifetime, relu auprès du store à chaque ouverture ; seen\_explanations : les explications de première fois déjà vues |
| `budget_version` | id, month (AAAA-MM), income, fixed\_costs, savings\_goal, effective\_from | On n'écrase jamais une version : on en ajoute une. fixed\_costs : somme des échéances des dépenses récurrentes du mois |
| `expense` | id, day, amount, category, note, created\_at, updated\_at | category : essentiel, envies, culture ou imprevus ; note de 80 caractères au plus |
| `day_closure` | day (clé), closed\_at, kind | kind : complete ou no\_spend ; jamais supprimée |
| `week_result` | week (clé), sealed\_at, counted\_days, stamps, envelope, spent, in\_budget, complete, gashapon\_item, cracked\_item, ceremony\_seen | Écrit une fois au scellement, puis figé. complete : tous les jours décomptés clôturés ; gashapon\_item et cracked\_item peuvent être vides |
| `owned_item` | year et item\_id (clé), acquired\_at, week, source, placed\_at, state, cracked\_at, cracked\_week, repaired\_at | source : base ou weekly ; placed\_at vide tant que l'objet attend sa pièce ; state : intact, cracked ou repaired. Les années passées forment l'album |
| `unlocked_room` | year et room\_id (clé), unlocked\_at |  |
| `month_review` | month (clé), completed\_at, q1, q2, q3, real\_savings, resolution |  |
| `recurring_charge` | id, label, amount, frequency, day, starts\_on, ends\_on | frequency : weekly ou monthly ; day : jour de la semaine (1 à 7) ou du mois (1 à 31, ramené au dernier jour des mois plus courts) ; une charge arrêtée garde son historique (ends\_on) |

**Catalogue :** les pièces et les objets ne sont pas en base. Un fichier JSON livré avec l'appli (src/content) décrit chaque pièce (mois, nom, fête du mois, explication) et chaque objet : identifiant, pièce, rang qui fixe aussi son emplacement (1 à 3 pour la base, 1 à 5 pour les objets à gagner), nom avec son article et son genre, nom japonais (kanji et transcription), explication culturelle de deux phrases au plus, et ses trois visuels (base, fêlure, or).

**Export CSV, après la V1 :** colonnes date, catégorie, montant et note, séparées par des points-virgules, avec la virgule décimale, pour s'ouvrir directement dans Excel en français.

**Sauvegarde, après la V1 :** un fichier JSON complet avec la version du schéma, restaurable sur un autre téléphone. Les sauvegardes du système (iCloud, Google) restent actives.

## Architecture technique

Une appli Expo sans serveur, dont toute la logique métier vit dans un domaine pur, testé à part de l'interface.

```text
Écrans (app/, E1 à E12) ──modèle de scène──▶ Rendu de la maison (src/ui, seul lien au style)
        │ événements, lecture
        ▼
État de l'interface (src/state, Zustand)
        │ process(état, événement, heure)
        ├──────────────▶ Domaine (src/domain, règles pures) ◀── pièces et objets ── Catalogue (src/content, JSON)
        ├─ lit et enregistre ─▶ Dépôts (src/data, migrations) ──▶ Base SQLite (sur le téléphone)
        └─ rappels, achat ───▶ Services du téléphone (notifications, achat)
```

Les écrans ne parlent qu'à l'état ; seul l'état appelle le domaine, les dépôts et les services du téléphone.

### Choix techniques

| Besoin | Choix | Pourquoi |
| --- | --- | --- |
| Appli iPhone et Android | Expo (React Native), TypeScript strict | Un seul code ; builds iPhone sans Mac via EAS |
| Navigation | expo-router | Standard Expo |
| Stockage | expo-sqlite, migrations SQL versionnées, couche de dépôts | Hors ligne, fiable, sans serveur |
| État de l'interface | Zustand | Simple ; la logique métier reste dans le domaine |
| Dates | date-fns et sa locale française | Semaines ISO, formats français |
| Notifications | expo-notifications, en local uniquement | Aucun serveur de notifications |
| Abonnement et publicité | expo-iap ou react-native-iap, vérification sur l'appareil ; si la publicité est retenue, react-native-google-mobile-ads et son outil de consentement | Aucun service tiers ne reçoit de données d'achat ; la régie publicitaire reçoit, elle, des données d'usage (voir Monétisation) |
| Dessin de la maison | react-native-skia : couches d'images, textures et effets | Style estampe retenu : grain du papier, calques des objets, voile de poussière et baisse de lumière |
| Retours sensoriels | expo-haptics, sons facultatifs |  |
| Tests | Jest (jest-expo), React Native Testing Library, Maestro | Domaine, composants, parcours complets |
| Qualité | ESLint, Prettier, TypeScript strict sans any |  |
| Intégration continue | GitHub Actions ; builds et envoi aux stores par EAS |  |

### Structure du code

```
app/            écrans (expo-router)
src/domain/     règles pures et leurs tests, sans dépendance à React ni à Expo
src/data/       base SQLite, migrations, dépôts
src/state/      stores Zustand et sélecteurs
src/ui/         composants, thème, rendu de la maison
src/content/    catalogue des pièces et des objets
src/i18n/       textes (fr.ts)
assets/         visuels, polices, sons
e2e/            parcours Maestro
docs/           ce document exporté, décisions d'architecture
```

### Le domaine

Le domaine est déterministe : il ne lit jamais l'horloge, n'utilise aucun hasard et n'accède pas à la base. L'heure courante lui est passée en paramètre. Signatures de départ, à affiner par l'agent développeur :

```ts
type DayKey = string;  // 'AAAA-MM-JJ'
type WeekId = string;  // 'AAAA-Www'
type Cents = number;

countedDays(week: WeekId, installDay: DayKey): DayKey[]
weekEnvelope(week: WeekId, budgets: BudgetVersion[], installDay: DayKey): Cents
monthFixedCosts(month: MonthKey, charges: RecurringCharge[]): Cents
canCloseDay(day: DayKey, now: LocalDateTime, ctx: ClosureContext): CloseCheck
dustLevel(today: DayKey, closures: DayKey[], weeks: WeekResult[], installDay: DayKey): 0 | 1 | 2
weekMonth(week: WeekId): MonthKey  // le mois qui contient son jeudi
nextItem(room: RoomId, year: number, owned: OwnedItem[]): ItemId | null
sealWeek(input: SealInput): WeekResult  // capsule et fêlure, sans hasard
repairs(owned: OwnedItem[], closures: DayKey[]): RepairEvent[]
monthReview(month: MonthKey, budget: BudgetVersion, expenses: Expense[]): MonthReview
process(state: AppState, event: AppEvent, now: LocalDateTime): AppState  // applique l'ordre de traitement
```

### Horloge de test

Les builds de développement ont un réglage caché qui avance l'heure (jour, semaine, mois). Les parcours Maestro s'en servent pour jouer une semaine entière en quelques secondes. Il n'existe pas dans les builds publiés.

### Rendu de la maison

L'écran ne connaît qu'un modèle de scène : pièce, objets avec leur position et leur état, niveau de poussière. Un seul composant le dessine. Changer de style graphique ne doit toucher que ce composant et les visuels : c'est ce qui permettra les habillages des versions ultérieures.

## Direction artistique et visuels

Décidé : la V1 est en style estampe (C), vue de face ; B et D pourront devenir des habillages (skins) dans des versions ultérieures. Voir les [pistes de style](https://claude.ai/artifact/Por3RtmkGBEiBgncX7ntzo).

### Premier lot

1. L'agent artiste produit d'abord la pièce de janvier, le genkan du Nouvel An, en estampe vue de face : le fond et sa vue, les 3 objets de base et les 5 objets à gagner, chacun intact, fêlé et réparé à l'or, avec les deux niveaux de poussière et la capsule.
2. Tu valides ce lot : il fixe le trait, la palette et le grain du papier des onze autres pièces.
3. D'ici là, le développement avance avec des visuels provisoires : le rendu de la maison ne dépend pas du style.

### Fiche des visuels, quel que soit le style

- **Pièce :** un fond par pièce (murs et sol) et une vue (fenêtre ou ciel) accordée au mois de la pièce : neige en janvier, cerisiers en avril, pluie en juin, érables rouges en octobre.
- **Objet :** une image de base et deux calques qui s'y superposent, la fêlure et les veines d'or, avec le même cadre, le même point d'ancrage et le même ordre d'affichage que son emplacement.
- **Formats :** WebP en 1x, 2x et 3x, fond transparent : le style estampe repose sur des textures. Au plus 60 Ko par objet en 3x, et 15 Mo pour tous les visuels de la V1.
- **Poussière :** un voile pour le niveau 1 ; voile, toile d'araignée et assombrissement de 15 % pour le niveau 2.
- **Animations :** tampon qui se pose (0,4 s), apparition d'un objet (0,3 s), fêlure (0,2 s avec vibration), réparation à l'or (1 s). Toutes respectent le réglage « Réduire les animations ».
- **Couleurs des catégories :** les mêmes que le carnet imprimable (Essentiel #2F4B7C, Envies #B4432D, Culture #52733A, Imprévus #97701F), ajustables au style si le contraste reste conforme. Chaque catégorie a aussi une icône et un nom : la couleur ne porte jamais seule l'information.
- **Capsule gashapon :** la machine avec sa tirette, le jeton et sa chute dans la fente (0,4 s, avec le tampon), une capsule aux couleurs de chaque mois et son ouverture (1,5 s) : la tirette tourne, la capsule tombe, s'ouvre en deux, l'objet en sort et rejoint son emplacement.
- **Album :** une vignette par maison passée ; chaque pièce s'y affiche en grand, telle qu'elle était à la fin de l'année.
- **Fiche d'objet :** l'objet en grand sur fond de papier, son nom en français et en japonais (kanji et transcription), son explication et son histoire dans la maison.

### Contenu de la V1

Une pièce par mois, décorée pour sa fête ou sa saison ; ses objets se gagnent dans l'ordre du tableau. Février ne compte 5 semaines qu'en 2052 : il n'a que 4 objets à gagner, soit 59 au total.

| Mois · pièce | Fête ou saison | Objets de base | Objets à gagner, dans l'ordre (le 5e, les mois de 5 semaines) |
| --- | --- | --- | --- |
| Janvier · Genkan, l'entrée | Shōgatsu, le Nouvel An | porte coulissante, meuble à chaussures, porte-parapluies | kadomatsu, shimekazari, kagami-mochi, daruma, raquette hagoita |
| Février · Chanoma, la salle commune | Setsubun, la veille du printemps | kotatsu, coussins zabuton, commode tansu | haricots grillés dans leur boîte, masque d'oni, masque d'Otafuku, branche de prunier en fleur |
| Mars · Washitsu, la salle de tatamis | Hinamatsuri, la fête des filles | tatamis, shōji, table basse | poupées de l'empereur et de l'impératrice, lampes bonbori, gâteaux hishi-mochi, branche de pêcher en fleur, paravent doré |
| Avril · Niwa, le jardin | Hanami, les cerisiers en fleur | gravier ratissé, palissade de bambou, pas japonais | cerisier, lanterne de pierre, brochettes de dango tricolores, coupelles de saké, lanternes de papier |
| Mai · Furoba, la salle de bain | Kodomo no hi, la fête des enfants | baignoire en hinoki, seau et tabouret en bois, panier à vêtements | feuilles d'iris du bain shōbu-yu, casque de samouraï en papier plié, petites carpes koinobori, serviette tenugui, pistolet à eau en bambou |
| Juin · Daidokoro, la cuisine | Tsuyu, la saison des pluies | fourneau kamado, plan de travail, étagère à bols | bocal d'umeshu, teru teru bōzu, hortensias, grenouille porte-bonheur, ombrelle en papier huilé |
| Juillet · Shosai, le bureau | Tanabata, la fête des étoiles | bureau bas, bibliothèque, lampe andon | bambou aux vœux tanzaku, carillon à vent fūrin, nécessaire de calligraphie, volubilis en pot, éventail uchiwa |
| Août · Engawa, la véranda | Obon et les nuits d'été | plancher de la véranda, store en bambou, pierre de seuil | porte-encens kayari-buta, pastèque, cheval et vache d'Obon, lanterne d'Obon, cierges magiques senkō-hanabi |
| Septembre · Chashitsu, le pavillon de thé | Tsukimi, la lune d'automne | alcôve tokonoma, brasero et bouilloire, petite porte nijiriguchi | dango de Tsukimi, eulalie en vase, lapin de la lune, bol à thé, rouleau à la lune |
| Octobre · Irori-no-ma, la salle du foyer | Les récoltes d'automne | foyer irori, crémaillère jizai-kagi, nattes de paille | kakis séchés, panier de châtaignes, bouilloire en fonte, branche d'érable rouge, sac de riz nouveau |
| Novembre · Kura, la réserve | Tori no ichi et Shichi-go-san | étagères, coffre nagamochi, échelle | râteau porte-bonheur kumade, chat porte-bonheur, boulier soroban, sucres d'orge chitose-ame, maillet de la fortune |
| Décembre · Doma, la salle en terre battue | Ōmisoka, le réveillon | jarre à eau, banc de bois, sandales de paille | mortier et maillet à mochi, balai du grand ménage, soba du réveillon, panier de yuzu, boîtes à osechi |

**Explications :** chaque pièce et chaque objet ont la leur, en deux phrases au plus, sur des faits vérifiés. L'agent produit les rédige avec le catalogue ; tu les relis avec chaque lot de visuels. Exemples :

- **Kadomatsu :** « Ces pins et ces bambous, posés de chaque côté de l'entrée, accueillent la divinité de la nouvelle année. On les retire en général après le 7 janvier. »
- **Daruma :** « On lui peint un œil en faisant un vœu, et le second quand il est exaucé. Lesté, il se relève toujours : sept fois à terre, huit fois debout. »
- **Teru teru bōzu :** « Cette petite poupée de tissu blanc, pendue à la fenêtre, demande au ciel le retour du beau temps. Les enfants en fabriquent pendant la saison des pluies. »
- **Kayari-buta :** « Ce cochon en terre cuite abrite un serpentin qui éloigne les moustiques. Sa fumée est l'odeur des soirs d'été au Japon. »
- **Cheval et vache d'Obon :** « Pendant Obon, on accueille les esprits des ancêtres. Le cheval en concombre les ramène vite ; la vache en aubergine les raccompagne lentement. »
- **Lapin de la lune :** « Au Japon, on ne voit pas un visage dans la Lune, mais un lapin qui pile du riz pour en faire des mochi. On le salue à Tsukimi, la fête de la lune d'automne. »
- **Kumade :** « Ce râteau de bambou se vend en novembre aux marchés Tori no ichi : il sert à ratisser la chance. On en rachète un plus grand chaque année. »
- **Boulier soroban :** « Le boulier japonais s'apprend encore à l'école. Les plus habiles calculent de tête en imaginant ses boules. »

L'agent artiste peut proposer d'autres objets, à valider avec le lot correspondant, si chacun a sa place dans la fête du mois et son explication.

## Textes et ton

L'appli tutoie, parle court et ne culpabilise jamais : elle explique toujours, constate, encourage, et rappelle que tout se répare.

- Phrases courtes, ton bienveillant. Ni points d'exclamation en série, ni emoji.
- Montants au format français : « 63 € » avec une espace insécable, virgule décimale.
- Espaces insécables avant ? ! : ; et à l'intérieur des guillemets « ».
- Vocabulaire fixe : noter, clôturer, tampon, enveloppe, fêlé, réparé à l'or, bilan, résolution, capsule, jeton, tirette, album.
- Tous les textes passent par src/i18n/fr.ts : aucun texte en dur dans les écrans.
- Les noms d'objets viennent du catalogue avec leur article et leur genre, pour accorder les phrases : « La lanterne s'est fêlée », « Le daruma est réparé à l'or ».

| Moment | Texte |
| --- | --- |
| Rappel du soir, en alternance | « Ta journée est-elle complète ? » · « Un tampon t'attend ce soir. » · « Deux minutes pour clôturer ta journée ? » |
| Accueil, reste | « Il te reste 63 € jusqu'à dimanche » |
| Accueil, dépassement | « Tu as dépassé de 12 € cette semaine » |
| Clôture | « J'ai tout noté » · « Rien dépensé aujourd'hui » |
| Bilan, tous les tampons, dans le budget | « Tous tes tampons, et dans ton enveloppe : tes jetons sont prêts, tire la tirette. » |
| Ouverture de la capsule | « Un daruma entre dans ta maison. » |
| Bilan, tous les tampons, hors budget | « Tu as tout noté, c'est l'essentiel : tes jetons sont prêts, tire la tirette. La lanterne s'est fêlée ; 7 jours de clôture d'affilée, et elle sera réparée à l'or. » |
| Bilan, tampons manquants, dans le budget | « Il manque des tampons cette semaine, alors pas de capsule. Un peu de poussière s'est posée ; une semaine complète, et elle s'envole. » |
| Bilan, tampons manquants, hors budget | « Pas de capsule cette semaine, et la lanterne s'est fêlée. Rien n'est perdu : 7 jours de clôture d'affilée, et elle sera réparée à l'or. » |
| Poussière, jours sans clôture | « La maison prend la poussière. Une clôture suffit à l'aérer. » |
| Poussière, après une semaine incomplète | « Un voile de poussière reste jusqu'à ta prochaine semaine complète. » |
| Réparation | « Réparée à l'or, la lanterne garde la trace de cette semaine-là. » |
| Objet en attente | « Ton objet attend la pièce de décembre : elle s'ouvrira avec le bilan de novembre. » |
| Nouvelle pièce | « La pièce de mars s'ouvre : c'est le mois de Hinamatsuri, la fête des filles. » |
| Nouvelle année | « Une nouvelle année commence. Ta maison de 2026 rejoint l'album, telle que tu l'as faite. » |
| Fin de l'essai | « Ton mois d'essai se termine. Choisis ta formule : l'abonnement, ou l'appli gratuite avec de la publicité. Tes données restent là dans les deux cas. » |

### Messages d'explication

Chaque carte s'affiche une seule fois, au moment indiqué, puis reste dans Comprendre (E12). Deux phrases au plus.

| Quand | Texte |
| --- | --- |
| Bienvenue, la méthode | « Le kakeibo, le “livre de comptes du foyer”, est né au Japon en 1904 : Motoko Hani, première femme journaliste du pays, l'a imaginé pour tenir ses comptes à la main. On n'y cherche pas à tout contrôler, mais à prendre conscience de ce qu'on dépense. » |
| Bienvenue, les catégories | « Chaque dépense va dans l'une des quatre catégories : Essentiel, Envies, Culture, Imprévus. Semaine après semaine, tu verras où va ton argent. » |
| Bienvenue, mon mois | « Ton budget, c'est ce qui reste une fois payées tes charges fixes et mise de côté ton épargne. Il se partage en enveloppes, une par semaine. » |
| Première dépense | « Noter soi-même chaque dépense, c'est le cœur du kakeibo : ce petit geste suffit pour y penser à deux fois. » |
| Premier tampon | « Chaque soir, tu clôtures ta journée : tu confirmes avoir tout noté, un tampon se pose et un jeton tombe dans la machine. Au Japon, les enfants font tamponner une carte chaque matin des vacances d'été, à la gymnastique de la radio (rajio taisō). » |
| Première capsule | « Avec tous tes jetons de la semaine, tu tires la tirette, comme dans les gashapon, ces distributeurs de petits jouets qu'on trouve partout au Japon. Ici, pas de hasard : chaque semaine complète apporte l'objet suivant de la pièce du mois. » |
| Premier jour à rattraper | « Tu as oublié de clôturer un soir ? Tu peux rattraper ce jour jusqu'au lundi midi qui suit sa semaine. » |
| Première poussière | « Quand des jours restent sans tampon, la poussière se pose. Elle n'abîme jamais rien et s'envole avec une semaine complète. » |
| Première fêlure | « Au Japon, on répare les bols cassés avec une laque saupoudrée d'or : c'est le kintsugi, l'art de montrer ses réparations plutôt que de les cacher. Ici, 7 jours de clôture d'affilée réparent l'objet à l'or, et il ne se fêlera plus. » |
| Première réparation | « Le voilà réparé à l'or, plus précieux qu'avant : il garde la trace de cette semaine-là. » |
| Premier bilan du mois | « Chaque fin de mois, le kakeibo pose quatre questions : combien avais-je, combien voulais-je mettre de côté, combien ai-je dépensé, et comment faire mieux ? La quatrième devient ta résolution du mois. » |
| Nouvelle pièce | « Chaque mois ouvre une pièce de la maison, décorée pour sa fête ou sa saison. Ses objets se gagnent semaine après semaine. » Puis l'explication de la pièce, tirée du catalogue. |
| Nouvelle année | « Au Japon, on fait le grand ménage de fin d'année (ōsōji) pour accueillir l'an neuf dans une maison propre. Ta maison repart de zéro ; celle de l'an passé rejoint l'album, telle que tu l'as faite. » |
| Fiche d'objet | L'explication du catalogue (voir les exemples de Direction artistique), puis son histoire : « Gagné la semaine du 2 novembre. Fêlé le 15, réparé à l'or le 22. » |

## Notifications, confidentialité, accessibilité, performance

Une notification par jour au plus, aucune donnée hors du téléphone, et une appli utilisable par tous.

### Notifications

- Une notification locale par jour, à l'heure choisie, seulement si la journée n'est pas encore clôturée. Elle est annulée dès la clôture et ouvre directement E4.
- Aucune autre notification en V1. Si l'autorisation est refusée, l'appli fonctionne normalement et les réglages expliquent comment l'activer.

### Confidentialité

- Aucune donnée personnelle ne quitte le téléphone. Seule exception possible : la régie publicitaire de la version gratuite, si la publicité est retenue (voir Monétisation).
- Aucun SDK tiers qui collecte des données : ni analytique, ni outil de rapport de plantage, ni régie publicitaire tant que la publicité n'est pas tranchée. Les plantages se suivent dans App Store Connect et la Play Console.
- Fiches des stores : « Données non collectées » chez Apple, déclaration équivalente chez Google, manifeste de confidentialité iOS complété. Avec la publicité, ces déclarations listent ce que la régie collecte.
- Une page de politique de confidentialité, statique et en français, exigée par les stores.

### Accessibilité

- Libellés VoiceOver et TalkBack sur tous les contrôles. Chaque case de tampon est annoncée (« mercredi, clôturé ») et la maison a une description textuelle de ses objets et de leur état.
- Texte agrandi jusqu'à 200 % sans perte d'information, contraste conforme au niveau AA, zones tactiles de 44 points au moins.

### Performance et fiabilité

- Ouverture à froid en moins de 2 secondes sur un Android de milieu de gamme, animations fluides.
- Requêtes en moins de 50 ms avec un an de données (environ 3 000 dépenses).
- Toute écriture en base est transactionnelle ; au moins 99,5 % de sessions sans plantage.

### Mentions

L'écran À propos précise que l'appli est un outil de suivi personnel et ne donne pas de conseil financier.

## Monétisation

Par défaut, et à valider : un mois d'essai complet, puis le choix entre l'abonnement, sans publicité, et la version gratuite, avec publicité. La méthode reste entière dans les deux cas : on ne paie jamais pour noter, clôturer ou gagner des objets.

| Formule | Prix TTC | Contenu |
| --- | --- | --- |
| Essai | gratuit, un mois | Toute l'appli, sans publicité. À la fin, l'écran d'achat (E11) présente les formules. |
| Gratuit | 0 € | Toute la méthode, la maison et le carnet, avec une bannière publicitaire (règles ci-dessous). |
| Abonnement | 2,99 € par mois ou 19,99 € par an | Sans publicité, avec les habillages et les maisons à venir. |
| Achat définitif | 39,99 €, en option, à voir plus tard | L'abonnement pour toujours, en un seul paiement. |

- **Publicité, à trancher :** une seule bannière, en bas de l'accueil et du carnet. Jamais pendant la saisie, la clôture, les bilans ni les explications ; ni plein écran, ni vidéo, ni récompense contre une publicité. Publicités non personnalisées par défaut, consentement demandé avant la première, catégories crédit, jeux d'argent et cryptomonnaies bloquées.
- **Ce que la publicité coûte :** elle contredit le principe « Privé par construction ». La régie reçoit des identifiants et des données d'usage, et les fiches des stores ne pourront plus afficher « Données non collectées ». Sans publicité, l'alternative est le modèle d'avant : après l'essai, il faut l'abonnement pour continuer à noter et à clôturer, la maison et le carnet restant consultables.
- **Abonnement :** géré par l'App Store et Google Play, vérifié sur l'appareil, sans serveur. Prix, durée et renouvellement automatique s'affichent avant l'achat ; « Gérer mon abonnement » ouvre la page du store, et l'on peut toujours restaurer ses achats depuis les réglages.
- **Plus tard :** d'autres maisons (machiya de Kyoto, ferme de montagne, maison de thé) et les habillages B et D, compris dans l'abonnement ; leurs objets se gagnent toujours par la régularité.

| Repère | Valeur |
| --- | --- |
| Reste par abonnement mensuel | environ 2,12 € par mois, après TVA de 20 % et commission de 15 % |
| Reste par abonnement annuel | environ 14,16 € par an, soit 1,18 € par mois |
| Reste par achat définitif | environ 28,33 €, une fois |
| Objectif de 500 € par mois | environ 236 abonnés mensuels, ou 424 abonnés annuels |
| Publicité | revenu très variable selon le pays et l'audience : à mesurer pendant la bêta, aucun chiffre promis ici |
| Seuil d'arrêt | moins de 100 € par mois au deuxième mois après la sortie : on arrête ou on change d'angle |

## Organisation des agents

Cinq agents se partagent le travail ; tu interviens à trois moments seulement, et tout le reste avance sans toi.

### Rôles

| Agent | Fait | Ne fait jamais |
| --- | --- | --- |
| Produit | Tient ce document à jour, découpe les jalons en tickets, rédige les textes et les explications du catalogue, vérifie la cohérence des livraisons | Changer une règle validée sans ton accord |
| Développeur | Implémente les tickets, avec leurs tests | Ajouter une dépendance payante ou un service en ligne |
| Testeur | Écrit les tests du domaine à partir des scénarios avant le code, puis les parcours Maestro | Modifier un résultat attendu pour faire passer un test |
| Artiste | Produit les visuels selon la fiche | Livrer un lot sans ta validation |
| Publication | Prépare les builds, les fiches des stores et les captures | Publier sans ton feu vert |

### Tes trois points de contrôle

1. Chaque lot de visuels, à commencer par la pièce de janvier, avec les explications du catalogue.
2. Le feu vert de chaque version, en bêta comme en production.
3. Toute dépense (compte, abonnement, publicité) et tout texte légal (confidentialité, fiches des stores).

### Règles de travail

- Ce document est la source de vérité. Pour changer une règle, on met d'abord à jour ce document et les scénarios, ensuite le code.
- Un ticket = un objectif vérifiable, faisable en moins d'une journée, qui cite les sections concernées.
- Le domaine se développe en écrivant les tests d'abord.
- Une branche par ticket et une demande de fusion relue par l'agent produit ; fusion seulement si l'intégration continue est verte.

### Définition de « terminé »

- [ ] Vérification des types, lint et tests au vert
- [ ] Les 25 scénarios des règles passent
- [ ] Captures des écrans modifiés jointes : émulateur Android dans l'intégration continue, iPhone pendant la bêta
- [ ] Textes dans src/i18n/fr.ts, libellés d'accessibilité présents
- [ ] Toute nouvelle mécanique a son explication de première fois et sa fiche dans Comprendre
- [ ] Entrée ajoutée au journal des modifications

### Quand s'arrêter et demander

- Le document est ambigu ou contradictoire sur une règle, une donnée ou un texte visible.
- Une action coûte de l'argent ou crée un compte.
- Un store refuse l'appli.
- Une exigence paraît techniquement impossible.
- Un choix touche à la vie privée.

## Jalons

Dix jalons mènent à la sortie ; la maison et les bilans avancent en parallèle une fois les règles terminées, et les visuels définitifs commencent par la pièce de janvier, en style estampe.

| Jalon | Contenu | Validé quand | Après |
| --- | --- | --- | --- |
| J0 · Socle | Projet Expo, TypeScript strict, intégration continue, SQLite et migrations, fichier de textes, thème neutre, horloge de test | L'appli démarre sur iPhone et Android, intégration continue verte | — |
| J1 · Règles | Tout src/domain | Les 25 scénarios passent, sans dépendance à l'interface | J0 |
| J2 · Saisie et clôture | E2 sans maison, E3, E4, E5, rappel du soir | Parcours « journée type » et « rattrapage » au vert | J1 |
| J3 · Bilans | E6, E7, scellement, file de réparation | Parcours « semaine parfaite » et « semaine hors budget » au vert avec l'horloge de test | J2 |
| J4 · Maison | Rendu de la scène, catalogue, états, poussière, capsule, album, E8, visuels provisoires | Captures des 3 états d'objet et des 3 niveaux de poussière | J1 |
| J5 · Bienvenue et réglages | E1, E9, E10, E12, explications de première fois, dépenses récurrentes et leur calendrier | Parcours « installation » au vert ; chaque explication de première fois ne s'affiche qu'une fois | J2 |
| J6 · Visuels définitifs | 12 pièces, 36 objets de base et 59 objets à gagner en style estampe, avec leurs explications | Ta validation du lot | Premier lot validé |
| J7 · Achat | Essai d'un mois, abonnement, version gratuite, restauration des achats, E11 ; publicité si elle est retenue | Abonnements de test réussis sur iPhone et Android : souscription, renouvellement, résiliation, restauration | J5 |
| J8 · Bêta | TestFlight et test interne Google Play, 10 à 20 testeurs pendant 2 semaines | Objectif indicatif : 60 % des jours clôturés chez les testeurs actifs, moins de 0,5 % de sessions plantées | J3 à J7 |
| J9 · Sortie | Fiches des stores (titre, sous-titre et mots-clés : voir Nom de l'appli), politique de confidentialité, captures | Ton feu vert | J8 |

## Décisions ouvertes

Une décision t'attend (la publicité) ; pour les autres, les agents appliquent la valeur par défaut tant que tu ne l'as pas changée. Passe le statut à « Validé » quand tu tranches.

| Décision | Valeur par défaut | Statut | Avant |
| --- | --- | --- | --- |
| Style graphique : B ou C ou D | Développer le C en premier ; les autres pourront être des habillages (skins) dans des versions ultérieures | Validé | J6 |
| Vue de la maison : de face ou isométrique | face | Validé | J6 |
| Nom de l'appli | Kakeibo, budget à la japonaise (voir Nom de l'appli, ci-dessous) | Validé | J9 |
| Publicité dans la version gratuite | Une bannière hors saisie, clôture et bilans, non personnalisée par défaut ; elle fait renoncer au label « Données non collectées » | À trancher | J7 |
| Modèle de revenus et prix | Un mois d'essai, puis abonnement (2,99 €/mois ou 19,99 €/an) ou version gratuite avec publicité ; achat définitif en option (à voir plus tard) | Par défaut, à valider | J7 |
| Mois de 5 semaines | 5 emplacements par pièce, le 5e les années où le mois compte 5 semaines : 59 objets à dessiner (février n'a 5 semaines qu'en 2052), 52 ou 53 à gagner chaque année | Par défaut, à valider | J1 |
| Objet qui se fêle | L'objet intact obtenu le plus récemment, hors objet gagné au même bilan | Par défaut, à valider | J1 |
| Poussière après une semaine incomplète | Au moins le voile (niveau 1) jusqu'à la prochaine semaine complète ; la toile d'araignée reste pour 4 jours sans clôture | Par défaut, à valider | J1 |
| Nouvelle année | La maison repart de zéro le lundi de la semaine 1 ; celle de l'année écoulée rejoint l'album telle quelle, objets encore fêlés compris | Validé | J1 |
| Dépenses récurrentes | Des charges fixes datées : calendrier dans le carnet, hors enveloppe et hors dépensé | Par défaut, à valider | J1 |
| Objet au choix parmi 3 | Non, format gashapon | Validé | J3 |
| Un objet réparé peut se fêler à nouveau | Non | Validé | J1 |
| Délai de grâce jusqu'au lundi 12:00 | Oui | Validé | J1 |
| Une pièce débloquée à chaque bilan du mois | Oui | Validé | J3 |
| Contenu au lancement | 12 pièces, 52 objets à débloquer (52 semaines) + 36 objets de base | Validé | J6 |
| Heure du rappel par défaut | 21:00 | Validé | J2 |
| Saisie manuelle, sans lien bancaire | — | Validé | — |
| Clôture, tampons, poussière, fêlure et réparation | — | Validé | — |
| Tous les tampons pour l'objet de la semaine | — | Validé | — |
| Objets rares tirés au hasard | Non en V1, à revoir après la bêta selon la régularité des testeurs | Validé | J3 |

### Nom de l'appli

**Retenu : « Kakeibo, budget à la japonaise ».** Pile 30 caractères, la limite des deux stores ; la virgule évite l'espace qu'exigerait « : ».

- **Sous-titre App Store :** « Suivi des dépenses et épargne ».
- **Mots-clés App Store** (champ caché de 100 caractères, sans répéter les mots du titre et du sous-titre) : méthode, gestion, comptes, économies, argent, carnet, japon, finances, tirelire.
- **Description courte Google Play :** « La méthode japonaise pour gérer ton budget : note, clôture, meuble ta maison. »
- **Marque :** le nom de la méthode ne se protège pas ; l'icône et les captures de la maison font la différence. Le nom se réserve dans App Store Connect dès l'ouverture du compte développeur.

L'étude qui a conduit à ce choix :

Le volume exact des recherches n'est donné que par des outils payants (AppTweak, Sensor Tower) ou par Apple Search Ads. Les fiches des stores français montrent déjà l'essentiel :

- **Les mots que tout le secteur vise :** budget, dépenses, comptes, gestion, finances, suivi. On les retrouve dans presque tous les titres : [Bankin' - Gérer son budget](https://apps.apple.com/fr/app/bankin-g%C3%A9rer-son-budget/id447040033), [Comptes et Budget](https://apps.apple.com/fr/app/comptes-et-budget/id1152896788), [Get Bill : Budget & Dépenses](https://apps.apple.com/us/app/get-bill-budget-d%C3%A9penses/id6503958354?l=fr-FR), [Linxo Lab - Budget & Finances](https://apps.apple.com/fr/app/linxo-lab-budget-finances/id6478117034). Ce sont les recherches les plus fréquentes, et les plus disputées.
- **« Kakeibo » est un mot de niche :** la presse française relaie la méthode ([Presse-citron](https://www.presse-citron.net/elle-marche-depuis-100-ans-quest-ce-que-le-kakeibo-la-methode-japonaise-pour-mieux-gerer-vos-finances/), [Consoglobe](https://www.consoglobe.com/economiser-de-l-argent-cg)), mais une appli dont l'identifiant technique contient « kakebo » s'affiche sur Google Play sous le titre [Gestion Budget Suivi Dépenses](https://play.google.com/store/apps/details?id=com.rellowteam.kakebo2&hl=en_US). Moins de recherches, mais moins de concurrence et un public déjà convaincu.
- **Les noms japonais évidents sont pris :** [Kakei](https://apps.apple.com/ca/app/kakei/id6758553883), [Kakebo](https://mwm.ai/ja/apps/kakebo-budget-ai/6479921558), [Okane](https://play.google.com/store/apps/details?id=com.budgeting.okane&hl=en_IE), [Chokin Memo](https://apps.apple.com/ph/app/chokin-memo-savings-goals/id6793607900) et plusieurs « Kakeibo » existent déjà.

**Ce que recommandait l'étude :** un nom court qui nous appartienne, suivi des mots-clés dans le titre (30 caractères au plus sur les deux stores) : « *Nom* : budget kakeibo », avec un sous-titre comme « Suivi des dépenses et épargne ».

| Piste | Pour | Contre |
| --- | --- | --- |
| Maison Kakeibo | Dit le concept en français, la maison et la méthode, et contient le mot-clé ; aucune appli trouvée sous ce nom | « Kakeibo » est un mot courant, difficile à protéger seul comme marque |
| Hibi | En japonais, « hibi » veut dire à la fois les jours (日々) et les fêlures (罅) : les deux mécaniques de l'appli | Déjà porté par plusieurs applis d'habitudes, de journal et d'apprentissage du japonais |
| Hanko | Le sceau personnel qu'on appose au Japon pour valider un document, comme le tampon du soir | Déjà utilisé par Hanko GmbH, un éditeur allemand de logiciels d'authentification |

Avant la sortie : vérifier auprès de l'INPI et de l'EUIPO qu'aucune marque déposée ne bloque « Kakeibo » pour une appli, puis le volume des mots-clés avec un outil ASO.

## Références

- [Pistes de style](https://claude.ai/artifact/Por3RtmkGBEiBgncX7ntzo) : l'écran d'accueil dans les quatre styles.
- [Petites applis et jeux simples inspirés d'Asie](https://claude.ai/artifact/1c4XvezyoDtAsbjntqGjW3) : pourquoi le kakeibo, marché et chiffres.
- [Applis asiatiques à importer en Europe](https://claude.ai/artifact/WxZEVWx2GWc4uF66NtBoNe) : l'étude de départ.
- Le carnet kakeibo 2027 à imprimer : même méthode, mêmes catégories et mêmes couleurs que l'appli.
