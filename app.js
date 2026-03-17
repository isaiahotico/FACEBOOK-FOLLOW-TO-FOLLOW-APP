
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, update, remove, get } from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

/* ================= TELEGRAM ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser 
  ? `@${tgUser.username || tgUser.first_name}` 
  : "Guest_" + Math.floor(Math.random() * 9999);

// Immidiately display telegram username
document.getElementById("userBar").innerText = "👤 User: " + username;

/* ================= FIREBASE ================= */
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let currentUid = tgUser ? `tg_${tgUser.id}` : null;
let userData = null;
let adCooldown = false;

// Session Auth
signInAnonymously(auth).then(() => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (!currentUid) currentUid = user.uid;
            initializeUserData();
        }
    });
});

function initializeUserData() {
    const userRef = ref(db, `users/${currentUid}`);
    onValue(userRef, (snapshot) => {
        if (!snapshot.exists()) {
            const refCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            set(userRef, {
                username: username,
                balance: 0,
                refCode: refCode,
                referredCount: 0,
                refEarnings: 0,
                freeTasksUsed: 0,
                finishedTasks: {}
            });
        } else {
            userData = snapshot.val();
            document.getElementById('user-balance').innerText = `₱${userData.balance.toFixed(3)}`;
            document.getElementById('my-ref-code').innerText = userData.refCode;
            document.getElementById('ref-count').innerText = userData.referredCount || 0;
            document.getElementById('ref-earned').innerText = (userData.refEarnings || 0).toFixed(2);
            
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('main-view').classList.remove('hidden');
            renderTasks();
            renderMyLinks();
        }
    });
}

// ADS LOGIC
function triggerTaskAds() {
    if (adCooldown) return;

    // Adsgram
    const AdController = window.Adsgram?.init({ blockId: "24438" });
    AdController?.show().catch(() => {});

    // Monetag (Zone 10555746)
    if (typeof show_10555746 === 'function') {
        show_10555746({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }

    adCooldown = true;
    setTimeout(() => { adCooldown = false; }, 180000); // 3 min
}

// VIEW SWITCHER
window.showView = (view) => {
    document.querySelectorAll('main > div').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${view}-view`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('tab-active', 'text-sky-400'));
    document.getElementById(`nav-${view}`).classList.add('tab-active', 'text-sky-400');
};

// TASKS
window.handleRegisterTask = async () => {
    const link = document.getElementById('reg-link').value;
    const def = document.getElementById('reg-def').value;
    if (!link || !def) return alert("Fill all fields");

    const cost = (userData.freeTasksUsed || 0) < 5 ? 0 : 1.00;
    if (userData.balance < cost) return alert("Insufficient balance (₱1.00 required)");

    const taskKey = push(ref(db, 'tasks')).key;
    const taskData = {
        url: link,
        definition: def,
        capacity: 100,
        visits: 0,
        reward: 0.01,
        ownerId: currentUid,
        type: 'user'
    };

    await update(ref(db), {
        [`tasks/${taskKey}`]: taskData,
        [`users/${currentUid}/balance`]: userData.balance - cost,
        [`users/${currentUid}/freeTasksUsed`]: (userData.freeTasksUsed || 0) + (cost === 0 ? 1 : 0)
    });

    alert(cost === 0 ? "Task Registered FREE!" : "Task Registered (₱1.00 paid)");
    document.getElementById('reg-link').value = "";
    document.getElementById('reg-def').value = "";
};

function renderTasks() {
    onValue(ref(db, 'tasks'), (snap) => {
        const container = document.getElementById('tasks-list');
        container.innerHTML = "";
        const tasks = snap.val();
        if (!tasks) return;

        for (let id in tasks) {
            // Auto hide if finished
            if (userData.finishedTasks && userData.finishedTasks[id]) continue;
            if (tasks[id].visits >= tasks[id].capacity) continue;

            const card = document.createElement('div');
            card.className = "bg-slate-800 p-4 rounded-2xl flex justify-between items-center border border-slate-700 shadow-xl";
            card.innerHTML = `
                <div>
                    <p class="font-black text-sky-400 text-sm italic">${tasks[id].definition}</p>
                    <p class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Reward: ₱${tasks[id].reward}</p>
                </div>
                <button onclick="performTask('${id}')" class="bg-sky-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase">Follow</button>
            `;
            container.appendChild(card);
        }
    });
}

window.performTask = (id) => {
    get(ref(db, `tasks/${id}`)).then(snapshot => {
        const task = snapshot.val();
        triggerTaskAds();
        document.getElementById('task-modal-def').innerText = task.definition;
        document.getElementById('task-modal').classList.remove('hidden');
        
        let seconds = 30;
        const timerEl = document.getElementById('timer');
        timerEl.innerText = seconds;

        document.getElementById('fb-redirect-btn').onclick = () => {
            window.open(task.url, '_blank');
            const countdown = setInterval(() => {
                seconds--;
                timerEl.innerText = seconds;
                if (seconds <= 0) {
                    clearInterval(countdown);
                    finalizeTask(id, task.reward);
                }
            }, 1000);
        };
    });
};

async function finalizeTask(taskId, reward) {
    const updates = {};
    updates[`users/${currentUid}/balance`] = (userData.balance + reward);
    updates[`users/${currentUid}/finishedTasks/${taskId}`] = true;
    updates[`tasks/${taskId}/visits`] = (reward === 0.021 ? 0 : 1); // Admin tasks reset/capacity check

    // Referral Commission
    if (userData.referredBy) {
        const refOwnerSnap = await get(ref(db, `users/${userData.referredBy}`));
        if (refOwnerSnap.exists()) {
            const rData = refOwnerSnap.val();
            update(ref(db, `users/${userData.referredBy}`), {
                balance: rData.balance + (reward * 0.20),
                refEarnings: (rData.refEarnings || 0) + (reward * 0.20)
            });
        }
    }

    await update(ref(db), updates);
    document.getElementById('task-modal').classList.add('hidden');
    showView('main');
    tg?.HapticFeedback?.notificationOccurred('success');
}

// ADMIN LOGIC
window.checkAdmin = () => {
    if (prompt("Enter Admin Key:") === "Propetas12") {
        showView('admin');
        listenAdminDeposits();
    }
};

window.postAdminTask = () => {
    const url = document.getElementById('adm-link').value;
    const definition = document.getElementById('adm-def').value;
    push(ref(db, 'tasks'), {
        url, definition, capacity: 100000, visits: 0, reward: 0.021, type: 'admin'
    });
    alert("Global Admin Task Posted!");
};

function listenAdminDeposits() {
    onValue(ref(db, 'deposits'), (snap) => {
        const container = document.getElementById('admin-deposits');
        container.innerHTML = "";
        const deps = snap.val();
        for (let id in deps) {
            if (deps[id].status === 'pending') {
                const div = document.createElement('div');
                div.className = "bg-slate-900 p-4 rounded-2xl border border-red-900/40 text-[10px]";
                div.innerHTML = `
                    <p class="font-black text-red-400">USER: ${deps[id].username}</p>
                    <p>AMT: ₱${deps[id].amount} | REF: ${deps[id].ref}</p>
                    <button onclick="approveDep('${id}', '${deps[id].uid}', ${deps[id].amount})" class="w-full bg-green-600 mt-2 py-2 rounded-lg font-black">APPROVE</button>
                `;
                container.appendChild(div);
            }
        }
    });
}

window.approveDep = async (id, uid, amt) => {
    const uSnap = await get(ref(db, `users/${uid}/balance`));
    await update(ref(db), {
        [`users/${uid}/balance`]: (uSnap.val() || 0) + amt,
        [`deposits/${id}/status`]: 'approved'
    });
    alert("Approved!");
};

// CHAT
window.sendChatMessage = () => {
    const text = document.getElementById('chat-input').value;
    if (!text) return;
    push(ref(db, 'chat'), { user: username, text: text, time: Date.now() });
    document.getElementById('chat-input').value = "";
};

onValue(ref(db, 'chat'), (snap) => {
    const box = document.getElementById('chat-messages');
    box.innerHTML = "";
    const msgs = snap.val();
    for (let id in msgs) {
        const m = document.createElement('div');
        m.className = "bg-slate-900/50 p-3 rounded-2xl border border-slate-800";
        m.innerHTML = `<p class="text-[9px] font-black text-sky-500">${msgs[id].user}</p><p class="text-xs text-gray-300">${msgs[id].text}</p>`;
        box.appendChild(m);
    }
    box.scrollTop = box.scrollHeight;
});

// DEPOSIT / PROFILE
window.handleDeposit = () => {
    const name = document.getElementById('dep-name').value;
    const refNum = document.getElementById('dep-ref').value;
    const amount = parseFloat(document.getElementById('dep-amount').value);
    if (!name || !refNum || !amount) return alert("Fill all fields");
    push(ref(db, 'deposits'), { name, ref: refNum, amount, uid: currentUid, username, status: 'pending' });
    alert("Deposit request submitted!");
};

window.applyReferral = async () => {
    const code = document.getElementById('input-ref').value.toUpperCase();
    if (userData.referredBy) return alert("Already referred!");
    const snap = await get(ref(db, 'users'));
    const all = snap.val();
    let owner = null;
    for (let u in all) { if (all[u].refCode === code && u !== currentUid) owner = u; }
    if (owner) {
        await update(ref(db, `users/${currentUid}`), { referredBy: owner });
        await update(ref(db, `users/${owner}`), { referredCount: (all[owner].referredCount || 0) + 1 });
        alert("Referral Applied!");
    } else alert("Invalid Code!");
};

function renderMyLinks() {
    const container = document.getElementById('my-links-list');
    onValue(ref(db, 'tasks'), (snap) => {
        container.innerHTML = "";
        const tasks = snap.val();
        for (let id in tasks) {
            if (tasks[id].ownerId === currentUid) {
                const div = document.createElement('div');
                div.className = "flex justify-between items-center bg-slate-950 p-3 rounded-2xl border border-slate-800";
                div.innerHTML = `<span class="text-[10px] font-bold">${tasks[id].definition}</span> <button onclick="delTask('${id}')" class="text-red-500 font-black text-[10px]">DELETE</button>`;
                container.appendChild(div);
            }
        }
    }, { onlyOnce: true });
}

window.delTask = (id) => { if (confirm("Delete this link?")) remove(ref(db, `tasks/${id}`)); };
