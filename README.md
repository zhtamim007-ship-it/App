# Task Wallet

A mobile earning-app front end with a full admin dashboard, backed by Firebase Firestore.

| File | What it is |
|---|---|
| `index.html` | the user app (Bengali) — login, deposit, withdraw, plans, task center |
| `admin.html` | the admin dashboard — approvals, users, methods, plans, settings |
| `firebase-config.js` | **the only file you edit** — your Firebase keys + admin login |
| `js/db.js` | shared data layer (Firestore, with a localStorage demo fallback) |
| `js/admin.js` | dashboard logic |
| `firestore.rules` | security rules to paste into the Firebase console |
| `FIREBASE_SETUP.md` | **start here** — click-by-click credential guide |
| `PLAN.md` | the design and build plan |

## Run it

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/index.html` (users) and `http://localhost:8080/admin.html` (admin).

Without Firebase keys it runs in **demo mode** on localStorage — the entire deposit/approval
flow works, but only inside one browser. Follow `FIREBASE_SETUP.md` to make it live and shared.

Default admin login: `admin` / `admin123` — change it in `firebase-config.js`.

## The deposit flow

1. User enters an amount and picks a method, presses **Submit**.
2. A popup shows the **deposit address for that method** with a Copy button, the **amount**
   with a Copy button, and admin-written instructions.
3. The user must enter a **Transaction ID** — the request cannot be sent without it.
   Duplicate TrxIDs are rejected.
4. The request is saved as `pending`. **No balance is credited yet.**
5. Admin sees it in **Deposits** and clicks Approve (balance credited instantly) or
   Reject (with a reason the user sees in their history).

Withdrawals work the same way, except the amount is held on request and refunded on rejection.

## Adding a payment method

Admin → **Deposit Methods** → *+ Add Method*. Set the name, emoji icon, address/number,
type, minimum, and instruction text, then Save. It appears in the user app immediately and
the popup automatically uses the new address. Works for mobile banking, bank, and crypto.
