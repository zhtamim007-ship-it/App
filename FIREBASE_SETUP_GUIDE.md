# Google Firebase Setup & Connection Guide

This guide explains step-by-step how to create a free Google Firebase project and connect it to your **Task Wallet** User App (`index.html`) and **Admin Dashboard** (`admin.html`).

---

## Step 1: Create a Google Firebase Project

1. Open your browser and go to the [Firebase Console](https://console.firebase.google.com/).
2. Sign in with your Google account.
3. Click on **"+ Add project"** (or "Create a project").
4. Enter a project name (e.g., `task-wallet-app`).
5. (Optional) Disable Google Analytics or leave it enabled, then click **"Create project"**.
6. Wait a few seconds until the project is ready, then click **"Continue"**.

---

## Step 2: Register a Web App in Firebase

1. On the Firebase Project Overview page, click the **Web icon `</>`** to add a web application.
2. Enter an App nickname (e.g., `TaskWalletWeb`).
3. Click **"Register app"**.
4. You will see a `firebaseConfig` code snippet that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDXXXXXXXXXXXXX-XXXXXXXXXX",
  authDomain: "task-wallet-app.firebaseapp.com",
  projectId: "task-wallet-app",
  storageBucket: "task-wallet-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890",
  measurementId: "G-XXXXXXXXXX"
};
```

5. Keep this window open or copy these keys.

---

## Step 3: Enable Cloud Firestore Database

1. In the left sidebar of the Firebase Console, click on **Build** > **Firestore Database**.
2. Click **"Create database"**.
3. Choose your database location (e.g., `asia-south1` or `nam5 (us-central)`).
4. For security rules during setup, select **"Start in test mode"** (allows read/write access for testing) or set the production rules below.
5. Click **"Enable"**.

### Recommended Firestore Security Rules:
Go to the **Rules** tab in Firestore and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // For full connectivity between User & Admin
    }
  }
}
```
Click **"Publish"**.

---

## Step 4: Connect Firebase to your App (2 Easy Options)

### Option A: Via Admin Dashboard UI (Easiest - No Coding Needed!)
1. Open the Admin Dashboard: `admin.html` in your browser.
2. Navigate to the **"Firebase Setup"** tab in the sidebar/tabs.
3. Paste the `firebaseConfig` object or fill in each field (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
4. Click **"Save & Connect Firebase"**.
5. The status badge will instantly turn green: **🟢 Connected to Firebase**.

### Option B: Directly in `firebase-config.js`
1. Open `firebase-config.js` in your text editor.
2. Locate line 12:
   ```javascript
   window.FIREBASE_CONFIG = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```
3. Replace the placeholder values with your actual Firebase credentials.
4. Save the file.

---

## What Happens Behind the Scenes?
- **All Users**: Registered users are stored in the `users` Firestore collection.
- **Deposit Requests**: When a user submits a deposit with TrxID, it creates a document in `deposits` with status `pending`.
- **Admin Approval**: When you click **Approve** in `admin.html`, Firebase automatically adds the money to the user's balance and marks the transaction as `approved`.
- **Withdrawals**: Managed through the `withdrawals` collection with one-click approval/rejection and automatic refund.
- **Payment Gateways**: Any bKash/Nagad/Rocket/USDT number updated in Admin is synced to all users instantly in real-time.
