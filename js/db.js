/* ============================================================================
   db.js — shared data layer for index.html (user app) and admin.html (dashboard)

   Two interchangeable backends behind ONE api:
     • "firestore"  – used automatically once real keys are in firebase-config.js
     • "local"      – localStorage fallback so everything is testable with no account

   Nothing else in the project talks to Firebase directly.
   ========================================================================== */
(function (global) {
  'use strict';

  var LS = {
    users: 'tw_users',
    deposits: 'tw_deposits',
    withdrawals: 'tw_withdrawals',
    transactions: 'tw_transactions',
    config: 'tw_config',
    admins: 'tw_admins',
    session: 'tw_session',
    adminSession: 'tw_admin_session'
  };

  /* ---------------------------------------------------------------- helpers */

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 9);
  }

  function nowISO() { return new Date().toISOString(); }

  function randomSalt() {
    var a = new Uint8Array(16);
    (global.crypto || global.msCrypto).getRandomValues(a);
    return Array.from(a).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  /* SHA-256(salt + password) — passwords are never stored in plain text. */
  async function hashPassword(password, salt) {
    var enc = new TextEncoder().encode(salt + '::' + password);
    var buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  async function makeCredential(password) {
    var salt = randomSalt();
    return { salt: salt, passwordHash: await hashPassword(password, salt) };
  }

  async function verifyCredential(password, salt, expectedHash) {
    if (!salt || !expectedHash) return false;
    return (await hashPassword(password, salt)) === expectedHash;
  }

  /* ------------------------------------------------------------- defaults  */

  var DEFAULT_CONFIG = {
    appName: 'Task Wallet',
    bannerTitle: 'অ্যাকাউন্ট খুললে পাবেন',
    bannerSub1: 'সাইন আপ বোনাস ৳১০০',
    bannerSub2: 'রেফার করলে ৳৫০ বোনাস',
    minDeposit: 500,
    minWithdraw: 500,
    supportPhone: '+880 1XXXXXXXXX',
    supportEmail: 'support@example.com',
    signupBonus: 100,
    referralBonus: 50
  };

  var DEFAULT_METHODS = [
    {
      id: 'bkash', name: 'bKash', icon: '📱', type: 'mobile',
      address: '01853367870', enabled: true, minAmount: 500,
      instruction: 'উপরের bKash নাম্বারে Send Money করুন, তারপর প্রাপ্ত TrxID নিচে লিখুন।'
    },
    {
      id: 'nagad', name: 'Nagad', icon: '🟠', type: 'mobile',
      address: '01700000000', enabled: true, minAmount: 500,
      instruction: 'উপরের Nagad নাম্বারে Send Money করুন, তারপর প্রাপ্ত TrxID নিচে লিখুন।'
    },
    {
      id: 'rocket', name: 'Rocket', icon: '🚀', type: 'mobile',
      address: '018000000000', enabled: true, minAmount: 500,
      instruction: 'উপরের Rocket নাম্বারে Send Money করুন, তারপর প্রাপ্ত TrxID নিচে লিখুন।'
    },
    {
      id: 'usdt', name: 'USDT (TRC20)', icon: '💵', type: 'crypto',
      address: 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', enabled: true, minAmount: 500,
      instruction: 'উপরের TRC20 অ্যাড্রেসে USDT পাঠান, তারপর Transaction Hash নিচে লিখুন।'
    }
  ];

  var DEFAULT_PLANS = [
    { id: 'p1', name: 'Basic',    price: 500,  days: 60, adsPerDay: 3,  rewardPerAd: 100 },
    { id: 'p2', name: 'Standard', price: 1000, days: 60, adsPerDay: 6,  rewardPerAd: 100 },
    { id: 'p3', name: 'Pro',      price: 2000, days: 60, adsPerDay: 12, rewardPerAd: 100 }
  ];

  /* ====================================================================== */
  /*                            LOCAL BACKEND                                */
  /* ====================================================================== */

  var Local = {
    read: function (key) {
      try { return JSON.parse(localStorage.getItem(key)) || null; }
      catch (e) { return null; }
    },
    write: function (key, val) {
      localStorage.setItem(key, JSON.stringify(val));
      // notify listeners in this tab (the native 'storage' event only fires cross-tab)
      global.dispatchEvent(new CustomEvent('tw-data-changed', { detail: { key: key } }));
    },
    list: function (key) { return this.read(key) || []; },

    init: async function () {
      if (!this.read(LS.config)) {
        this.write(LS.config, {
          app: Object.assign({}, DEFAULT_CONFIG),
          methods: DEFAULT_METHODS.slice(),
          plans: DEFAULT_PLANS.slice()
        });
      }
      if (!this.read(LS.users)) this.write(LS.users, []);
      if (!this.read(LS.deposits)) this.write(LS.deposits, []);
      if (!this.read(LS.withdrawals)) this.write(LS.withdrawals, []);
      if (!this.read(LS.transactions)) this.write(LS.transactions, []);
      if (!this.read(LS.admins)) {
        var b = global.ADMIN_BOOTSTRAP || { username: 'admin', password: 'admin123' };
        var cred = await makeCredential(b.password);
        this.write(LS.admins, [{
          id: b.username, username: b.username, role: 'super',
          salt: cred.salt, passwordHash: cred.passwordHash, createdAt: nowISO()
        }]);
      }
    },

    getDoc: function (key, id) {
      return this.list(key).find(function (d) { return d.id === id; }) || null;
    },
    addDoc: function (key, data) {
      var arr = this.list(key);
      arr.push(data);
      this.write(key, arr);
      return data;
    },
    updateDoc: function (key, id, patch) {
      var arr = this.list(key);
      var i = arr.findIndex(function (d) { return d.id === id; });
      if (i === -1) return null;
      arr[i] = Object.assign({}, arr[i], patch);
      this.write(key, arr);
      return arr[i];
    },
    deleteDoc: function (key, id) {
      this.write(key, this.list(key).filter(function (d) { return d.id !== id; }));
    },
    watch: function (key, cb) {
      var fire = function () { cb(Local.list(key)); };
      fire();
      var h1 = function (e) { if (e.detail && e.detail.key === key) fire(); };
      var h2 = function (e) { if (e.key === key) fire(); };
      global.addEventListener('tw-data-changed', h1);
      global.addEventListener('storage', h2);
      return function () {
        global.removeEventListener('tw-data-changed', h1);
        global.removeEventListener('storage', h2);
      };
    }
  };

  /* ====================================================================== */
  /*                          FIRESTORE BACKEND                              */
  /* ====================================================================== */

  var FS = {
    ready: false, db: null, api: null,

    init: async function (cfg) {
      var appMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      var fsMod  = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      var app = appMod.initializeApp(cfg);
      this.db = fsMod.getFirestore(app);
      this.api = fsMod;
      this.ready = true;

      // seed config documents on first ever run
      await this.seed('app', DEFAULT_CONFIG);
      await this.seed('methods', { items: DEFAULT_METHODS });
      await this.seed('plans', { items: DEFAULT_PLANS });

      var b = global.ADMIN_BOOTSTRAP || { username: 'admin', password: 'admin123' };
      var aRef = this.api.doc(this.db, 'admins', b.username);
      var aSnap = await this.api.getDoc(aRef);
      if (!aSnap.exists()) {
        var cred = await makeCredential(b.password);
        await this.api.setDoc(aRef, {
          username: b.username, role: 'super',
          salt: cred.salt, passwordHash: cred.passwordHash, createdAt: nowISO()
        });
      }
    },

    seed: async function (docId, data) {
      var ref = this.api.doc(this.db, 'config', docId);
      var snap = await this.api.getDoc(ref);
      if (!snap.exists()) await this.api.setDoc(ref, data);
    },

    list: async function (col) {
      var snap = await this.api.getDocs(this.api.collection(this.db, col));
      return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    },
    getDoc: async function (col, id) {
      var snap = await this.api.getDoc(this.api.doc(this.db, col, id));
      return snap.exists() ? Object.assign({ id: snap.id }, snap.data()) : null;
    },
    addDoc: async function (col, data) {
      var id = data.id || uid(col.slice(0, 3));
      var copy = Object.assign({}, data); delete copy.id;
      await this.api.setDoc(this.api.doc(this.db, col, id), copy);
      return Object.assign({ id: id }, copy);
    },
    updateDoc: async function (col, id, patch) {
      await this.api.updateDoc(this.api.doc(this.db, col, id), patch);
      return this.getDoc(col, id);
    },
    deleteDoc: async function (col, id) {
      await this.api.deleteDoc(this.api.doc(this.db, col, id));
    },
    watch: function (col, cb) {
      return this.api.onSnapshot(this.api.collection(this.db, col), function (snap) {
        cb(snap.docs.map(function (d) {
          return Object.assign({ id: d.id }, d.data());
        }));
      }, function (err) { console.error('[db] watch ' + col, err); });
    }
  };

  /* ====================================================================== */
  /*                             PUBLIC API                                  */
  /* ====================================================================== */

  var DB = {
    mode: 'local',
    ready: false,

    async init() {
      if (this.ready) return this.mode;
      var cfg = global.FIREBASE_CONFIG || {};
      var configured = cfg.projectId && String(cfg.projectId).indexOf('PASTE_') !== 0 &&
                       cfg.apiKey && String(cfg.apiKey).indexOf('PASTE_') !== 0;
      if (configured) {
        try {
          await FS.init(cfg);
          this.mode = 'firestore';
          console.log('[db] Firebase connected → project:', cfg.projectId);
        } catch (e) {
          console.error('[db] Firebase failed, falling back to local demo mode.', e);
          this.mode = 'local';
          await Local.init();
        }
      } else {
        console.warn('[db] LOCAL DEMO MODE — paste your keys into firebase-config.js to go live.');
        await Local.init();
      }
      this.ready = true;
      return this.mode;
    },

    isLive() { return this.mode === 'firestore'; },

    /* -- generic passthrough ------------------------------------------- */
    _list(col)              { return this.mode === 'firestore' ? FS.list(col)              : Promise.resolve(Local.list(LS[col])); },
    _get(col, id)           { return this.mode === 'firestore' ? FS.getDoc(col, id)        : Promise.resolve(Local.getDoc(LS[col], id)); },
    _add(col, data)         { return this.mode === 'firestore' ? FS.addDoc(col, data)      : Promise.resolve(Local.addDoc(LS[col], data)); },
    _update(col, id, patch) { return this.mode === 'firestore' ? FS.updateDoc(col, id, patch) : Promise.resolve(Local.updateDoc(LS[col], id, patch)); },
    _delete(col, id)        { return this.mode === 'firestore' ? FS.deleteDoc(col, id)     : Promise.resolve(Local.deleteDoc(LS[col], id)); },
    _watch(col, cb)         { return this.mode === 'firestore' ? FS.watch(col, cb)         : Local.watch(LS[col], cb); },

    /* -- config --------------------------------------------------------- */
    async getConfig() {
      if (this.mode === 'firestore') {
        var d = await FS.getDoc('config', 'app');
        return Object.assign({}, DEFAULT_CONFIG, d || {});
      }
      var c = Local.read(LS.config) || {};
      return Object.assign({}, DEFAULT_CONFIG, c.app || {});
    },
    async saveConfig(patch) {
      if (this.mode === 'firestore') {
        await FS.api.setDoc(FS.api.doc(FS.db, 'config', 'app'), patch, { merge: true });
        return;
      }
      var c = Local.read(LS.config) || {};
      c.app = Object.assign({}, DEFAULT_CONFIG, c.app || {}, patch);
      Local.write(LS.config, c);
    },

    async getMethods() {
      if (this.mode === 'firestore') {
        var d = await FS.getDoc('config', 'methods');
        return (d && d.items) || DEFAULT_METHODS.slice();
      }
      var c = Local.read(LS.config) || {};
      return c.methods || DEFAULT_METHODS.slice();
    },
    async saveMethods(items) {
      if (this.mode === 'firestore') {
        await FS.api.setDoc(FS.api.doc(FS.db, 'config', 'methods'), { items: items });
        return;
      }
      var c = Local.read(LS.config) || {};
      c.methods = items;
      Local.write(LS.config, c);
    },

    async getPlans() {
      if (this.mode === 'firestore') {
        var d = await FS.getDoc('config', 'plans');
        return (d && d.items) || DEFAULT_PLANS.slice();
      }
      var c = Local.read(LS.config) || {};
      return c.plans || DEFAULT_PLANS.slice();
    },
    async savePlans(items) {
      if (this.mode === 'firestore') {
        await FS.api.setDoc(FS.api.doc(FS.db, 'config', 'plans'), { items: items });
        return;
      }
      var c = Local.read(LS.config) || {};
      c.plans = items;
      Local.write(LS.config, c);
    },

    watchConfigDoc(docId, cb) {
      if (this.mode === 'firestore') {
        return FS.api.onSnapshot(FS.api.doc(FS.db, 'config', docId), function (s) {
          cb(s.exists() ? s.data() : null);
        });
      }
      return Local.watch(LS.config, function (c) {
        var obj = Local.read(LS.config) || {};
        if (docId === 'app') cb(Object.assign({}, DEFAULT_CONFIG, obj.app || {}));
        else cb({ items: obj[docId] || [] });
      });
    },

    /* -- users ---------------------------------------------------------- */
    async listUsers() { return this._list('users'); },
    watchUsers(cb)    { return this._watch('users', cb); },
    async getUser(id) { return this._get('users', id); },

    async findUserByPhone(phone) {
      var all = await this.listUsers();
      return all.find(function (u) { return u.phone === phone; }) || null;
    },

    async registerUser(name, phone, password) {
      if (await this.findUserByPhone(phone)) {
        throw new Error('এই নাম্বার দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে, Login করুন');
      }
      var cfg = await this.getConfig();
      var cred = await makeCredential(password);
      var user = {
        id: uid('usr'),
        name: name,
        phone: phone,
        salt: cred.salt,
        passwordHash: cred.passwordHash,
        balance: Number(cfg.signupBonus) || 0,
        status: 'active',
        plan: null,
        totalDeposit: 0,
        totalWithdraw: 0,
        referralCode: (name.split(' ')[0] || 'USER').toUpperCase().slice(0, 5) + '-' +
                      Math.floor(1000 + Math.random() * 9000),
        createdAt: nowISO(),
        lastLogin: nowISO()
      };
      await this._add('users', user);
      if (user.balance > 0) {
        await this.addTransaction(user.id, 'Signup Bonus', user.balance, 'plus', 'approved');
      }
      return user;
    },

    async loginUser(phone, password) {
      var u = await this.findUserByPhone(phone);
      if (!u) throw new Error('ফোন নাম্বার অথবা পাসওয়ার্ড ভুল');
      if (!(await verifyCredential(password, u.salt, u.passwordHash))) {
        throw new Error('ফোন নাম্বার অথবা পাসওয়ার্ড ভুল');
      }
      if (u.status === 'blocked') throw new Error('আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে। সাপোর্টে যোগাযোগ করুন।');
      await this._update('users', u.id, { lastLogin: nowISO() });
      return u;
    },

    async updateUser(id, patch) { return this._update('users', id, patch); },
    async deleteUser(id)        { return this._delete('users', id); },

    async setUserPassword(id, newPassword) {
      var cred = await makeCredential(newPassword);
      return this._update('users', id, { salt: cred.salt, passwordHash: cred.passwordHash });
    },

    /* Admin manual balance adjustment (positive or negative). */
    async adjustBalance(userId, delta, reason) {
      var u = await this.getUser(userId);
      if (!u) throw new Error('User not found');
      var next = Number((Number(u.balance || 0) + Number(delta)).toFixed(2));
      if (next < 0) next = 0;
      await this._update('users', userId, { balance: next });
      await this.addTransaction(
        userId,
        reason || (delta >= 0 ? 'Admin Credit' : 'Admin Debit'),
        Math.abs(delta),
        delta >= 0 ? 'plus' : 'minus',
        'approved'
      );
      return next;
    },

    /* -- transactions --------------------------------------------------- */
    async addTransaction(userId, title, amount, type, status, extra) {
      return this._add('transactions', Object.assign({
        id: uid('tx'),
        uid: userId,
        title: title,
        amount: Number(amount),
        type: type,                       // 'plus' | 'minus'
        status: status || 'approved',     // 'pending' | 'approved' | 'rejected'
        createdAt: nowISO()
      }, extra || {}));
    },
    async listTransactions()  { return this._list('transactions'); },
    watchTransactions(cb)     { return this._watch('transactions', cb); },
    async updateTransaction(id, patch) { return this._update('transactions', id, patch); },

    /* -- deposits ------------------------------------------------------- */
    async createDeposit(payload) {
      var dep = {
        id: uid('dep'),
        uid: payload.uid,
        name: payload.name,
        phone: payload.phone,
        amount: Number(payload.amount),
        method: payload.method,
        address: payload.address || '',
        trxId: payload.trxId,
        status: 'pending',
        note: '',
        createdAt: nowISO(),
        reviewedAt: null,
        reviewedBy: null
      };
      await this._add('deposits', dep);
      var tx = await this.addTransaction(
        payload.uid, 'Deposit - ' + payload.method,
        dep.amount, 'plus', 'pending', { refId: dep.id, refType: 'deposit' }
      );
      await this._update('deposits', dep.id, { txId: tx.id });
      dep.txId = tx.id;
      return dep;
    },
    async listDeposits() { return this._list('deposits'); },
    watchDeposits(cb)    { return this._watch('deposits', cb); },

    async approveDeposit(depId, adminName) {
      var d = await this._get('deposits', depId);
      if (!d) throw new Error('Deposit not found');
      if (d.status !== 'pending') throw new Error('Already reviewed');
      var u = await this.getUser(d.uid);
      if (u) {
        await this._update('users', d.uid, {
          balance: Number((Number(u.balance || 0) + Number(d.amount)).toFixed(2)),
          totalDeposit: Number((Number(u.totalDeposit || 0) + Number(d.amount)).toFixed(2))
        });
      }
      if (d.txId) await this.updateTransaction(d.txId, { status: 'approved' });
      return this._update('deposits', depId, {
        status: 'approved', reviewedAt: nowISO(), reviewedBy: adminName || 'admin', note: ''
      });
    },

    async rejectDeposit(depId, reason, adminName) {
      var d = await this._get('deposits', depId);
      if (!d) throw new Error('Deposit not found');
      if (d.status !== 'pending') throw new Error('Already reviewed');
      if (d.txId) await this.updateTransaction(d.txId, { status: 'rejected' });
      return this._update('deposits', depId, {
        status: 'rejected', note: reason || '', reviewedAt: nowISO(),
        reviewedBy: adminName || 'admin'
      });
    },

    /* -- withdrawals ---------------------------------------------------- */
    /* Balance is HELD when the request is made, refunded if rejected. */
    async createWithdrawal(payload) {
      var u = await this.getUser(payload.uid);
      if (!u) throw new Error('User not found');
      if (Number(u.balance || 0) < Number(payload.amount)) throw new Error('অপর্যাপ্ত ব্যালেন্স');

      await this._update('users', payload.uid, {
        balance: Number((Number(u.balance) - Number(payload.amount)).toFixed(2))
      });

      var w = {
        id: uid('wd'),
        uid: payload.uid,
        name: payload.name,
        phone: payload.phone,
        amount: Number(payload.amount),
        method: payload.method,
        accountNumber: payload.accountNumber,
        status: 'pending',
        note: '',
        createdAt: nowISO(),
        reviewedAt: null,
        reviewedBy: null
      };
      await this._add('withdrawals', w);
      var tx = await this.addTransaction(
        payload.uid, 'Withdraw - ' + payload.method,
        w.amount, 'minus', 'pending', { refId: w.id, refType: 'withdrawal' }
      );
      await this._update('withdrawals', w.id, { txId: tx.id });
      w.txId = tx.id;
      return w;
    },
    async listWithdrawals() { return this._list('withdrawals'); },
    watchWithdrawals(cb)    { return this._watch('withdrawals', cb); },

    async approveWithdrawal(id, adminName) {
      var w = await this._get('withdrawals', id);
      if (!w) throw new Error('Withdrawal not found');
      if (w.status !== 'pending') throw new Error('Already reviewed');
      var u = await this.getUser(w.uid);
      if (u) {
        await this._update('users', w.uid, {
          totalWithdraw: Number((Number(u.totalWithdraw || 0) + Number(w.amount)).toFixed(2))
        });
      }
      if (w.txId) await this.updateTransaction(w.txId, { status: 'approved' });
      return this._update('withdrawals', id, {
        status: 'approved', reviewedAt: nowISO(), reviewedBy: adminName || 'admin'
      });
    },

    async rejectWithdrawal(id, reason, adminName) {
      var w = await this._get('withdrawals', id);
      if (!w) throw new Error('Withdrawal not found');
      if (w.status !== 'pending') throw new Error('Already reviewed');
      var u = await this.getUser(w.uid);
      if (u) { // refund the held amount
        await this._update('users', w.uid, {
          balance: Number((Number(u.balance || 0) + Number(w.amount)).toFixed(2))
        });
      }
      if (w.txId) await this.updateTransaction(w.txId, { status: 'rejected' });
      return this._update('withdrawals', id, {
        status: 'rejected', note: reason || '', reviewedAt: nowISO(),
        reviewedBy: adminName || 'admin'
      });
    },

    /* -- admin auth ----------------------------------------------------- */
    async adminLogin(username, password) {
      var a = this.mode === 'firestore'
        ? await FS.getDoc('admins', username)
        : Local.getDoc(LS.admins, username);
      if (!a) throw new Error('Invalid username or password');
      if (!(await verifyCredential(password, a.salt, a.passwordHash))) {
        throw new Error('Invalid username or password');
      }
      return { username: a.username, role: a.role };
    },
    async changeAdminPassword(username, newPassword) {
      var cred = await makeCredential(newPassword);
      if (this.mode === 'firestore') {
        return FS.updateDoc('admins', username, cred);
      }
      return Local.updateDoc(LS.admins, username, cred);
    },

    /* -- sessions (browser-local) --------------------------------------- */
    setSession(u)   { localStorage.setItem(LS.session, JSON.stringify({ id: u.id, phone: u.phone })); },
    getSession()    { try { return JSON.parse(localStorage.getItem(LS.session)); } catch (e) { return null; } },
    clearSession()  { localStorage.removeItem(LS.session); },
    setAdminSession(a)  { sessionStorage.setItem(LS.adminSession, JSON.stringify(a)); },
    getAdminSession()   { try { return JSON.parse(sessionStorage.getItem(LS.adminSession)); } catch (e) { return null; } },
    clearAdminSession() { sessionStorage.removeItem(LS.adminSession); },

    /* -- maintenance ----------------------------------------------------- */
    /* Wipe every collection. Used by the admin "reset demo data" action. */
    async resetAll() {
      var cols = ['users', 'deposits', 'withdrawals', 'transactions'];
      for (var i = 0; i < cols.length; i++) {
        var items = await this._list(cols[i]);
        for (var j = 0; j < items.length; j++) {
          await this._delete(cols[i], items[j].id);
        }
      }
    },

    /* -- utils ---------------------------------------------------------- */
    uid: uid,
    nowISO: nowISO,
    hashPassword: hashPassword,
    DEFAULT_METHODS: DEFAULT_METHODS,
    DEFAULT_PLANS: DEFAULT_PLANS,
    DEFAULT_CONFIG: DEFAULT_CONFIG
  };

  global.DB = DB;
})(window);
