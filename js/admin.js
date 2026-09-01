/* ==========================================================================
   admin.js — Task Wallet admin dashboard
   Reads and writes through window.DB (js/db.js).
   ========================================================================== */

let adminUser   = null;
let currentTab  = 'dashboard';

let users = [], deposits = [], withdrawals = [], transactions = [];
let methods = [], plans = [], appCfg = {};

let depFilter = 'pending';
let wdFilter  = 'pending';
let userQuery = '';
let txQuery   = '';

/* ------------------------------------------------------------------ util */

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function money(n){ return Number(n || 0).toFixed(2); }
function tk(n){ return '৳' + Number(n || 0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }

function dt(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'}) +
         ' ' + d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
}
function isToday(iso){
  if(!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._tt);
  window._tt = setTimeout(()=>t.classList.remove('show'), 2600);
}

function openModal(title, bodyHtml, footHtml){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFoot').innerHTML = footHtml || '';
  document.getElementById('modalBg').classList.add('open');
}
function closeModal(){ document.getElementById('modalBg').classList.remove('open'); }
document.getElementById('modalBg').addEventListener('click', e => {
  if(e.target.id === 'modalBg') closeModal();
});

/* ====================================================== LOGIN / BOOT ==== */

async function bootAdmin(){
  const mode = await DB.init();
  const chip = document.getElementById('modeChip');
  if(mode === 'firestore'){
    chip.textContent = '● LIVE';
    chip.className = 'mode-chip live';
    document.getElementById('loginModeSub').textContent = 'Connected to Firebase — live data';
  } else {
    chip.textContent = '⚠ DEMO MODE';
    chip.className = 'mode-chip demo';
    document.getElementById('loginModeSub').textContent = 'Demo mode — add Firebase keys to go live';
  }

  const b = window.ADMIN_BOOTSTRAP || {};
  document.getElementById('admHint').innerHTML =
    'Default login: <b>' + esc(b.username || 'admin') + '</b> / <b>' + esc(b.password || 'admin123') +
    '</b><br>Change these in <b>firebase-config.js</b> before going live.';

  const sess = DB.getAdminSession();
  if(sess){ startSession(sess); }

  document.getElementById('admPass').addEventListener('keydown', e => {
    if(e.key === 'Enter') adminLogin();
  });
}

async function adminLogin(){
  const u = document.getElementById('admUser').value.trim();
  const p = document.getElementById('admPass').value;
  const err = document.getElementById('admError');
  const btn = document.getElementById('admLoginBtn');
  if(!u || !p){ err.textContent = 'Enter username and password'; return; }

  btn.disabled = true; btn.textContent = 'Signing in...';
  try{
    const admin = await DB.adminLogin(u, p);
    DB.setAdminSession(admin);
    err.textContent = '';
    startSession(admin);
  }catch(e){
    err.textContent = e.message || 'Login failed';
  }finally{
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

function adminLogout(){
  DB.clearAdminSession();
  location.reload();
}

function startSession(admin){
  adminUser = admin;
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('shell').classList.remove('hidden');
  document.getElementById('whoAmI').textContent = 'Signed in as ' + admin.username;
  subscribeAll();
}

/* ================================================== LIVE SUBSCRIPTIONS == */

function subscribeAll(){
  DB.watchUsers(d       => { users = d;        refresh(); });
  DB.watchDeposits(d    => { deposits = d;     refresh(); });
  DB.watchWithdrawals(d => { withdrawals = d;  refresh(); });
  DB.watchTransactions(d=> { transactions = d; refresh(); });
  DB.watchConfigDoc('app',     c => { if(c){ appCfg = c; document.getElementById('brandAppName').textContent = c.appName || 'Task Wallet'; refresh(); } });
  DB.watchConfigDoc('methods', c => { if(c){ methods = c.items || []; refresh(); } });
  DB.watchConfigDoc('plans',   c => { if(c){ plans   = c.items || []; refresh(); } });
}

function refresh(){
  const pd = deposits.filter(d => d.status === 'pending').length;
  const pw = withdrawals.filter(w => w.status === 'pending').length;
  const bd = document.getElementById('badgeDep');
  const bw = document.getElementById('badgeWd');
  bd.textContent = pd; bd.classList.toggle('hidden', pd === 0);
  bw.textContent = pw; bw.classList.toggle('hidden', pw === 0);
  render();
}

/* ========================================================= NAVIGATION == */

const TITLES = {
  dashboard:'Dashboard', deposits:'Deposit Requests', withdrawals:'Withdrawal Requests',
  users:'Registered Users', methods:'Deposit Methods', plans:'Task Plans',
  content:'Content & Settings', transactions:'All Transactions'
};

function go(tab){
  currentTab = tab;
  document.querySelectorAll('.side-item').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('pageTitle').textContent = TITLES[tab] || tab;
  render();
}

function render(){
  const el = document.getElementById('content');
  if(!adminUser) return;
  ({
    dashboard: renderDashboard,
    deposits: renderDeposits,
    withdrawals: renderWithdrawals,
    users: renderUsers,
    methods: renderMethods,
    plans: renderPlans,
    content: renderContent,
    transactions: renderTransactions
  }[currentTab] || renderDashboard)(el);
}

function emptyState(icon, msg){
  return `<div class="empty"><span class="big">${icon}</span>${esc(msg)}</div>`;
}

function userName(uid){
  const u = users.find(x => x.id === uid);
  return u ? u.name : '(deleted user)';
}

/* ========================================================= DASHBOARD === */

function renderDashboard(el){
  const totalBal   = users.reduce((s,u)=>s+Number(u.balance||0),0);
  const pendDep    = deposits.filter(d=>d.status==='pending');
  const pendWd     = withdrawals.filter(w=>w.status==='pending');
  const apprDep    = deposits.filter(d=>d.status==='approved');
  const apprWd     = withdrawals.filter(w=>w.status==='approved');
  const depToday   = apprDep.filter(d=>isToday(d.reviewedAt)).reduce((s,d)=>s+Number(d.amount),0);
  const newToday   = users.filter(u=>isToday(u.createdAt)).length;
  const blocked    = users.filter(u=>u.status==='blocked').length;

  const recent = deposits.slice()
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6);

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="lab">Total Users</div>
        <div class="val">${users.length}</div>
        <div class="sub">${newToday} joined today${blocked ? ' · ' + blocked + ' blocked' : ''}</div>
      </div>
      <div class="stat-card ${pendDep.length ? 'alert' : ''}">
        <div class="lab">Pending Deposits</div>
        <div class="val">${pendDep.length}</div>
        <div class="sub">${tk(pendDep.reduce((s,d)=>s+Number(d.amount),0))} waiting</div>
      </div>
      <div class="stat-card ${pendWd.length ? 'alert' : ''}">
        <div class="lab">Pending Withdrawals</div>
        <div class="val">${pendWd.length}</div>
        <div class="sub">${tk(pendWd.reduce((s,w)=>s+Number(w.amount),0))} waiting</div>
      </div>
      <div class="stat-card">
        <div class="lab">Balance in System</div>
        <div class="val">${tk(totalBal)}</div>
        <div class="sub">across all user wallets</div>
      </div>
      <div class="stat-card good">
        <div class="lab">Approved Deposits</div>
        <div class="val">${tk(apprDep.reduce((s,d)=>s+Number(d.amount),0))}</div>
        <div class="sub">${tk(depToday)} approved today</div>
      </div>
      <div class="stat-card">
        <div class="lab">Paid Out</div>
        <div class="val">${tk(apprWd.reduce((s,w)=>s+Number(w.amount),0))}</div>
        <div class="sub">${apprWd.length} withdrawals completed</div>
      </div>
    </div>

    ${pendDep.length ? `<div class="note warn">
      ⏳ <b>${pendDep.length} deposit request${pendDep.length>1?'s are':' is'} waiting for review.</b>
      <a href="#" onclick="go('deposits');return false;" style="color:#92400e;font-weight:800;">Review now →</a>
    </div>` : ''}

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">Latest Deposit Requests</div>
        <button class="btn sm grey" onclick="go('deposits')">View all</button>
      </div>
      <div class="panel-body flush">
        ${recent.length ? `<div class="tbl-wrap"><table>
          <thead><tr><th>User</th><th>Amount</th><th>Method</th><th>TrxID</th><th>Status</th><th>Time</th></tr></thead>
          <tbody>${recent.map(d=>`
            <tr>
              <td><div class="cell-name">${esc(d.name)}</div><div class="cell-sub">${esc(d.phone)}</div></td>
              <td class="amt plus">${tk(d.amount)}</td>
              <td>${esc(d.method)}</td>
              <td><span class="mono">${esc(d.trxId)}</span></td>
              <td><span class="badge ${d.status}">${d.status.toUpperCase()}</span></td>
              <td class="cell-sub">${dt(d.createdAt)}</td>
            </tr>`).join('')}
          </tbody></table></div>` : emptyState('📭','No deposit requests yet.')}
      </div>
    </div>`;
}

/* ========================================================== DEPOSITS === */

function setDepFilter(f){ depFilter = f; render(); }

function renderDeposits(el){
  const list = deposits
    .filter(d => depFilter === 'all' ? true : d.status === depFilter)
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  const count = s => deposits.filter(d=>d.status===s).length;

  el.innerHTML = `
    <div class="note">
      ✅ <b>Approve</b> credits the amount to the user's balance instantly and marks their
      history row APPROVED. <b>Reject</b> asks you for a reason, which the user sees in their history.
      Always confirm the TrxID in your bKash/Nagad/bank app before approving.
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">Deposit Requests</div>
        <div class="filter-row">
          <button class="chip ${depFilter==='pending'?'active':''}"  onclick="setDepFilter('pending')">Pending (${count('pending')})</button>
          <button class="chip ${depFilter==='approved'?'active':''}" onclick="setDepFilter('approved')">Approved (${count('approved')})</button>
          <button class="chip ${depFilter==='rejected'?'active':''}" onclick="setDepFilter('rejected')">Rejected (${count('rejected')})</button>
          <button class="chip ${depFilter==='all'?'active':''}"      onclick="setDepFilter('all')">All (${deposits.length})</button>
        </div>
      </div>
      <div class="panel-body flush">
        ${list.length ? `<div class="tbl-wrap"><table>
          <thead><tr>
            <th>User</th><th>Amount</th><th>Method</th><th>Transaction ID</th>
            <th>Requested</th><th>Status</th><th style="text-align:right;">Action</th>
          </tr></thead>
          <tbody>${list.map(d=>`
            <tr>
              <td><div class="cell-name">${esc(d.name)}</div><div class="cell-sub">${esc(d.phone)}</div></td>
              <td class="amt plus">${tk(d.amount)}</td>
              <td>${esc(d.method)}<div class="cell-sub">${esc(d.address||'')}</div></td>
              <td><span class="mono">${esc(d.trxId)}</span></td>
              <td class="cell-sub">${dt(d.createdAt)}</td>
              <td>
                <span class="badge ${d.status}">${d.status.toUpperCase()}</span>
                ${d.note ? `<div class="cell-sub">${esc(d.note)}</div>` : ''}
                ${d.reviewedBy ? `<div class="cell-sub">by ${esc(d.reviewedBy)}</div>` : ''}
              </td>
              <td>
                <div class="row-actions" style="justify-content:flex-end;">
                  ${d.status==='pending' ? `
                    <button class="btn sm green" onclick="doApproveDeposit('${d.id}')">✓ Approve</button>
                    <button class="btn sm red"   onclick="askRejectDeposit('${d.id}')">✕ Reject</button>`
                  : `<button class="btn sm grey" onclick="viewDeposit('${d.id}')">Details</button>`}
                </div>
              </td>
            </tr>`).join('')}
          </tbody></table></div>`
        : emptyState('📭', depFilter==='pending' ? 'No pending deposit requests. All caught up!' : 'Nothing here.')}
      </div>
    </div>`;
}

async function doApproveDeposit(id){
  const d = deposits.find(x=>x.id===id);
  if(!d) return;
  openModal('Approve Deposit', `
    <div class="note">Confirm you have received this payment before approving.</div>
    <div class="kv"><span class="k">User</span><span class="v">${esc(d.name)} (${esc(d.phone)})</span></div>
    <div class="kv"><span class="k">Amount</span><span class="v" style="color:var(--green);">${tk(d.amount)}</span></div>
    <div class="kv"><span class="k">Method</span><span class="v">${esc(d.method)}</span></div>
    <div class="kv"><span class="k">Sent to</span><span class="v">${esc(d.address||'—')}</span></div>
    <div class="kv"><span class="k">Transaction ID</span><span class="v">${esc(d.trxId)}</span></div>
    <div class="kv"><span class="k">Requested</span><span class="v">${dt(d.createdAt)}</span></div>
  `, `
    <button class="btn grey" onclick="closeModal()">Cancel</button>
    <button class="btn green" onclick="confirmApproveDeposit('${d.id}')">✓ Approve &amp; credit ${tk(d.amount)}</button>
  `);
}

async function confirmApproveDeposit(id){
  try{
    await DB.approveDeposit(id, adminUser.username);
    closeModal();
    toast('✅ Deposit approved and balance credited');
  }catch(e){ toast(e.message || 'Failed to approve'); }
}

function askRejectDeposit(id){
  const d = deposits.find(x=>x.id===id);
  if(!d) return;
  openModal('Reject Deposit', `
    <div class="note danger">The user will see this reason in their transaction history. No balance will be credited.</div>
    <div class="kv"><span class="k">User</span><span class="v">${esc(d.name)}</span></div>
    <div class="kv"><span class="k">Amount</span><span class="v">${tk(d.amount)}</span></div>
    <div class="kv"><span class="k">TrxID</span><span class="v">${esc(d.trxId)}</span></div>
    <div class="field" style="margin-top:16px;">
      <label>Reason for rejection</label>
      <select id="rejPreset" onchange="document.getElementById('rejReason').value=this.value">
        <option value="">— choose or type below —</option>
        <option value="ভুল Transaction ID">ভুল Transaction ID</option>
        <option value="কোনো পেমেন্ট পাওয়া যায়নি">কোনো পেমেন্ট পাওয়া যায়নি</option>
        <option value="পাঠানো পরিমাণ মিলছে না">পাঠানো পরিমাণ মিলছে না</option>
        <option value="এই TrxID আগে ব্যবহার হয়েছে">এই TrxID আগে ব্যবহার হয়েছে</option>
      </select>
    </div>
    <div class="field">
      <label>Message to user</label>
      <textarea id="rejReason" rows="3" placeholder="Explain why this was rejected..."></textarea>
    </div>
  `, `
    <button class="btn grey" onclick="closeModal()">Cancel</button>
    <button class="btn red" onclick="confirmRejectDeposit('${d.id}')">Reject request</button>
  `);
}

async function confirmRejectDeposit(id){
  const reason = document.getElementById('rejReason').value.trim();
  if(!reason){ toast('Please give a reason'); return; }
  try{
    await DB.rejectDeposit(id, reason, adminUser.username);
    closeModal();
    toast('Deposit rejected');
  }catch(e){ toast(e.message || 'Failed'); }
}

function viewDeposit(id){
  const d = deposits.find(x=>x.id===id);
  if(!d) return;
  openModal('Deposit Details', `
    <div class="kv"><span class="k">User</span><span class="v">${esc(d.name)} (${esc(d.phone)})</span></div>
    <div class="kv"><span class="k">Amount</span><span class="v">${tk(d.amount)}</span></div>
    <div class="kv"><span class="k">Method</span><span class="v">${esc(d.method)}</span></div>
    <div class="kv"><span class="k">Address</span><span class="v">${esc(d.address||'—')}</span></div>
    <div class="kv"><span class="k">TrxID</span><span class="v">${esc(d.trxId)}</span></div>
    <div class="kv"><span class="k">Status</span><span class="v">${d.status.toUpperCase()}</span></div>
    <div class="kv"><span class="k">Requested</span><span class="v">${dt(d.createdAt)}</span></div>
    <div class="kv"><span class="k">Reviewed</span><span class="v">${dt(d.reviewedAt)} ${d.reviewedBy?('by '+esc(d.reviewedBy)):''}</span></div>
    ${d.note ? `<div class="kv"><span class="k">Reason</span><span class="v">${esc(d.note)}</span></div>` : ''}
  `, `<button class="btn grey" onclick="closeModal()">Close</button>`);
}

/* ======================================================= WITHDRAWALS === */

function setWdFilter(f){ wdFilter = f; render(); }

function renderWithdrawals(el){
  const list = withdrawals
    .filter(w => wdFilter === 'all' ? true : w.status === wdFilter)
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const count = s => withdrawals.filter(w=>w.status===s).length;

  el.innerHTML = `
    <div class="note warn">
      💸 The amount is already <b>held</b> (deducted) from the user's balance when they request it.
      <b>Approve</b> after you have sent the money. <b>Reject</b> refunds it back to their wallet automatically.
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">Withdrawal Requests</div>
        <div class="filter-row">
          <button class="chip ${wdFilter==='pending'?'active':''}"  onclick="setWdFilter('pending')">Pending (${count('pending')})</button>
          <button class="chip ${wdFilter==='approved'?'active':''}" onclick="setWdFilter('approved')">Paid (${count('approved')})</button>
          <button class="chip ${wdFilter==='rejected'?'active':''}" onclick="setWdFilter('rejected')">Rejected (${count('rejected')})</button>
          <button class="chip ${wdFilter==='all'?'active':''}"      onclick="setWdFilter('all')">All (${withdrawals.length})</button>
        </div>
      </div>
      <div class="panel-body flush">
        ${list.length ? `<div class="tbl-wrap"><table>
          <thead><tr>
            <th>User</th><th>Amount</th><th>Method</th><th>Send To</th>
            <th>Requested</th><th>Status</th><th style="text-align:right;">Action</th>
          </tr></thead>
          <tbody>${list.map(w=>`
            <tr>
              <td><div class="cell-name">${esc(w.name)}</div><div class="cell-sub">${esc(w.phone)}</div></td>
              <td class="amt minus">${tk(w.amount)}</td>
              <td>${esc(w.method)}</td>
              <td><span class="mono">${esc(w.accountNumber)}</span></td>
              <td class="cell-sub">${dt(w.createdAt)}</td>
              <td>
                <span class="badge ${w.status}">${w.status==='approved'?'PAID':w.status.toUpperCase()}</span>
                ${w.note ? `<div class="cell-sub">${esc(w.note)}</div>` : ''}
              </td>
              <td>
                <div class="row-actions" style="justify-content:flex-end;">
                  ${w.status==='pending' ? `
                    <button class="btn sm green" onclick="askApproveWd('${w.id}')">✓ Mark Paid</button>
                    <button class="btn sm red"   onclick="askRejectWd('${w.id}')">✕ Reject</button>` : '—'}
                </div>
              </td>
            </tr>`).join('')}
          </tbody></table></div>`
        : emptyState('💸', wdFilter==='pending' ? 'No pending withdrawals.' : 'Nothing here.')}
      </div>
    </div>`;
}

function askApproveWd(id){
  const w = withdrawals.find(x=>x.id===id);
  if(!w) return;
  openModal('Confirm Payout', `
    <div class="note warn">Only confirm after you have actually sent the money.</div>
    <div class="kv"><span class="k">User</span><span class="v">${esc(w.name)} (${esc(w.phone)})</span></div>
    <div class="kv"><span class="k">Send</span><span class="v" style="color:var(--red);">${tk(w.amount)}</span></div>
    <div class="kv"><span class="k">Via</span><span class="v">${esc(w.method)}</span></div>
    <div class="kv"><span class="k">To number</span><span class="v">${esc(w.accountNumber)}</span></div>
  `, `
    <button class="btn grey" onclick="closeModal()">Cancel</button>
    <button class="btn green" onclick="confirmApproveWd('${w.id}')">✓ I have paid — mark complete</button>
  `);
}
async function confirmApproveWd(id){
  try{
    await DB.approveWithdrawal(id, adminUser.username);
    closeModal(); toast('✅ Withdrawal marked as paid');
  }catch(e){ toast(e.message || 'Failed'); }
}

function askRejectWd(id){
  const w = withdrawals.find(x=>x.id===id);
  if(!w) return;
  openModal('Reject Withdrawal', `
    <div class="note danger">${tk(w.amount)} will be refunded to ${esc(w.name)}'s balance immediately.</div>
    <div class="field">
      <label>Reason</label>
      <textarea id="wdReason" rows="3" placeholder="Why is this rejected?"></textarea>
    </div>
  `, `
    <button class="btn grey" onclick="closeModal()">Cancel</button>
    <button class="btn red" onclick="confirmRejectWd('${w.id}')">Reject &amp; refund</button>
  `);
}
async function confirmRejectWd(id){
  const reason = document.getElementById('wdReason').value.trim();
  if(!reason){ toast('Please give a reason'); return; }
  try{
    await DB.rejectWithdrawal(id, reason, adminUser.username);
    closeModal(); toast('Rejected and refunded');
  }catch(e){ toast(e.message || 'Failed'); }
}

/* ============================================================= USERS === */

function setUserQuery(v){ userQuery = v.toLowerCase(); render(); }

function renderUsers(el){
  const list = users
    .filter(u => !userQuery ||
      (u.name||'').toLowerCase().includes(userQuery) ||
      (u.phone||'').includes(userQuery) ||
      (u.referralCode||'').toLowerCase().includes(userQuery))
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="lab">Total Users</div><div class="val">${users.length}</div></div>
      <div class="stat-card good"><div class="lab">Active</div><div class="val">${users.filter(u=>u.status!=='blocked').length}</div></div>
      <div class="stat-card"><div class="lab">Blocked</div><div class="val">${users.filter(u=>u.status==='blocked').length}</div></div>
      <div class="stat-card"><div class="lab">Total Wallet Balance</div><div class="val">${tk(users.reduce((s,u)=>s+Number(u.balance||0),0))}</div></div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">All Registered Users</div>
        <input class="search-input" placeholder="Search name, phone or referral code..."
               value="${esc(userQuery)}" oninput="setUserQuery(this.value)">
      </div>
      <div class="panel-body flush">
        ${list.length ? `<div class="tbl-wrap"><table>
          <thead><tr>
            <th>Name</th><th>Phone</th><th>Balance</th><th>Plan</th>
            <th>Deposited</th><th>Withdrawn</th><th>Joined</th><th>Status</th>
            <th style="text-align:right;">Actions</th>
          </tr></thead>
          <tbody>${list.map(u=>`
            <tr>
              <td><div class="cell-name">${esc(u.name)}</div><div class="cell-sub">${esc(u.referralCode||'')}</div></td>
              <td><span class="mono">${esc(u.phone)}</span></td>
              <td class="amt">${tk(u.balance)}</td>
              <td>${u.plan ? esc(u.plan.name) : '<span class="cell-sub">none</span>'}</td>
              <td class="cell-sub">${tk(u.totalDeposit)}</td>
              <td class="cell-sub">${tk(u.totalWithdraw)}</td>
              <td class="cell-sub">${dt(u.createdAt)}</td>
              <td><span class="badge ${u.status==='blocked'?'blocked':'active'}">${(u.status||'active').toUpperCase()}</span></td>
              <td>
                <div class="row-actions" style="justify-content:flex-end;">
                  <button class="btn sm grey"  onclick="viewUser('${u.id}')">View</button>
                  <button class="btn sm"       onclick="askAdjust('${u.id}')">Balance</button>
                  <button class="btn sm ${u.status==='blocked'?'green':'red'}" onclick="toggleBlock('${u.id}')">
                    ${u.status==='blocked'?'Unblock':'Block'}
                  </button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody></table></div>` : emptyState('👥','No registered users yet.')}
      </div>
    </div>`;
}

function viewUser(id){
  const u = users.find(x=>x.id===id);
  if(!u) return;
  const myTx = transactions.filter(t=>t.uid===id)
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,12);
  const myDep = deposits.filter(d=>d.uid===id);
  const myWd  = withdrawals.filter(w=>w.uid===id);

  openModal('User: ' + u.name, `
    <div class="kv"><span class="k">Name</span><span class="v">${esc(u.name)}</span></div>
    <div class="kv"><span class="k">Phone</span><span class="v">${esc(u.phone)}</span></div>
    <div class="kv"><span class="k">Balance</span><span class="v" style="color:var(--green);">${tk(u.balance)}</span></div>
    <div class="kv"><span class="k">Status</span><span class="v">${(u.status||'active').toUpperCase()}</span></div>
    <div class="kv"><span class="k">Referral code</span><span class="v">${esc(u.referralCode||'—')}</span></div>
    <div class="kv"><span class="k">Active plan</span><span class="v">${u.plan?esc(u.plan.name)+' · ৳'+u.plan.rewardPerAd+'/ad':'none'}</span></div>
    <div class="kv"><span class="k">Total deposited</span><span class="v">${tk(u.totalDeposit)}</span></div>
    <div class="kv"><span class="k">Total withdrawn</span><span class="v">${tk(u.totalWithdraw)}</span></div>
    <div class="kv"><span class="k">Deposit requests</span><span class="v">${myDep.length} (${myDep.filter(d=>d.status==='pending').length} pending)</span></div>
    <div class="kv"><span class="k">Withdraw requests</span><span class="v">${myWd.length} (${myWd.filter(w=>w.status==='pending').length} pending)</span></div>
    <div class="kv"><span class="k">Joined</span><span class="v">${dt(u.createdAt)}</span></div>
    <div class="kv"><span class="k">Last login</span><span class="v">${dt(u.lastLogin)}</span></div>
    <div class="kv"><span class="k">Password</span><span class="v" style="font-size:10px;color:var(--muted);">hashed — use Reset</span></div>

    <div style="margin-top:18px;font-weight:800;font-size:13px;">Recent activity</div>
    ${myTx.length ? myTx.map(t=>`
      <div class="kv">
        <span class="k">${esc(t.title)} <span class="badge ${t.status}" style="font-size:9px;">${t.status.toUpperCase()}</span></span>
        <span class="v ${t.type==='plus'?'amt plus':'amt minus'}">${t.type==='plus'?'+':'-'}${tk(t.amount)}</span>
      </div>`).join('') : '<div class="cell-sub" style="padding:8px 0;">No transactions.</div>'}
  `, `
    <button class="btn grey" onclick="askResetPassword('${u.id}')">Reset password</button>
    <button class="btn red"  onclick="askDeleteUser('${u.id}')">Delete</button>
    <button class="btn"      onclick="closeModal()">Close</button>
  `);
}

function askAdjust(id){
  const u = users.find(x=>x.id===id);
  if(!u) return;
  openModal('Adjust Balance — ' + u.name, `
    <div class="note">Current balance: <b>${tk(u.balance)}</b>. Use a positive number to add, a negative number to subtract. The change is recorded in the user's history.</div>
    <div class="field">
      <label>Amount (৳)</label>
      <input type="number" id="adjAmt" placeholder="e.g. 500 or -250" step="0.01">
    </div>
    <div class="field">
      <label>Reason (shown to the user)</label>
      <input type="text" id="adjReason" placeholder="e.g. Bonus credit / correction">
    </div>
  `, `
    <button class="btn grey" onclick="closeModal()">Cancel</button>
    <button class="btn" onclick="confirmAdjust('${u.id}')">Apply change</button>
  `);
}
async function confirmAdjust(id){
  const amt = parseFloat(document.getElementById('adjAmt').value);
  const reason = document.getElementById('adjReason').value.trim();
  if(!amt || isNaN(amt)){ toast('Enter a valid amount'); return; }
  if(!reason){ toast('Enter a reason'); return; }
  try{
    const nb = await DB.adjustBalance(id, amt, reason);
    closeModal(); toast('Balance updated to ' + tk(nb));
  }catch(e){ toast(e.message || 'Failed'); }
}

async function toggleBlock(id){
  const u = users.find(x=>x.id===id);
  if(!u) return;
  const next = u.status === 'blocked' ? 'active' : 'blocked';
  await DB.updateUser(id, { status: next });
  toast(u.name + ' is now ' + next.toUpperCase());
}

function askResetPassword(id){
  const u = users.find(x=>x.id===id);
  openModal('Reset Password — ' + u.name, `
    <div class="note warn">Set a new password and tell the user. The old one stops working immediately.</div>
    <div class="field"><label>New password (min 6 characters)</label>
      <input type="text" id="newPw" placeholder="e.g. wallet2026"></div>
  `, `
    <button class="btn grey" onclick="closeModal()">Cancel</button>
    <button class="btn" onclick="confirmResetPassword('${id}')">Set password</button>
  `);
}
async function confirmResetPassword(id){
  const pw = document.getElementById('newPw').value.trim();
  if(pw.length < 6){ toast('Password must be at least 6 characters'); return; }
  await DB.setUserPassword(id, pw);
  closeModal(); toast('Password reset. New password: ' + pw);
}

function askDeleteUser(id){
  const u = users.find(x=>x.id===id);
  openModal('Delete User', `
    <div class="note danger">
      This permanently deletes <b>${esc(u.name)}</b> (${esc(u.phone)}) and their ${tk(u.balance)} balance.
      Their transaction records stay for your audit trail. This cannot be undone.
    </div>
  `, `
    <button class="btn grey" onclick="closeModal()">Cancel</button>
    <button class="btn red" onclick="confirmDeleteUser('${id}')">Delete permanently</button>
  `);
}
async function confirmDeleteUser(id){
  await DB.deleteUser(id);
  closeModal(); toast('User deleted');
}

/* =================================================== DEPOSIT METHODS === */

function renderMethods(el){
  el.innerHTML = `
    <div class="note">
      🏦 These are the payment options your users see. The <b>address / number</b> here is exactly what
      appears in the deposit popup with a Copy button. Add as many as you like — crypto, mobile banking or bank.
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">Payment Methods (${methods.length})</div>
        <button class="btn sm" onclick="addMethod()">+ Add Method</button>
      </div>
      <div class="panel-body">
        ${methods.length ? methods.map((m,i)=>`
          <div class="method-row">
            <div class="method-row-head">
              <span class="ic">${esc(m.icon||'💳')}</span>
              <span class="nm">${esc(m.name)}</span>
              <label class="toggle">
                <input type="checkbox" id="m_en_${i}" ${m.enabled!==false?'checked':''}> Enabled
              </label>
            </div>
            <div class="grid2">
              <div class="field"><label>Display name</label><input type="text" id="m_name_${i}" value="${esc(m.name)}"></div>
              <div class="field"><label>Icon (emoji)</label><input type="text" id="m_icon_${i}" value="${esc(m.icon||'')}" maxlength="4"></div>
            </div>
            <div class="field">
              <label>Deposit address / number — shown in the user popup</label>
              <input type="text" id="m_addr_${i}" value="${esc(m.address||'')}" placeholder="01XXXXXXXXX or wallet address">
            </div>
            <div class="grid2">
              <div class="field"><label>Type</label>
                <select id="m_type_${i}">
                  <option value="mobile" ${m.type==='mobile'?'selected':''}>Mobile banking</option>
                  <option value="crypto" ${m.type==='crypto'?'selected':''}>Crypto</option>
                  <option value="bank"   ${m.type==='bank'?'selected':''}>Bank</option>
                </select>
              </div>
              <div class="field"><label>Minimum amount (৳)</label>
                <input type="number" id="m_min_${i}" value="${Number(m.minAmount)||0}"></div>
            </div>
            <div class="field">
              <label>Instruction text shown in the popup</label>
              <textarea id="m_ins_${i}" rows="2">${esc(m.instruction||'')}</textarea>
            </div>
            <div class="row-actions">
              <button class="btn sm green" onclick="saveMethod(${i})">Save</button>
              <button class="btn sm red"   onclick="deleteMethod(${i})">Delete</button>
            </div>
          </div>`).join('') : emptyState('🏦','No payment methods. Add one so users can deposit.')}
      </div>
    </div>`;
}

async function saveMethod(i){
  const g = id => document.getElementById(id);
  const name = g('m_name_'+i).value.trim();
  if(!name){ toast('Method needs a name'); return; }
  methods[i] = Object.assign({}, methods[i], {
    name: name,
    icon: g('m_icon_'+i).value.trim() || '💳',
    address: g('m_addr_'+i).value.trim(),
    type: g('m_type_'+i).value,
    minAmount: Number(g('m_min_'+i).value) || 0,
    instruction: g('m_ins_'+i).value.trim(),
    enabled: g('m_en_'+i).checked
  });
  await DB.saveMethods(methods);
  toast(name + ' saved — users see it immediately');
}

async function addMethod(){
  methods.push({
    id: DB.uid('m'), name: 'New Method', icon: '💳', type: 'mobile',
    address: '', enabled: false, minAmount: 500,
    instruction: 'উপরের নাম্বারে টাকা পাঠান, তারপর Transaction ID নিচে লিখুন।'
  });
  await DB.saveMethods(methods);
  toast('Method added — fill in the details and Save');
}

async function deleteMethod(i){
  const n = methods[i].name;
  methods.splice(i,1);
  await DB.saveMethods(methods);
  toast(n + ' deleted');
}

/* ============================================================= PLANS === */

function renderPlans(el){
  el.innerHTML = `
    <div class="note">
      📦 Max possible earning is calculated automatically as
      <b>validity × ads/day × reward/ad</b> — you cannot promise a fixed return.
    </div>
    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">Task Plans (${plans.length})</div>
        <button class="btn sm" onclick="addPlan()">+ Add Plan</button>
      </div>
      <div class="panel-body">
        ${plans.length ? plans.map((p,i)=>{
          const cap = (p.days||0)*(p.adsPerDay||0)*(p.rewardPerAd||0);
          return `
          <div class="method-row">
            <div class="method-row-head"><span class="ic">📦</span><span class="nm">${esc(p.name)}</span></div>
            <div class="grid2">
              <div class="field"><label>Plan name</label><input type="text" id="p_name_${i}" value="${esc(p.name)}"></div>
              <div class="field"><label>Price (৳)</label><input type="number" id="p_price_${i}" value="${p.price}"></div>
              <div class="field"><label>Validity (days)</label><input type="number" id="p_days_${i}" value="${p.days}"></div>
              <div class="field"><label>Ads per day</label><input type="number" id="p_ads_${i}" value="${p.adsPerDay}"></div>
              <div class="field"><label>Reward per ad (৳)</label><input type="number" id="p_rew_${i}" value="${p.rewardPerAd}"></div>
              <div class="field"><label>Max possible earning</label>
                <input type="text" value="৳${cap.toLocaleString()}" disabled style="background:#f1f5f9;"></div>
            </div>
            <div class="row-actions">
              <button class="btn sm green" onclick="savePlan(${i})">Save</button>
              <button class="btn sm red"   onclick="deletePlan(${i})">Delete</button>
            </div>
          </div>`;
        }).join('') : emptyState('📦','No plans yet.')}
      </div>
    </div>`;
}

async function savePlan(i){
  const g = id => document.getElementById(id);
  plans[i] = Object.assign({}, plans[i], {
    name: g('p_name_'+i).value.trim() || 'Plan',
    price: Number(g('p_price_'+i).value)||0,
    days: Number(g('p_days_'+i).value)||1,
    adsPerDay: Number(g('p_ads_'+i).value)||0,
    rewardPerAd: Number(g('p_rew_'+i).value)||0
  });
  await DB.savePlans(plans);
  toast('Plan saved');
}
async function addPlan(){
  plans.push({ id: DB.uid('p'), name:'New Plan', price:500, days:30, adsPerDay:2, rewardPerAd:100 });
  await DB.savePlans(plans);
  toast('Plan added');
}
async function deletePlan(i){
  plans.splice(i,1);
  await DB.savePlans(plans);
  toast('Plan deleted');
}

/* ================================================ CONTENT & SETTINGS === */

function renderContent(el){
  const c = appCfg || {};
  el.innerHTML = `
    <div class="note">⚙️ Changes here appear in every user's app instantly — no reinstall or refresh needed.</div>

    <div class="panel">
      <div class="panel-head"><div class="panel-title">App Identity &amp; Home Banner</div></div>
      <div class="panel-body">
        <div class="field"><label>App name (login screen)</label><input type="text" id="c_app" value="${esc(c.appName||'')}"></div>
        <div class="field"><label>Banner title</label><input type="text" id="c_bt" value="${esc(c.bannerTitle||'')}"></div>
        <div class="grid2">
          <div class="field"><label>Banner line 1</label><input type="text" id="c_b1" value="${esc(c.bannerSub1||'')}"></div>
          <div class="field"><label>Banner line 2</label><input type="text" id="c_b2" value="${esc(c.bannerSub2||'')}"></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><div class="panel-title">Limits &amp; Bonuses</div></div>
      <div class="panel-body">
        <div class="grid2">
          <div class="field"><label>Minimum deposit (৳)</label><input type="number" id="c_mind" value="${Number(c.minDeposit)||500}"></div>
          <div class="field"><label>Minimum withdraw (৳)</label><input type="number" id="c_minw" value="${Number(c.minWithdraw)||500}"></div>
          <div class="field"><label>Signup bonus (৳)</label><input type="number" id="c_sb" value="${Number(c.signupBonus)||0}"></div>
          <div class="field"><label>Referral bonus (৳)</label><input type="number" id="c_rb" value="${Number(c.referralBonus)||0}"></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><div class="panel-title">Support Contact</div></div>
      <div class="panel-body">
        <div class="grid2">
          <div class="field"><label>Support phone</label><input type="text" id="c_sp" value="${esc(c.supportPhone||'')}"></div>
          <div class="field"><label>Support email</label><input type="text" id="c_se" value="${esc(c.supportEmail||'')}"></div>
        </div>
        <button class="btn" onclick="saveAllSettings()">Save all settings</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><div class="panel-title">Admin Security</div></div>
      <div class="panel-body">
        <div class="grid2">
          <div class="field"><label>New admin password</label><input type="password" id="c_pw1" placeholder="min 6 characters"></div>
          <div class="field"><label>Confirm password</label><input type="password" id="c_pw2" placeholder="repeat"></div>
        </div>
        <button class="btn red" onclick="changeAdminPw()">Change admin password</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><div class="panel-title">Danger Zone</div></div>
      <div class="panel-body">
        <div class="note danger">
          Deletes every user, deposit, withdrawal and transaction. Your methods, plans and
          settings are kept. Useful for clearing test data before you go live.
        </div>
        <button class="btn red" onclick="askResetAll()">Delete all user data</button>
      </div>
    </div>`;
}

function askResetAll(){
  openModal('Delete All User Data', `
    <div class="note danger">
      This permanently deletes <b>${users.length} users</b>, <b>${deposits.length} deposits</b>,
      <b>${withdrawals.length} withdrawals</b> and <b>${transactions.length} transactions</b>.
      This cannot be undone.
    </div>
    <div class="field">
      <label>Type DELETE to confirm</label>
      <input type="text" id="delConfirm" placeholder="DELETE">
    </div>
  `, `
    <button class="btn grey" onclick="closeModal()">Cancel</button>
    <button class="btn red" onclick="confirmResetAll()">Delete everything</button>
  `);
}
async function confirmResetAll(){
  if(document.getElementById('delConfirm').value.trim() !== 'DELETE'){
    toast('Type DELETE to confirm'); return;
  }
  await DB.resetAll();
  closeModal();
  toast('All user data cleared');
}

async function saveAllSettings(){
  const g = id => document.getElementById(id).value;
  await DB.saveConfig({
    appName: g('c_app'),
    bannerTitle: g('c_bt'),
    bannerSub1: g('c_b1'),
    bannerSub2: g('c_b2'),
    minDeposit: Number(g('c_mind'))||500,
    minWithdraw: Number(g('c_minw'))||500,
    signupBonus: Number(g('c_sb'))||0,
    referralBonus: Number(g('c_rb'))||0,
    supportPhone: g('c_sp'),
    supportEmail: g('c_se')
  });
  toast('✅ Settings saved and pushed to all users');
}

async function changeAdminPw(){
  const a = document.getElementById('c_pw1').value;
  const b = document.getElementById('c_pw2').value;
  if(a.length < 6){ toast('Password must be at least 6 characters'); return; }
  if(a !== b){ toast('Passwords do not match'); return; }
  await DB.changeAdminPassword(adminUser.username, a);
  toast('Admin password changed. Use it next time you sign in.');
  document.getElementById('c_pw1').value = '';
  document.getElementById('c_pw2').value = '';
}

/* ====================================================== TRANSACTIONS === */

function setTxQuery(v){ txQuery = v.toLowerCase(); render(); }

function renderTransactions(el){
  const list = transactions
    .map(t => Object.assign({}, t, { _name: userName(t.uid) }))
    .filter(t => !txQuery ||
      t._name.toLowerCase().includes(txQuery) ||
      (t.title||'').toLowerCase().includes(txQuery))
    .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
    .slice(0, 300);

  const credit = transactions.filter(t=>t.type==='plus'  && t.status==='approved').reduce((s,t)=>s+Number(t.amount),0);
  const debit  = transactions.filter(t=>t.type==='minus' && t.status==='approved').reduce((s,t)=>s+Number(t.amount),0);

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="lab">Total Records</div><div class="val">${transactions.length}</div></div>
      <div class="stat-card good"><div class="lab">Total Credit</div><div class="val">${tk(credit)}</div></div>
      <div class="stat-card"><div class="lab">Total Debit</div><div class="val" style="color:var(--red);">${tk(debit)}</div></div>
      <div class="stat-card"><div class="lab">Pending</div><div class="val">${transactions.filter(t=>t.status==='pending').length}</div></div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">Transaction Ledger</div>
        <input class="search-input" placeholder="Search user or type..." value="${esc(txQuery)}" oninput="setTxQuery(this.value)">
      </div>
      <div class="panel-body flush">
        ${list.length ? `<div class="tbl-wrap"><table>
          <thead><tr><th>User</th><th>Description</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${list.map(t=>`
            <tr>
              <td class="cell-name">${esc(t._name)}</td>
              <td>${esc(t.title)}</td>
              <td class="amt ${t.type}">${t.type==='plus'?'+':'-'}${tk(t.amount)}</td>
              <td><span class="badge ${t.status}">${t.status.toUpperCase()}</span></td>
              <td class="cell-sub">${dt(t.createdAt)}</td>
            </tr>`).join('')}
          </tbody></table></div>` : emptyState('🧾','No transactions yet.')}
      </div>
    </div>`;
}

/* ============================================================== GO ===== */
bootAdmin();
