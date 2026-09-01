/* ============================================================================
   FIREBASE CREDENTIALS — THIS IS THE ONLY FILE YOU NEED TO EDIT.

   Read FIREBASE_SETUP.md for click-by-click instructions.

   Replace the six PASTE_... values below with the ones from:
     Firebase Console -> Project settings (gear icon) -> scroll to "Your apps"
     -> Web app -> Config

   Until you do, the app automatically runs in LOCAL DEMO MODE (localStorage),
   so you can test the whole deposit-approval flow right now without an account.
   ========================================================================== */

window.FIREBASE_CONFIG = {
  apiKey:            "PASTE_YOUR_API_KEY",
  authDomain:        "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId:         "PASTE_YOUR_PROJECT_ID",
  storageBucket:     "PASTE_YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId:             "PASTE_YOUR_APP_ID"
};

/* Login for the admin dashboard (admin.html).
   Change these before you go live. The password is hashed on first run and the
   admin account is created in Firestore automatically.                        */
window.ADMIN_BOOTSTRAP = {
  username: "admin",
  password: "admin123"
};
