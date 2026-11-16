// Plugin de configuration Expo : désactive GWP-ASan (android:gwpAsanMode="never") pour l'appli.
// Sur Android 14, l'échantillonneur de GWP-ASan remonte la pile par ses pointeurs de cadre ; sur
// la pile propre à Hermes (hoost_make_fcontext), cette remontée lit hors de la pile et l'appli
// meurt (SIGSEGV) au hasard, juste après le lancement (#101). Aucune donnée ne sort du téléphone.
const { withAndroidManifest } = require('expo/config-plugins');

function sansGwpAsan(config) {
  return withAndroidManifest(config, (c) => {
    const application = c.modResults.manifest.application?.[0];
    if (application) application.$['android:gwpAsanMode'] = 'never';
    return c;
  });
}

module.exports = sansGwpAsan;
