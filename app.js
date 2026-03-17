
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, update, remove, get } from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// --- Telegram Integration ---
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const usernameDisplay = tgUser 
    ? `@${tgUser.username || tgUser.first_name}` 
    : "Guest_" + Math.floor(Math.random() * 1000);

document.getElementById("userBar").innerText = "👤 User: " + usernameDisplay;

// --- Firebase Config ---
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

let currentUserId = tgUser ? `tg_${tgUser.id}` : null;
let userData = null;
let currentTask = null;
let adCooldown = false;

// Initialize Session
signInAnonymously(auth).then(() => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Use Telegram ID if available, else anonymous UID
            if (!currentUserId) currentUserId = user.uid;
            syncUser();
        }
    });
});

function syncUser() {
    onValue(ref(db, `users/${currentUserId}`), (snapshot) => {
        if (!snapshot.exists()) {
            const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            set(ref(db, `users/${currentUserId}`), {
                balance: 0,
                username: usernameDisplay,
                refCode: newCode,
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
            renderTasks();
            renderMyLinks();
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('main-view').classList.remove('hidden');
        }
    });
}

// Ads Logic
function showTaskAds() {
    if (adCooldown) return;

    // 1. Adsgram (1 Ad)
    const AdController = window.Adsgram?.init({ blockId: "24438" });
    AdController?.show().catch(() => {});

    // 2. Monetag In-App (2 Ads within 0.1h logic)
    if (typeof show_10555746 === 'function') {
        show_10555746({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }

    adCooldown = true;
    setTimeout(() => { adCooldown = false; }, 180000); // 3-minute cooldown
}

// Navigation
window.showView = (view) => {
    document.querySelectorAll('main > div').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${view}-view`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('tab-active', 'text-sky-400'));
    document.getElementById(`nav-${view}`).classList.add('tab-active', 'text-sky-400');
};

// Task Registration Logic
window.handleRegisterTask = async () => {
    const link = document.getElementById('reg-link').value;
    const def = document.getElementById('reg-def').value;
    if (!link || !def) return alert("Fill all fields");

    const cost = (userData.freeTasksUsed || 0) < 5 ? 0 : 1.00;
    if (userData.balance < cost) return alert("Insufficient balance (₱1.00 required)");

    const taskData = {
        url: link,
        definition: def,
        capacity: 100,
        visits: 0,
        reward: 0.01,
        ownerId: currentUserId,
        type: 'user'
    };

    const newKey = push(ref(db, 'tasks')).key;
    await update(ref(db), {
        [`tasks/${newKey}`]: taskData,
        [`users/${currentUserId}/balance`]: userData.balance - cost,
        [`users/${currentUserId}/freeTasksUsed`]: (userData.freeTasksUsed || 0) + (cost === 0 ? 1 : 0)
    });
    alert(cost === 0 ? "Free task registered!" : "Task registered (₱1.00 paid)");
    document.getElementById('reg-link').value = "";
    document.getElementById('reg-def').value = "";
};

function renderTasks() {
    onValue(ref(db, 'tasks'), (snapshot) => {
        const container = document.getElementById('tasks-list');
        container.innerHTML = "";
        const tasks = snapshot.val();
        if (!tasks) return;
        
        for (let id in tasks) {
            // Auto-hide logic
            if (userData.finishedTasks && userData.finishedTasks[id]) continue;
            if (tasks[id].visits >= tasks[id].capacity) continue;

            const div = document.createElement('div');
            div.className = "bg-slate-800 p-4 rounded-2xl flex justify-between items-center border border-slate-700 shadow-lg";
            div.innerHTML = `
                <div>
                    <p class="font-bold text-sky-400 text-sm">${tasks[id].definition}</p>
                    <p class="text-[10px] text-gray-500 font-bold">REWARD: ₱${tasks[id].reward}</p>
                </div>
                <button onclick="startTask('${id}')" class="bg-sky-600 px-5 py-2 rounded-xl text-xs font-black shadow-lg shadow-sky-900/30">OPEN</button>
            `;
            container.appendChild(div);
        }
    });
}

window.startTask = (id) => {
    get(ref(db, `tasks/${id}`)).then(snap => {
        currentTask = { ...snap.val(), id };
        showTaskAds();
        document.getElementById('task-modal-def').innerText = currentTask.definition;
        document.getElementById('task-modal').classList.remove('hidden');
        
        let timeLeft = 30;
        const timerEl = document.getElementById('timer');
        timerEl.innerText = timeLeft;
        
        document.getElementById('fb-redirect-btn').onclick = () => {
            window.open(currentTask.url, '_blank');
            const interval = setInterval(() => {
                timeLeft--;
                timerEl.innerText = timeLeft;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    completeTask();
                }
            }, 1000);
        };
    });
};

async function completeTask() {
    const reward = currentTask.reward;
    const updates = {};
    updates[`users/${currentUserId}/balance`] = userData.balance + reward;
    updates[`users/${currentUserId}/finishedTasks/${currentTask.id}`] = true;
    updates[`tasks/${currentTask.id}/visits`] = (currentTask.visits || 0) + 1;

    // 20% Referral Commission
    if (userData.referredBy) {
        const refOwnerSnap = await get(ref(db, `users/${userData.referredBy}`));
        if (refOwnerSnap.exists()) {
            const rData = refOwnerSnap.val();
            const commission = reward * 0.20;
            update(ref(db, `users/${userData.referredBy}`), {
                balance: rData.balance + commission,
                refEarnings: (rData.refEarnings || 0) + commission
            });
        }
    }

    await update(ref(db), updates);
    document.getElementById('task-modal').classList.add('hidden');
    showView('main');
    tg?.HapticFeedback?.notificationOccurred('success');
}

// Deposit Logic
window.handleDeposit = () => {
    const name = document.getElementById('dep-name').value;
    const refNum = document.getElementById('dep-ref').value;
    const amount = parseFloat(document.getElementById('dep-amount').value);
    
    if (!name || !refNum || !amount) return alert("Fill all details");
    
    push(ref(db, 'deposits'), {
        name, ref: refNum, amount, uid: currentUserId, status: 'pending', username: usernameDisplay
    });
    alert("Deposit sent to admin for approval.");
    showView('main');
};

// Admin Logic
window.checkAdmin = () => {
    const pass = prompt("Enter Admin Password:");
    if (pass === "Propetas12") {
        showView('admin');
        listenToAdmin();
    }
};

function listenToAdmin() {
    onValue(ref(db, 'deposits'), (snapshot) => {
        const container = document.getElementById('admin-deposits');
        container.innerHTML = "";
        const deps = snapshot.val();
        for (let id in deps) {
            if (deps[id].status === 'pending') {
                const div = document.createElement('div');
                div.className = "bg-slate-900 p-3 text-[10px] rounded-xl border border-red-500/20";
                div.innerHTML = `
                    <p class="font-bold text-red-400 uppercase">${deps[id].username}</p>
                    <p>Amt: ₱${deps[id].amount} | Ref: ${deps[id].ref}</p>
                    <button onclick="approveDeposit('${id}', '${deps[id].uid}', ${deps[id].amount})" class="bg-green-600 w-full mt-2 p-1 rounded font-bold">APPROVE</button>
                `;
                container.appendChild(div);
            }
        }
    });
}

window.approveDeposit = async (depId, uid, amount) => {
    const userSnap = await get(ref(db, `users/${uid}/balance`));
    const currentBal = userSnap.val() || 0;
    await update(ref(db), {
        [`users/${uid}/balance`]: currentBal + amount,
        [`deposits/${depId}/status`]: 'approved'
    });
    alert("Credit Approved!");
};

window.postAdminTask = () => {
    const url = document.getElementById('adm-link').value;
    const definition = document.getElementById('adm-def').value;
    push(ref(db, 'tasks'), {
        url, definition, capacity: 100000, visits: 0, reward: 0.021, type: 'admin'
    });
    alert("Global Admin Task Published!");
};

// Chat Logic
window.sendChatMessage = () => {
    const msg = document.getElementById('chat-input').value;
    if (!msg) return;
    push(ref(db, 'chat'), {
        user: usernameDisplay,
        text: msg,
        time: Date.now()
    });
    document.getElementById('chat-input').value = "";
};

onValue(ref(db, 'chat'), (snap) => {
    const box = document.getElementById('chat-messages');
    box.innerHTML = "";
    const msgs = snap.val();
    for (let id in msgs) {
        const p = document.createElement('div');
        p.className = "bg-slate-900 p-2 rounded-xl border border-slate-800";
        p.innerHTML = `<p class="text-[10px] font-black text-sky-500">${msgs[id].user}</p><p class="text-xs">${msgs[id].text}</p>`;
        box.appendChild(p);
    }
    box.scrollTop = box.scrollHeight;
});

// Profile / Referral Logic
window.applyReferral = async () => {
    const code = document.getElementById('input-ref').value.toUpperCase();
    if (userData.referredBy) return alert("Already used a referral");
    
    const usersSnap = await get(ref(db, 'users'));
    const users = usersSnap.val();
    let ownerUid = null;

    for (let u in users) {
        if (users[u].refCode === code && u !== currentUserId) {
            ownerUid = u;
            break;
        }
    }

    if (ownerUid) {
        await update(ref(db, `users/${currentUserId}`), { referredBy: ownerUid });
        await update(ref(db, `users/${ownerUid}`), { referredCount: (users[ownerUid].referredCount || 0) + 1 });
        alert("Referral Code Linked!");
    } else {
        alert("Invalid Referral Code");
    }
};

function renderMyLinks() {
    const container = document.getElementById('my-links-list');
    container.innerHTML = "";
    onValue(ref(db, 'tasks'), (snap) => {
        const tasks = snap.val();
        for (let id in tasks) {
            if (tasks[id].ownerId === currentUserId) {
                const div = document.createElement('div');
                div.className = "flex justify-between items-center text-[10px] bg-slate-950 p-3 rounded-xl";
                div.innerHTML = `<span>${tasks[id].definition} (${tasks[id].visits}/${tasks[id].capacity})</span> <button onclick="deleteLink('${id}')" class="text-red-500 font-bold">DELETE</button>`;
                container.appendChild(div);
            }
        }
    }, { onlyOnce: true });
}

window.deleteLink = (id) => {
    if (confirm("Delete this link?")) remove(ref(db, `tasks/${id}`));
};
