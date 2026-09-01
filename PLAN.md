# Task Wallet — Admin Dashboard + Firebase Plan

## What exists today
`index.html` — one 2,375-line file. Login/register, deposit, withdraw, plans, task center,
and a small admin sheet. **Everything is in RAM.** Refresh = all data gone. The old admin
sheet can only edit banner text and plan numbers; it cannot approve anything and cannot
see users.

## What we are building

### 1. A shared data layer (`js/db.js`)
One module that both the user app and the admin dashboard talk to. It has two backends:

| Backend | When it runs | Purpose |
|---|---|---|
| **firestore** | as soon as you paste real keys into `firebase-config.js` | the real thing, live sync between user + admin |
| **local** | while keys are still placeholders | localStorage-backed demo so you can test the whole flow today, no account needed |

Same function names either way, so nothing has to be rewritten when you plug Firebase in.

### 2. New deposit flow (user side) — the change you asked for
```
Step 1  User types Amount and picks a method (bKash / Nagad / Rocket / USDT ...)
Step 2  Presses "Submit"
Step 3  POPUP opens showing:
          • the deposit ADDRESS/NUMBER for that exact method   [Copy]
          • the AMOUNT to send                                  [Copy]
          • instructions set by admin
          • a required Transaction ID box
Step 4  User pastes the TrxID and confirms
Step 5  Request is saved as status = "pending". Balance does NOT move.
          A "Deposit — Pending" row appears in their history.
Step 6  Admin approves  -> balance credited automatically, row turns APPROVED
        Admin rejects   -> row turns REJECTED with the admin's reason
```
This popup is generic — it reads the address from the admin's method list, so it works
for **every** deposit option, including ones you add later.

Withdrawals get the same treatment: request -> pending -> admin approve/reject
(balance is held on request, refunded on reject).

### 3. `admin.html` — a real desktop dashboard
Separate page, its own login, never shipped inside the user app.

| Tab | Powers |
|---|---|
| **Dashboard** | totals: users, balance in system, pending deposits/withdrawals, today's volume |
| **Deposits** | live queue. Every request shows user, phone, amount, method, TrxID, time. Approve / Reject with reason. Filter pending/approved/rejected. |
| **Withdrawals** | same, plus the payout account number to send money to |
| **Users** | every registered user: name, phone, password, balance, plan, joined date, status. Edit balance (+/- with reason), block/unblock, reset password, delete, view that user's full history |
| **Deposit Methods** | add/edit/delete payment options — name, icon, address/number, instructions, min amount, on/off toggle. This is what the user popup reads. |
| **Plans** | the existing plan editor, now saved permanently |
| **Content & Settings** | app name, banner text, min deposit/withdraw, support phone/email |
| **Transactions** | full ledger across all users, searchable |

### 4. Security note about your auth choice
You picked *phone + password stored in Firestore*. I'm building exactly that, but with two
hardening steps so it isn't reckless:
- passwords are **SHA-256 hashed with a salt** before storage — never written in plain text
- `firestore.rules` blocks a user from reading anyone else's document or writing their own
  `balance` / `status` fields (only the admin console can)

The admin dashboard's "view password" therefore shows the hash, not the original. Use
**Reset Password** if a user is locked out. If you ever want real per-user protection,
switching to Firebase Auth later only touches `js/db.js`.

## Files after this work
```
index.html            user app  (modified)
admin.html            admin dashboard  (new)
firebase-config.js    ← THE ONLY FILE YOU EDIT with your keys  (new)
js/db.js              shared data layer  (new)
js/admin.js           dashboard logic  (new)
firestore.rules       security rules to paste into Firebase  (new)
FIREBASE_SETUP.md     click-by-click credential guide  (new)
PLAN.md               this file
```

## Firestore collections
```
users/{uid}          name, phone, passwordHash, salt, balance, status,
                     plan{name,days,adsPerDay,rewardPerAd,activatedAt},
                     totalDeposit, totalWithdraw, referralCode, createdAt

deposits/{id}        uid, name, phone, amount, method, address, trxId,
                     status(pending|approved|rejected), note,
                     createdAt, reviewedAt, reviewedBy

withdrawals/{id}     uid, name, phone, amount, method, accountNumber,
                     status, note, createdAt, reviewedAt, reviewedBy

transactions/{id}    uid, title, amount, type(plus|minus), status, createdAt

config/app           appName, banner*, minDeposit, minWithdraw, support*
config/methods       deposit methods array
config/plans         plans array
admins/{username}    passwordHash, salt, role
```

## Build order
1. `firebase-config.js` + `js/db.js` (dual backend)
2. `FIREBASE_SETUP.md` + `firestore.rules`
3. Rewrite deposit/withdraw/auth/persistence inside `index.html`
4. Build `admin.html` + `js/admin.js`
5. Run both in the live preview and test end-to-end in local mode
