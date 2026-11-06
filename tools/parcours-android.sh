#!/usr/bin/env bash
# Parcours Maestro sur l'émulateur Android (#52), lancé par android.yml.
# Attend que l'émulateur soit prêt, installe l'APK, joue les parcours de e2e/,
# puis joint toujours une capture, la hiérarchie de l'écran et le logcat,
# même si un parcours échoue. Le code de sortie reste celui de Maestro.
set -u

APK="${APK:?chemin du fichier APK manquant}"
mkdir -p captures

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
