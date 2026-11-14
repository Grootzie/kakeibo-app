#!/usr/bin/env bash
# Parcours Maestro sur l'émulateur Android (#52), lancé par android.yml.
# Attend que l'émulateur soit prêt, installe l'APK, joue les parcours de e2e/,
# puis joint toujours une capture, la hiérarchie de l'écran et le logcat,
# même si un parcours échoue. Le code de sortie reste celui de Maestro.
set -u

APK="${APK:?chemin du fichier APK manquant}"
mkdir -p captures
# Sans Maestro, aucun parcours ne serait joué : on s'arrête tout de suite, clairement (#49).
command -v maestro >/dev/null 2>&1 || { echo "Maestro est introuvable : aucun parcours joué." >&2; exit 1; }

# L'émulateur dit avoir démarré bien avant que le lanceur réponde : on attend le lanceur (2 min au plus).
for _ in $(seq 1 60); do
  if adb shell dumpsys window 2>/dev/null | grep -E 'mCurrentFocus' | grep -qi 'launcher'; then
    echo "Lanceur prêt."
    break
  fi
  sleep 2
done
# Ferme une éventuelle boîte « L'appli ne répond pas » du système.
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true

adb install "$APK" || exit 1
adb logcat -c || true

statut=0
if ls e2e/*.yaml >/dev/null 2>&1; then
  maestro test e2e --format junit --output captures/maestro.xml || statut=$?
else
  echo "Aucun parcours dans e2e/"
fi

# Preuves, en cas de succès comme d'échec.
adb exec-out screencap -p > captures/ecran.png || true
adb exec-out uiautomator dump /dev/tty > captures/hierarchie.xml 2>/dev/null || true
adb logcat -d > captures/logcat.txt 2>&1 || true
# Parcours qui ont besoin d'une heure précise (#46) : l'APK publié n'a pas l'horloge de test,
# alors on règle l'heure du téléphone (adb root), puis on la rend à la fin.
if [ -f e2e/heure/installer.yaml ]; then
  adb root >/dev/null 2>&1 || true
  sleep 5
  adb shell settings put global auto_time 0 || true
  adb shell pm clear app.kakeibo >/dev/null 2>&1 || true
  # Installation le mercredi 4 novembre 2026 à 9 h, puis jeudi 5 à 20 h : mercredi est à rattraper.
  adb shell date 110409002026.00 || true
  maestro test e2e/heure/installer.yaml --format junit --output captures/maestro-heure-1.xml || statut=1
  adb shell date 110520002026.00 || true
  maestro test e2e/heure/rattraper-jour.yaml --format junit --output captures/maestro-heure-2.xml || statut=1
  # Rappel du soir (#47) : installation le jeudi 5 novembre 2026 à 20:58, notifications accordées
  # (en attendant E1), appli en arrière-plan ; le rappel de 21:00 arrive, le toucher ouvre E4.
  if [ -f e2e/heure/rappel-toucher.yaml ]; then
    adb shell pm clear app.kakeibo >/dev/null 2>&1 || true
    adb shell pm grant app.kakeibo android.permission.POST_NOTIFICATIONS || true
    adb shell date 110520582026.00 || true
    maestro test e2e/heure/rappel-installer.yaml --format junit --output captures/maestro-heure-3.xml || statut=1
    # Le rappel est une alarme du téléphone, à peu près exacte : 5 minutes au plus.
    for _ in $(seq 1 100); do
      if adb shell dumpsys notification --noredact 2>/dev/null | grep -q 'pkg=app.kakeibo'; then
        echo "Rappel affiché."
        break
      fi
      sleep 3
    done
    adb shell dumpsys notification --noredact > captures/notifications.txt 2>&1 || true
    adb shell cmd statusbar expand-notifications || true
    sleep 2
    maestro test e2e/heure/rappel-toucher.yaml --format junit --output captures/maestro-heure-4.xml || statut=1
  fi
  # Parcours « journée type », « rattrapage » (#49), « bilans prêts » (#61), « bilan du mois » (#64),
  # « récapitulatif » (#63), « bilan de la semaine » (#62), « semaine parfaite » et « semaine hors
  # budget » (critère de J3, #67) : appli effacée, mercredi 4 novembre 2026 à 9:00 ; l'horloge de
  # test de l'APK de développement avance ensuite les jours.
  for parcours in journee-type rattrapage bilans-prets bilan-mois recapitulatif bilan-semaine \
    semaine-parfaite semaine-hors-budget; do
    if [ -f "e2e/heure/$parcours.yaml" ]; then
      adb shell pm clear app.kakeibo >/dev/null 2>&1 || true
      adb shell date 110409002026.00 || true
      maestro test "e2e/heure/$parcours.yaml" --format junit --output "captures/maestro-$parcours.xml" || statut=1
    fi
  done
  adb shell date "$(date -u +%m%d%H%M%Y.%S)" || true
  adb shell settings put global auto_time 1 || true
fi

# Accueil avec le texte agrandi à 200 % (#43) : capture et hiérarchie, puis retour à 100 %.
adb shell settings put system font_scale 2.0 || true
adb shell am force-stop app.kakeibo || true
adb shell monkey -p app.kakeibo -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
sleep 20
adb exec-out screencap -p > captures/ecran-texte-200.png || true
adb exec-out uiautomator dump /dev/tty > captures/hierarchie-texte-200.xml 2>/dev/null || true
adb shell settings put system font_scale 1.0 || true
if [ -d "$HOME/.maestro/tests" ]; then cp -r "$HOME/.maestro/tests" captures/maestro-debug || true; fi

exit "$statut"
