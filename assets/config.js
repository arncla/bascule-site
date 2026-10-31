// Configuration publique du site. Rien de secret ici : une configuration Firebase web est faite pour être servie au
// navigateur, la sécurité repose sur les règles Firestore (iOS/firebase/firestore.rules).
//
// FIREBASE : app Web « Bascule Web » du projet bascule-4ef20 (console Firebase, Paramètres du projet, Vos applications).
// Domaine autorisé dans Authentication : basculeapp.com.
export const FIREBASE = {
  apiKey: "AIzaSyBz8UUv0vT_a7dQgVroJ4qOrXKLP7YKfcg",
  authDomain: "bascule-4ef20.firebaseapp.com",
  projectId: "bascule-4ef20",
  storageBucket: "bascule-4ef20.firebasestorage.app",
  messagingSenderId: "764011449387",
  appId: "1:764011449387:web:e6e04a75c393277a112e6e",
};

// Adresse partagée dans le texte de partage, la même que Links.site dans l'app.
export const SITE_URL = "https://basculeapp.com/";
