# Firebase Setup — Connect the User App to the Admin Dashboard

Follow these steps once. Total time: about 10 minutes. It is free.

> **You do not need Firebase to test.** Open `index.html` and `admin.html` right now and
> everything works in LOCAL DEMO MODE using your browser's storage. The only difference is
> that data lives in one browser instead of being shared across devices.
> A yellow "DEMO MODE" badge appears until you finish these steps.

---

## STEP 1 — Create the Firebase project

1. Go to **https://console.firebase.google.com**
2. Sign in with your Google account.
3. Click **Create a project** (or **Add project**).
4. Project name: `task-wallet` (any name works). Click **Continue**.
5. Google Analytics: toggle it **OFF** — you don't need it. Click **Create project**.
6. Wait for the spinner, then click **Continue**.

---

## STEP 2 — Create the Firestore database

1. In the left sidebar click **Build → Firestore Database**.
2. Click **Create database**.
3. Location: choose **asia-south1 (Mumbai)** — closest to Bangladesh, fastest for your users.
4. Choose **Start in production mode**. Click **Create**.

   *(Don't worry about it being locked down — Step 4 installs the correct rules.)*

---

## STEP 3 — Register a Web App and COPY YOUR KEYS ⭐

This is the part that gives you the credentials.

1. Click the **⚙️ gear icon** at the top-left, next to "Project Overview".
2. Choose **Project settings**.
3. Scroll down to the **Your apps** section.
4. Click the **web icon** — it looks like `</>`.
5. App nickname: `task-wallet-web`. Leave "Firebase Hosting" unchecked. Click **Register app**.
6. Firebase now shows you a code block. It looks exactly like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSyB1x2y3z4EXAMPLEKEY_abcdefg",
  authDomain: "task-wallet-1a2b3.firebaseapp.com",
  projectId: "task-wallet-1a2b3",
  storageBucket: "task-wallet-1a2b3.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};
```

7. **Copy the six values.** Keep this browser tab open.

### Now paste them into the project

Open the file **`firebase-config.js`** in this repo. It is the **only** file you edit.
Replace each `PASTE_...` with your real value:

```js
window.FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB1x2y3z4EXAMPLEKEY_abcdefg",
  authDomain:        "task-wallet-1a2b3.firebaseapp.com",
  projectId:         "task-wallet-1a2b3",
  storageBucket:     "task-wallet-1a2b3.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId:             "1:123456789012:web:abc123def456"
};
```

Save the file. **That is the entire connection.** Both `index.html` and `admin.html` read
this same file, which is exactly how the user app and the admin dashboard become linked —
they are now two windows onto the same database.

> Is it safe that these keys are visible in the page? Yes. Firebase web keys are public
> by design — they only identify your project. Your data is protected by the rules in
> Step 4, not by hiding the key.

---

## STEP 4 — Install the security rules

1. In the Firebase console go to **Build → Firestore Database → Rules** tab.
2. Delete everything in the editor.
3. Open **`firestore.rules`** from this repo, copy the whole file, paste it in.
4. Click **Publish**.

These rules make it impossible for a user to edit their own balance or approve their own
deposit from the browser — the two things that would otherwise let someone steal from you.

---

## STEP 5 — Set your admin password

Still in `firebase-config.js`, at the bottom:

```js
window.ADMIN_BOOTSTRAP = {
  username: "admin",
  password: "admin123"     // ← CHANGE THIS before going live
};
```

Pick a strong password. The first time `admin.html` loads, this account is created in
Firestore with the password **hashed** (SHA-256 + salt), then you log in with it.

To change it later: use **Settings → Change Admin Password** inside the dashboard.

---

## STEP 6 — Test that it worked

1. Open **`admin.html`**. The yellow "DEMO MODE" badge should now be **green: "LIVE"**.
2. Log in with your admin username and password.
3. Open **`index.html`** in another tab, register a user with any 11-digit number.
4. Back in the admin tab → **Users** — your new user appears **instantly**, no refresh.
5. In the user tab, submit a deposit (amount → popup → paste any TrxID → confirm).
6. In the admin tab → **Deposits** — the pending request appears. Click **Approve**.
7. Back in the user tab, the balance goes up and the row turns **APPROVED**.

If all seven work, you are fully connected.

---

## Turning on admin writes when hosted

The rules ship with `ADMIN_MODE()` returning `false`, which blocks *all* approvals from any
browser. Choose one:

**Option A — recommended, free and safe.**
Deploy only `index.html` publicly. Keep `admin.html`, `js/admin.js`, `js/db.js` and
`firebase-config.js` on your own computer and open `admin.html` locally when you need to
approve things. Then edit the rules so `ADMIN_MODE()` returns `true` — nobody else has the
admin page, and even if they did, they'd need your password.

**Option B — quick but weaker.**
Host everything, set `ADMIN_MODE()` to `true`. Approvals work from anywhere. The risk is
that a technically skilled visitor could write to Firestore directly with your public key.
Fine for a soft launch, not for real money at scale.

**Option C — the proper long-term fix.**
Move `approveDeposit` / `rejectDeposit` / `adjustBalance` into Cloud Functions using the
Firebase Admin SDK, and keep `ADMIN_MODE()` false forever. Requires the Blaze plan (still
free under the monthly quota). Tell me when you want this and I'll write the functions.

---

## Common problems

| What you see | Fix |
|---|---|
| Badge still says DEMO MODE | A `PASTE_` value is still in `firebase-config.js`, or the file didn't save. Hard-refresh with Ctrl+Shift+R. |
| `Missing or insufficient permissions` | Step 4 wasn't published, or you're trying to approve while `ADMIN_MODE()` is `false`. |
| Console: `Failed to get document because the client is offline` | Wrong `projectId`, or Firestore was never created in Step 2. |
| Users register but admin sees nothing | The two files are pointing at different projects — make sure both pages load the *same* `firebase-config.js`. |
| Opened with `file://` and imports fail | Firebase's module CDN needs `http`. Run `python3 -m http.server 8080` in the project folder and open `http://localhost:8080`. |

---

## Free tier limits

Spark (free) gives you 50,000 document reads, 20,000 writes and 1 GiB storage **per day**.
For a few thousand users doing a handful of deposits each, you will not come close.
