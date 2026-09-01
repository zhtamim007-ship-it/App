/**
 * =========================================================================
 * Firebase & Centralized Data Layer for Task Wallet
 * =========================================================================
 * Connects User App (index.html) and Admin Dashboard (admin.html).
 * Supports live Google Firebase Firestore synchronization +
 * automatic local fallback & cross-tab BroadcastChannel simulation mode.
 */

// Global Firebase configuration object.
// Paste your Firebase Web App credentials here or configure them via the Admin Panel.
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

// Check if admin previously saved Firebase Config in LocalStorage
try {
  const savedConfig = localStorage.getItem('TW_FIREBASE_CONFIG');
  if (savedConfig) {
    const parsed = JSON.parse(savedConfig);
    if (parsed && parsed.projectId) {
      window.FIREBASE_CONFIG = parsed;
    }
  }
} catch (e) {
  console.warn('Could not read saved Firebase config:', e);
}

// Universal Database Service
class DatabaseService {
  constructor() {
    this.isFirebaseReady = false;
    this.firebaseApp = null;
    this.firestore = null;
    this.listeners = new Map();
    this.broadcastChannel = null;

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('TASK_WALLET_SYNC_CHANNEL');
        this.broadcastChannel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data);
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }

    // Default Seed Data
    this.defaultState = {
      admin: {
        username: 'admin',
        password: 'admin123456',
        updatedAt: new Date().toISOString()
      },
      settings: {
        appName: 'Task Wallet',
        minDeposit: 500,
        minWithdraw: 500,
        supportPhone: '+880 1853367870',
        supportEmail: 'support@taskwallet.com',
        supportTelegram: 'https://t.me/taskwallet_official',
        supportWhatsApp: '+8801853367870',
        bannerTitle: 'অ্যাকাউন্ট খুললেই পাবেন',
        bannerSub1: '২০০০ টাকা ডিপোজিট করলে',
        bannerSub2: '৫০০ টাকা বোনাস',
        noticeText: '🎉 নতুন ইউজারদের জন্য স্পেশাল অফার! ডিপোজিট করে কাজ শুরু করুন।'
      },
      paymentMethods: [
        {
          id: 'pm_bkash',
          name: 'bKash',
          type: 'Personal',
          number: '01853367870',
          badge: 'BKASH',
          instructions: 'নিচের bKash পার্সোনাল নম্বরে Send Money করুন। টাকা পাঠানোর পর ফিরতি SMS থেকে প্রাপ্ত TrxID নিচের বক্সে লিখে সাবমিট করুন।',
          minDeposit: 500,
          isActive: true
        },
        {
          id: 'pm_nagad',
          name: 'Nagad',
          type: 'Personal',
          number: '01853367870',
          badge: 'NAGAD',
          instructions: 'নিচের Nagad পার্সোনাল নম্বরে Send Money করুন। টাকা পাঠানোর পর ফিরতি SMS থেকে প্রাপ্ত TrxID নিচের বক্সে লিখে সাবমিট করুন।',
          minDeposit: 500,
          isActive: true
        },
        {
          id: 'pm_rocket',
          name: 'Rocket',
          type: 'Personal',
          number: '018533678708',
          badge: 'ROCKET',
          instructions: 'নিচের Rocket নম্বরে Send Money করুন এবং ট্রানজেকশন আইডি (TxnID) দিন।',
          minDeposit: 500,
          isActive: true
        },
        {
          id: 'pm_usdt',
          name: 'USDT (TRC20)',
          type: 'Crypto',
          number: 'TLr74kK2wN9e8bT6x1Y9pQ5mZ2vA4cD8eF',
          badge: 'USDT TRC20',
          instructions: 'নিচের TRC20 এড্রেসে USDT ট্রান্সফার করুন (1 USDT = ১২০ ৳)। ট্রান্সফার সফল হলে ট্রানজেকশন হ্যাশ (TxID) বক্সে দিন।',
          minDeposit: 500,
          isActive: true
        }
      ],
      plans: [
        { id: 'plan_1', name: 'Basic', price: 500, days: 60, adsPerDay: 3, rewardPerAd: 100, isActive: true },
        { id: 'plan_2', name: 'Standard', price: 1000, days: 60, adsPerDay: 6, rewardPerAd: 100, isActive: true },
        { id: 'plan_3', name: 'Pro', price: 2000, days: 60, adsPerDay: 12, rewardPerAd: 100, isActive: true },
        { id: 'plan_4', name: 'VIP', price: 5000, days: 90, adsPerDay: 30, rewardPerAd: 100, isActive: true }
      ],
      users: {
        '01712345678': {
          id: 'usr_demo',
          name: 'Rahim Ahmed',
          phone: '01712345678',
          password: 'password123',
          balance: 100.00,
          totalDeposit: 0,
          totalWithdraw: 0,
          activePlan: null,
          status: 'active',
          referCode: 'RAHIM-1024',
          joinedAt: new Date(Date.now() - 86400000 * 5).toISOString()
        }
      ],
      deposits: [
        {
          id: 'dep_1001',
          userId: '01712345678',
          userName: 'Rahim Ahmed',
          userPhone: '01712345678',
          method: 'bKash',
          accountNumber: '01853367870',
          amount: 1000,
          trxId: 'BK9A87X41Q',
          status: 'pending',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          rejectReason: ''
        }
      ],
      withdrawals: [
        {
          id: 'wd_2001',
          userId: '01712345678',
          userName: 'Rahim Ahmed',
          userPhone: '01712345678',
          method: 'Nagad',
          targetAccount: '01712345678',
          amount: 300,
          status: 'approved',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ],
      transactions: [
        {
          id: 'tx_1',
          userId: '01712345678',
          name: 'Welcome Bonus',
          amount: 100,
          type: 'plus',
          status: 'approved',
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
        }
      ]
    };

    this.initLocalStore();
  }

  // Initialize LocalStorage backing
  initLocalStore() {
    if (!localStorage.getItem('TW_INITIALIZED')) {
      localStorage.setItem('TW_ADMIN_CREDENTIALS', JSON.stringify(this.defaultState.admin));
      localStorage.setItem('TW_SETTINGS', JSON.stringify(this.defaultState.settings));
      localStorage.setItem('TW_PAYMENT_METHODS', JSON.stringify(this.defaultState.paymentMethods));
      localStorage.setItem('TW_PLANS', JSON.stringify(this.defaultState.plans));
      localStorage.setItem('TW_USERS', JSON.stringify(this.defaultState.users));
      localStorage.setItem('TW_DEPOSITS', JSON.stringify(this.defaultState.deposits));
      localStorage.setItem('TW_WITHDRAWALS', JSON.stringify(this.defaultState.withdrawals));
      localStorage.setItem('TW_TRANSACTIONS', JSON.stringify(this.defaultState.transactions));
      localStorage.setItem('TW_INITIALIZED', 'true');
    }
  }

  // Try to connect to Firebase
  async initFirebase() {
    const config = window.FIREBASE_CONFIG;
    if (config && config.projectId && config.apiKey && typeof firebase !== 'undefined') {
      try {
        if (!firebase.apps.length) {
          this.firebaseApp = firebase.initializeApp(config);
        } else {
          this.firebaseApp = firebase.app();
        }
        this.firestore = firebase.firestore();
        this.isFirebaseReady = true;
        console.log('✅ Google Firebase Connected Successfully! Project ID:', config.projectId);
        
        // Ensure default admin credentials exist in Firestore
        await this.ensureAdminCredentialsInFirestore();

        this.notify('connectionStatus', { connected: true, projectId: config.projectId });
        return true;
      } catch (err) {
        console.warn('⚠️ Firebase Initialization Error:', err);
        this.isFirebaseReady = false;
        this.notify('connectionStatus', { connected: false, error: err.message });
        return false;
      }
    } else {
      console.log('ℹ️ Running in Local Reactive Simulation Mode (Firebase credentials pending).');
      this.notify('connectionStatus', { connected: false, mode: 'local' });
      return false;
    }
  }

  // Ensure admin credentials exist in Firestore on initialization
  async ensureAdminCredentialsInFirestore() {
    if (!this.isFirebaseReady || !this.firestore) return;
    try {
      const doc = await this.firestore.collection('config').doc('adminCredentials').get();
      if (!doc.exists) {
        const localCreds = this.getCollection('TW_ADMIN_CREDENTIALS', this.defaultState.admin);
        await this.firestore.collection('config').doc('adminCredentials').set(localCreds);
        console.log('👑 Admin credentials initialized in Firebase Firestore.');
      }
    } catch (e) {
      console.warn('Could not check admin credentials in Firestore:', e);
    }
  }

  // Handle cross-tab messages
  handleBroadcastMessage(data) {
    if (!data || !data.type) return;
    this.notify(data.type, data.payload);
  }

  broadcast(type, payload) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type, payload });
      } catch (e) {
        console.warn('Broadcast error:', e);
      }
    }
    this.notify(type, payload);
  }

  // Event Subscription
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  notify(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }

  // Helper to read/write LocalStorage collections
  getCollection(key, defaultVal = []) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  }

  setCollection(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage write error:', e);
    }
  }

  // ==========================================
  // ADMIN AUTHENTICATION (Stored in Firebase)
  // ==========================================
  async getAdminCredentials() {
    if (this.isFirebaseReady && this.firestore) {
      try {
        const doc = await this.firestore.collection('config').doc('adminCredentials').get();
        if (doc.exists) {
          const creds = doc.data();
          this.setCollection('TW_ADMIN_CREDENTIALS', creds);
          return creds;
        }
      } catch (e) {
        console.warn('Firestore getAdminCredentials error:', e);
      }
    }
    return this.getCollection('TW_ADMIN_CREDENTIALS', this.defaultState.admin);
  }

  async loginAdmin({ username, password }) {
    const creds = await this.getAdminCredentials();
    const cleanUser = (username || '').trim().toLowerCase();
    const adminUser = (creds.username || 'admin').trim().toLowerCase();

    if (cleanUser !== adminUser || password !== creds.password) {
      throw new Error('ভুল ইউজারনেম অথবা পাসওয়ার্ড! আবার চেষ্টা করুন।');
    }

    const session = {
      username: creds.username,
      loggedInAt: new Date().toISOString()
    };
    sessionStorage.setItem('TW_ADMIN_LOGGED_IN', JSON.stringify(session));
    return session;
  }

  async updateAdminCredentials({ currentPassword, newUsername, newPassword }) {
    const creds = await this.getAdminCredentials();
    if (currentPassword !== creds.password) {
      throw new Error('বর্তমান অ্যাডমিন পাসওয়ার্ডটি সঠিক নয়।');
    }

    if (!newUsername || newUsername.trim().length < 3) {
      throw new Error('ইউজারনেম কমপক্ষে ৩ অক্ষরের হতে হবে।');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
    }

    const updated = {
      username: newUsername.trim(),
      password: newPassword,
      updatedAt: new Date().toISOString()
    };

    this.setCollection('TW_ADMIN_CREDENTIALS', updated);

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('config').doc('adminCredentials').set(updated, { merge: true });
      } catch (e) {
        console.error('Firestore updateAdminCredentials error:', e);
      }
    }

    this.broadcast('adminCredentialsUpdated', { username: updated.username });
    return updated;
  }

  isAdminLoggedIn() {
    try {
      const session = sessionStorage.getItem('TW_ADMIN_LOGGED_IN');
      return !!session;
    } catch (e) {
      return false;
    }
  }

  logoutAdmin() {
    sessionStorage.removeItem('TW_ADMIN_LOGGED_IN');
  }

  // ==========================================
  // SETTINGS & CONFIG
  // ==========================================
  async getSettings() {
    if (this.isFirebaseReady && this.firestore) {
      try {
        const doc = await this.firestore.collection('config').doc('settings').get();
        if (doc.exists) return { ...this.defaultState.settings, ...doc.data() };
      } catch (e) {
        console.warn('Firestore getSettings error:', e);
      }
    }
    return this.getCollection('TW_SETTINGS', this.defaultState.settings);
  }

  async saveSettings(settings) {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    this.setCollection('TW_SETTINGS', updated);

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('config').doc('settings').set(updated, { merge: true });
      } catch (e) {
        console.error('Firestore saveSettings error:', e);
      }
    }
    this.broadcast('settingsChanged', updated);
    return updated;
  }

  // ==========================================
  // PAYMENT METHODS (Deposit Gateways)
  // ==========================================
  async getPaymentMethods() {
    if (this.isFirebaseReady && this.firestore) {
      try {
        const snap = await this.firestore.collection('paymentMethods').get();
        if (!snap.empty) {
          const list = [];
          snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
          return list;
        }
      } catch (e) {
        console.warn('Firestore getPaymentMethods error:', e);
      }
    }
    return this.getCollection('TW_PAYMENT_METHODS', this.defaultState.paymentMethods);
  }

  async savePaymentMethod(method) {
    const methods = await this.getPaymentMethods();
    let updated;
    const idx = methods.findIndex(m => m.id === method.id);
    if (idx >= 0) {
      methods[idx] = { ...methods[idx], ...method };
      updated = methods;
    } else {
      const newMethod = { ...method, id: method.id || 'pm_' + Date.now() };
      methods.push(newMethod);
      updated = methods;
    }
    this.setCollection('TW_PAYMENT_METHODS', updated);

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('paymentMethods').doc(method.id).set(method, { merge: true });
      } catch (e) {
        console.error('Firestore savePaymentMethod error:', e);
      }
    }
    this.broadcast('paymentMethodsChanged', updated);
    return updated;
  }

  async deletePaymentMethod(id) {
    const methods = await this.getPaymentMethods();
    const filtered = methods.filter(m => m.id !== id);
    this.setCollection('TW_PAYMENT_METHODS', filtered);

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('paymentMethods').doc(id).delete();
      } catch (e) {
        console.error('Firestore deletePaymentMethod error:', e);
      }
    }
    this.broadcast('paymentMethodsChanged', filtered);
    return filtered;
  }

  // ==========================================
  // PACKAGES / PLANS
  // ==========================================
  async getPlans() {
    if (this.isFirebaseReady && this.firestore) {
      try {
        const snap = await this.firestore.collection('plans').get();
        if (!snap.empty) {
          const list = [];
          snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
          return list;
        }
      } catch (e) {
        console.warn('Firestore getPlans error:', e);
      }
    }
    return this.getCollection('TW_PLANS', this.defaultState.plans);
  }

  async savePlan(plan) {
    const plans = await this.getPlans();
    let updated;
    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx >= 0) {
      plans[idx] = { ...plans[idx], ...plan };
      updated = plans;
    } else {
      const newPlan = { ...plan, id: plan.id || 'plan_' + Date.now() };
      plans.push(newPlan);
      updated = plans;
    }
    this.setCollection('TW_PLANS', updated);

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('plans').doc(plan.id).set(plan, { merge: true });
      } catch (e) {
        console.error('Firestore savePlan error:', e);
      }
    }
    this.broadcast('plansChanged', updated);
    return updated;
  }

  async deletePlan(id) {
    const plans = await this.getPlans();
    const filtered = plans.filter(p => p.id !== id);
    this.setCollection('TW_PLANS', filtered);

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('plans').doc(id).delete();
      } catch (e) {
        console.error('Firestore deletePlan error:', e);
      }
    }
    this.broadcast('plansChanged', filtered);
    return filtered;
  }

  // ==========================================
  // USERS & AUTHENTICATION
  // ==========================================
  async getAllUsers() {
    if (this.isFirebaseReady && this.firestore) {
      try {
        const snap = await this.firestore.collection('users').get();
        if (!snap.empty) {
          const map = {};
          snap.forEach(doc => { map[doc.id] = doc.data(); });
          return map;
        }
      } catch (e) {
        console.warn('Firestore getAllUsers error:', e);
      }
    }
    return this.getCollection('TW_USERS', this.defaultState.users);
  }

  async getUser(phone) {
    if (this.isFirebaseReady && this.firestore) {
      try {
        const doc = await this.firestore.collection('users').doc(phone).get();
        if (doc.exists) return doc.data();
      } catch (e) {
        console.warn('Firestore getUser error:', e);
      }
    }
    const users = this.getCollection('TW_USERS', this.defaultState.users);
    return users[phone] || null;
  }

  async registerUser({ name, phone, password }) {
    const users = await this.getAllUsers();
    if (users[phone]) {
      throw new Error('এই ফোন নম্বর দিয়ে ইতিমধ্যে অ্যাকাউন্ট রয়েছে।');
    }

    const referCode = (name.replace(/\s+/g, '').toUpperCase().slice(0, 5) || 'USER') + '-' + Math.floor(1000 + Math.random() * 9000);
    const newUser = {
      id: 'usr_' + Date.now(),
      name,
      phone,
      password,
      balance: 100.00,
      totalDeposit: 0,
      totalWithdraw: 0,
      activePlan: null,
      status: 'active',
      referCode,
      joinedAt: new Date().toISOString()
    };

    users[phone] = newUser;
    this.setCollection('TW_USERS', users);

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('users').doc(phone).set(newUser);
      } catch (e) {
        console.error('Firestore registerUser error:', e);
      }
    }

    await this.addTransaction({
      userId: phone,
      name: 'Signup Bonus',
      amount: 100,
      type: 'plus',
      status: 'approved'
    });

    this.broadcast('userRegistered', newUser);
    return newUser;
  }

  async loginUser({ phone, password }) {
    const user = await this.getUser(phone);
    if (!user) {
      throw new Error('ফোন নম্বরটি সঠিক নয় অথবা অ্যাকাউন্ট নেই।');
    }
    if (user.status === 'banned') {
      throw new Error('আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।');
    }
    if (user.password !== password) {
      throw new Error('ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।');
    }
    return user;
  }

  async updateUser(phone, updates) {
    const users = await this.getAllUsers();
    if (!users[phone]) return null;

    const updatedUser = { ...users[phone], ...updates };
    users[phone] = updatedUser;
    this.setCollection('TW_USERS', users);

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('users').doc(phone).update(updates);
      } catch (e) {
        console.error('Firestore updateUser error:', e);
      }
    }

    this.broadcast('userUpdated', { phone, user: updatedUser });
    return updatedUser;
  }

  // ==========================================
  // DEPOSITS (User Request & Admin Approve/Reject)
  // ==========================================
  async getAllDeposits() {
    if (this.isFirebaseReady && this.firestore) {
      try {
        const snap = await this.firestore.collection('deposits').orderBy('createdAt', 'desc').get();
        if (!snap.empty) {
          const list = [];
          snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
          return list;
        }
      } catch (e) {
        console.warn('Firestore getAllDeposits error:', e);
      }
    }
    return this.getCollection('TW_DEPOSITS', this.defaultState.deposits);
  }

  async getUserDeposits(phone) {
    const all = await this.getAllDeposits();
    return all.filter(d => d.userId === phone || d.userPhone === phone);
  }

  async submitDepositRequest({ userPhone, userName, method, accountNumber, amount, trxId, senderPhone = '' }) {
    const deposits = await this.getAllDeposits();
    
    const duplicate = deposits.find(d => d.trxId.toLowerCase() === trxId.trim().toLowerCase() && d.status !== 'rejected');
    if (duplicate) {
      throw new Error('এই ট্রানজেকশন আইডি (TrxID) দিয়ে ইতিমধ্যে রিকোয়েস্ট রয়েছে।');
    }

    const newDeposit = {
      id: 'dep_' + Date.now(),
      userId: userPhone,
      userName: userName || 'User',
      userPhone: userPhone,
      method: method,
      accountNumber: accountNumber || '',
      amount: parseFloat(amount),
      trxId: trxId.trim(),
      senderPhone: senderPhone.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      rejectReason: ''
    };

    deposits.unshift(newDeposit);
    this.setCollection('TW_DEPOSITS', deposits);

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('deposits').doc(newDeposit.id).set(newDeposit);
      } catch (e) {
        console.error('Firestore submitDepositRequest error:', e);
      }
    }

    await this.addTransaction({
      userId: userPhone,
      name: `Deposit (${method})`,
      amount: parseFloat(amount),
      type: 'plus',
      status: 'pending',
      trxId: trxId.trim(),
      refId: newDeposit.id
    });

    this.broadcast('depositCreated', newDeposit);
    return newDeposit;
  }

  async approveDeposit(depositId) {
    const deposits = await this.getAllDeposits();
    const deposit = deposits.find(d => d.id === depositId);
    if (!deposit) throw new Error('ডিপোজিট রিকোয়েস্ট পাওয়া যায়নি।');
    if (deposit.status === 'approved') throw new Error('এই ডিপোজিটটি আগেই অনুমোদিত হয়েছে।');

    deposit.status = 'approved';
    deposit.approvedAt = new Date().toISOString();
    this.setCollection('TW_DEPOSITS', deposits);

    const user = await this.getUser(deposit.userPhone || deposit.userId);
    if (user) {
      const newBal = (parseFloat(user.balance) || 0) + parseFloat(deposit.amount);
      const newTotalDep = (parseFloat(user.totalDeposit) || 0) + parseFloat(deposit.amount);
      await this.updateUser(user.phone, { balance: newBal, totalDeposit: newTotalDep });
    }

    const txs = await this.getAllTransactions();
    const tx = txs.find(t => t.refId === depositId || (t.trxId === deposit.trxId && t.userId === deposit.userPhone));
    if (tx) {
      tx.status = 'approved';
      this.setCollection('TW_TRANSACTIONS', txs);
    }

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('deposits').doc(depositId).update({
          status: 'approved',
          approvedAt: deposit.approvedAt
        });
      } catch (e) {
        console.error('Firestore approveDeposit error:', e);
      }
    }

    this.broadcast('depositApproved', { depositId, deposit, userPhone: deposit.userPhone });
    return deposit;
  }

  async rejectDeposit(depositId, reason = '') {
    const deposits = await this.getAllDeposits();
    const deposit = deposits.find(d => d.id === depositId);
    if (!deposit) throw new Error('ডিপোজিট রিকোয়েস্ট পাওয়া যায়নি।');
    if (deposit.status === 'approved') throw new Error('অনুমোদিত ডিপোজিট রিজেক্ট করা যাবে না।');

    deposit.status = 'rejected';
    deposit.rejectReason = reason || 'ভুল TrxID বা পেমেন্ট পাওয়া যায়নি';
    deposit.rejectedAt = new Date().toISOString();
    this.setCollection('TW_DEPOSITS', deposits);

    const txs = await this.getAllTransactions();
    const tx = txs.find(t => t.refId === depositId || (t.trxId === deposit.trxId && t.userId === deposit.userPhone));
    if (tx) {
      tx.status = 'rejected';
      this.setCollection('TW_TRANSACTIONS', txs);
    }

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('deposits').doc(depositId).update({
          status: 'rejected',
          rejectReason: deposit.rejectReason,
          rejectedAt: deposit.rejectedAt
        });
      } catch (e) {
        console.error('Firestore rejectDeposit error:', e);
      }
    }

    this.broadcast('depositRejected', { depositId, deposit, userPhone: deposit.userPhone });
    return deposit;
  }

  // ==========================================
  // WITHDRAWALS
  // ==========================================
  async getAllWithdrawals() {
    if (this.isFirebaseReady && this.firestore) {
      try {
        const snap = await this.firestore.collection('withdrawals').orderBy('createdAt', 'desc').get();
        if (!snap.empty) {
          const list = [];
          snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
          return list;
        }
      } catch (e) {
        console.warn('Firestore getAllWithdrawals error:', e);
      }
    }
    return this.getCollection('TW_WITHDRAWALS', this.defaultState.withdrawals);
  }

  async submitWithdrawal({ userPhone, userName, method, targetAccount, amount }) {
    const user = await this.getUser(userPhone);
    if (!user) throw new Error('ইউজার পাওয়া যায়নি।');
    const amt = parseFloat(amount);
    if (amt > user.balance) throw new Error('অপর্যাপ্ত ব্যালেন্স।');

    const newBal = user.balance - amt;
    await this.updateUser(userPhone, { balance: newBal });

    const withdrawals = await this.getAllWithdrawals();
    const newWithdrawal = {
      id: 'wd_' + Date.now(),
      userId: userPhone,
      userName: userName || user.name,
      userPhone: userPhone,
      method,
      targetAccount,
      amount: amt,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    withdrawals.unshift(newWithdrawal);
    this.setCollection('TW_WITHDRAWALS', withdrawals);

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('withdrawals').doc(newWithdrawal.id).set(newWithdrawal);
      } catch (e) {
        console.error('Firestore submitWithdrawal error:', e);
      }
    }

    await this.addTransaction({
      userId: userPhone,
      name: `Withdraw (${method} - ${targetAccount})`,
      amount: amt,
      type: 'minus',
      status: 'pending',
      refId: newWithdrawal.id
    });

    this.broadcast('withdrawalCreated', newWithdrawal);
    return newWithdrawal;
  }

  async approveWithdrawal(withdrawalId) {
    const list = await this.getAllWithdrawals();
    const item = list.find(w => w.id === withdrawalId);
    if (!item) throw new Error('উইথড্র রিকোয়েস্ট পাওয়া যায়নি।');

    item.status = 'approved';
    item.approvedAt = new Date().toISOString();
    this.setCollection('TW_WITHDRAWALS', list);

    const user = await this.getUser(item.userPhone);
    if (user) {
      const tot = (parseFloat(user.totalWithdraw) || 0) + parseFloat(item.amount);
      await this.updateUser(user.phone, { totalWithdraw: tot });
    }

    const txs = await this.getAllTransactions();
    const tx = txs.find(t => t.refId === withdrawalId);
    if (tx) {
      tx.status = 'approved';
      this.setCollection('TW_TRANSACTIONS', txs);
    }

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('withdrawals').doc(withdrawalId).update({
          status: 'approved',
          approvedAt: item.approvedAt
        });
      } catch (e) {
        console.error('Firestore approveWithdrawal error:', e);
      }
    }

    this.broadcast('withdrawalApproved', { withdrawalId, item });
    return item;
  }

  async rejectWithdrawal(withdrawalId, reason = '') {
    const list = await this.getAllWithdrawals();
    const item = list.find(w => w.id === withdrawalId);
    if (!item) throw new Error('উইথড্র রিকোয়েস্ট পাওয়া যায়নি।');
    if (item.status === 'approved') throw new Error('অনুমোদিত উইথড্র রিজেক্ট করা যাবে না।');

    item.status = 'rejected';
    item.rejectReason = reason || 'ভুল একাউন্ট নম্বর বা উইথড্র তথ্য';
    this.setCollection('TW_WITHDRAWALS', list);

    const user = await this.getUser(item.userPhone);
    if (user) {
      const refunded = (parseFloat(user.balance) || 0) + parseFloat(item.amount);
      await this.updateUser(user.phone, { balance: refunded });
    }

    const txs = await this.getAllTransactions();
    const tx = txs.find(t => t.refId === withdrawalId);
    if (tx) {
      tx.status = 'rejected';
      this.setCollection('TW_TRANSACTIONS', txs);
    }

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('withdrawals').doc(withdrawalId).update({
          status: 'rejected',
          rejectReason: item.rejectReason
        });
      } catch (e) {
        console.error('Firestore rejectWithdrawal error:', e);
      }
    }

    this.broadcast('withdrawalRejected', { withdrawalId, item, userPhone: item.userPhone });
    return item;
  }

  // ==========================================
  // TRANSACTIONS & STATEMENTS
  // ==========================================
  async getAllTransactions() {
    if (this.isFirebaseReady && this.firestore) {
      try {
        const snap = await this.firestore.collection('transactions').orderBy('createdAt', 'desc').limit(100).get();
        if (!snap.empty) {
          const list = [];
          snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
          return list;
        }
      } catch (e) {
        console.warn('Firestore getAllTransactions error:', e);
      }
    }
    return this.getCollection('TW_TRANSACTIONS', this.defaultState.transactions);
  }

  async getUserTransactions(phone) {
    const all = await this.getAllTransactions();
    return all.filter(t => t.userId === phone);
  }

  async addTransaction({ userId, name, amount, type, status = 'approved', trxId = '', refId = '' }) {
    const txs = await this.getAllTransactions();
    const newTx = {
      id: 'tx_' + Date.now(),
      userId,
      name,
      amount: parseFloat(amount),
      type,
      status,
      trxId,
      refId,
      createdAt: new Date().toISOString()
    };

    txs.unshift(newTx);
    if (txs.length > 300) txs.pop();
    this.setCollection('TW_TRANSACTIONS', txs);

    if (this.isFirebaseReady && this.firestore) {
      try {
        await this.firestore.collection('transactions').doc(newTx.id).set(newTx);
      } catch (e) {
        console.error('Firestore addTransaction error:', e);
      }
    }

    this.broadcast('transactionAdded', newTx);
    return newTx;
  }

  // ==========================================
  // REAL-TIME FIRESTORE LISTENERS
  // ==========================================
  setupFirestoreRealtimeListeners() {
    if (!this.isFirebaseReady || !this.firestore) return;

    // Listen for deposits changes
    this.firestore.collection('deposits').onSnapshot(snap => {
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      this.setCollection('TW_DEPOSITS', list);
      this.notify('depositsRealtime', list);
    }, err => console.warn('Deposits listener error:', err));

    // Listen for users changes
    this.firestore.collection('users').onSnapshot(snap => {
      const map = {};
      snap.forEach(doc => { map[doc.id] = doc.data(); });
      this.setCollection('TW_USERS', map);
      this.notify('usersRealtime', map);
    }, err => console.warn('Users listener error:', err));

    // Listen for withdrawals changes
    this.firestore.collection('withdrawals').onSnapshot(snap => {
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      this.setCollection('TW_WITHDRAWALS', list);
      this.notify('withdrawalsRealtime', list);
    }, err => console.warn('Withdrawals listener error:', err));

    // Listen for admin credentials changes
    this.firestore.collection('config').doc('adminCredentials').onSnapshot(doc => {
      if (doc.exists) {
        const creds = doc.data();
        this.setCollection('TW_ADMIN_CREDENTIALS', creds);
        this.notify('adminCredentialsUpdated', creds);
      }
    }, err => console.warn('Admin credentials listener error:', err));

    // Listen for settings changes
    this.firestore.collection('config').doc('settings').onSnapshot(doc => {
      if (doc.exists) {
        const s = { ...this.defaultState.settings, ...doc.data() };
        this.setCollection('TW_SETTINGS', s);
        this.notify('settingsRealtime', s);
      }
    }, err => console.warn('Settings listener error:', err));

    // Listen for payment methods changes
    this.firestore.collection('paymentMethods').onSnapshot(snap => {
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      if (list.length > 0) {
        this.setCollection('TW_PAYMENT_METHODS', list);
        this.notify('paymentMethodsRealtime', list);
      }
    }, err => console.warn('Payment methods listener error:', err));

    // Listen for plans changes
    this.firestore.collection('plans').onSnapshot(snap => {
      const list = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      if (list.length > 0) {
        this.setCollection('TW_PLANS', list);
        this.notify('plansRealtime', list);
      }
    }, err => console.warn('Plans listener error:', err));
  }
}

// Instantiate global singleton
window.DB = new DatabaseService();

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  const connected = await window.DB.initFirebase();
  if (connected) {
    window.DB.setupFirestoreRealtimeListeners();
  }
});
