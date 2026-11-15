// Préparation des tests de composants : Skia n'a pas de moteur graphique sous Jest ; la maison y
// est dessinée par un Skia factice qui garde ce qu'on lui demande de dessiner.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- fabrique de jest.mock
jest.mock('@shopify/react-native-skia', () => require('./src/ui/maison/skiaFactice'));
