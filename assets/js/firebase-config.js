/* =========================================================
   FIREBASE CONNECTION
   ---------------------------------------------------------
   Leave as null → the site runs in "local" mode (no backend).
   To connect: Firebase console → Project settings → Your apps →
   Web app → copy the config object and paste it below.
   These values are public by design; security comes from
   firestore.rules and storage.rules.
   ========================================================= */
window.ZEN_FIREBASE_CONFIG = null;

/* Example:
window.ZEN_FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "zenitude-concierge.firebaseapp.com",
  projectId: "zenitude-concierge",
  storageBucket: "zenitude-concierge.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
*/
