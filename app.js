
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

// Logic for Login
signInAnonymously(auth).then(() => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (!currentUid) currentUid = user.uid;
            syncUser();
        }
    });
});

function syncUser() {
    const userRef = ref(db, `users/${currentUid}`);
    onValue(userRef, (snapshot) => {
        if (!snapshot.exists()) {
            const refCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            set(userRef, {
                username, balance: 0, refCode, referredCount: 0, refEarnings: 0, freeTasksUsed: 0, finishedTasks: {}
            });
        } else {
            userData = snapshot.val();
            document.getElementById('user-balance').innerText = `₱${userData.balance.toFixed(3)}`;
            document.getElementById('my-ref-code').innerText = userData.refCode;
            document.getElementById('ref-count').innerText = userData.referredCount || 0;
            document.getElementById('ref-earned').innerText = (userData.refEarnings || 0).toFixed(2);
            renderTasks();
            renderMyLinks();
        }
    });
}

// ADS LOGIC (3 ADS: 2 Monetag, 1 Adsgram)
function showAds() {
    // Adsgram (1 Ad)
    const AdController = window.Adsgram?.init({ blockId: "24438" });
    AdController?.show().catch(() => {});

    // Monetag (2 Ads) - Only if not in cooldown
    if (!adCooldown && typeof show_10555746 === 'function') {
        show_10555746({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
        adCooldown = true;
        setTimeout(() => { adCooldown = false; }, 180000); // 3-min cooldown
    }
}

// Navigation
window.showView = (view) => {
    document.querySelectorAll('main > div').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${view}-view`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('tab-active', 'text-sky-400'));
    document.getElementById(`nav-${view}`).classList.add('tab-active', 'text-sky-400');
};

// Task Registration
window.handleRegisterTask = async () => {
    const link = document.getElementById('reg-link').value;
    const def = document.getElementById('reg-def').value;
    if (!link || !def) return alert("Fill fields");

    const cost = (userData.freeTasksUsed || 0) < 5 ? 0 : 1.0;
    if (userData.balance < cost) return alert("Insufficient Balance");

    const taskKey = push(ref(db, 'tasks')).key;
    await update(ref(db), {
        [`tasks/${taskKey}`]: { url: link, definition: def, capacity: 100, visits: 0, reward: 0.01, ownerId: currentUid },
        [`users/${currentUid}/balance`]: userData.balance - cost,
        [`users/${currentUid}/freeTasksUsed`]: (userData.freeTasksUsed || 0) + (cost === 0 ? 1 : 0)
    });
    alert("Task Added!");
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
            if (userData.finishedTasks && userData.finishedTasks[id]) continue;
            if (tasks[id].visits >= tasks[id].capacity) continue;

            const div = document.createElement('div');
            div.className = "glass-card p-4 rounded-3xl flex justify-between items-center";
            div.innerHTML = `
                <div>
                    <p class="font-black text-sky-400 text-sm italic">${tasks[id].definition}</p>
                    <p class="text-[9px] text-gray-500 font-bold">REWARD: ₱${tasks[id].reward}</p>
                </div>
                <button onclick="doTask('${id}')" class="bg-sky-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase">Follow</button>
            `;
            container.appendChild(div);
        }
    });
}

window.doTask = (id) => {
    get(ref(db, `tasks/${id}`)).then(snap => {
        const task = snap.val();
        showAds(); // Shows 3 ads
        document.getElementById('task-modal-def').innerText = task.definition;
        document.getElementById('task-modal').classList.remove('hidden');
        
        let sec = 30;
        const timerEl = document.getElementById('timer');
        timerEl.innerText = sec;

        document.getElementById('fb-redirect-btn').onclick = () => {
            window.open(task.url, '_blank');
            const intr = setInterval(() => {
                sec--;
                timerEl.innerText = sec;
                if (sec <= 0) {
                    clearInterval(intr);
                    finishTask(id, task.reward);
                }
            }, 1000);
        };
    });
};

async function finishTask(id, reward) {
    const up = {};
    up[`users/${currentUid}/balance`] = userData.balance + reward;
    up[`users/${currentUid}/finishedTasks/${id}`] = true;
    up[`tasks/${id}/visits`] = (reward === 0.021 ? 0 : 1); // Admin tasks never expire

    if (userData.referredBy) {
        const rSnap = await get(ref(db, `users/${userData.referredBy}`));
        if (rSnap.exists()) {
            update(ref(db, `users/${userData.referredBy}`), {
                balance: rSnap.val().balance + (reward * 0.2),
                refEarnings: (rSnap.val().refEarnings || 0) + (reward * 0.2)
            });
        }
    }
    await update(ref(db), up);
    document.getElementById('task-modal').classList.add('hidden');
    alert(`Reward ₱${reward} credited!`);
    showView('main');
}

// Deposit / Admin / Chat / Referral
window.handleDeposit = () => {
    const name = document.getElementById('dep-name').value;
    const refN = document.getElementById('dep-ref').value;
    const amt = parseFloat(document.getElementById('dep-amount').value);
    if (!name || !refN || !amt) return;
    push(ref(db, 'deposits'), { name, ref: refN, amount: amt, uid: currentUid, status: 'pending', user: username });
    alert("Deposit sent!");
};

window.checkAdmin = () => {
    if (prompt("Password:") === "Propetas12") {
        showView('admin');
        onValue(ref(db, 'deposits'), (snap) => {
            const container = document.getElementById('admin-deposits');
            container.innerHTML = "";
            const d = snap.val();
            for (let k in d) if (d[k].status === 'pending') {
                const div = document.createElement('div');
                div.className = "bg-slate-900 p-3 rounded-2xl text-[10px] border border-red-900";
                div.innerHTML = `USER: ${d[k].user} | ₱${d[k].amount} | REF: ${d[k].ref} <button onclick="apprDep('${k}','${d[k].uid}',${d[k].amount})" class="bg-green-600 block w-full mt-2 rounded">APPROVE</button>`;
                container.appendChild(div);
            }
        });
    }
};

window.apprDep = async (k, u, a) => {
    const s = await get(ref(db, `users/${u}/balance`));
    await update(ref(db), { [`users/${u}/balance`]: (s.val() || 0) + a, [`deposits/${k}/status`]: 'approved' });
    alert("Approved");
};

window.postAdminTask = () => {
    const url = document.getElementById('adm-link').value;
    const definition = document.getElementById('adm-def').value;
    push(ref(db, 'tasks'), { url, definition, capacity: 100000, visits: 0, reward: 0.021 });
    alert("Admin Task Live!");
};

window.applyReferral = async () => {
    const code = document.getElementById('input-ref').value.toUpperCase();
    if (userData.referredBy) return alert("Already used code");
    const s = await get(ref(db, 'users'));
    const all = s.val();
    let o = null;
    for (let u in all) if (all[u].refCode === code && u !== currentUid) o = u;
    if (o) {
        await update(ref(db, `users/${currentUid}`), { referredBy: o });
        await update(ref(db, `users/${o}`), { referredCount: (all[o].referredCount || 0) + 1 });
        alert("Success!");
    }
};

window.sendChatMessage = () => {
    const t = document.getElementById('chat-input').value;
    if (t) push(ref(db, 'chat'), { user: username, text: t });
    document.getElementById('chat-input').value = "";
};

onValue(ref(db, 'chat'), (s) => {
    const b = document.getElementById('chat-messages');
    b.innerHTML = "";
    const m = s.val();
    for (let k in m) {
        const d = document.createElement('div');
        d.innerHTML = `<p class="text-[9px] text-sky-400 font-bold">${m[k].user}</p><p class="text-xs">${m[k].text}</p>`;
        b.appendChild(d);
    }
    b.scrollTop = b.scrollHeight;
});

function renderMyLinks() {
    const c = document.getElementById('my-links-list');
    onValue(ref(db, 'tasks'), (s) => {
        c.innerHTML = "";
        const t = s.val();
        for (let k in t) if (t[k].ownerId === currentUid) {
            const d = document.createElement('div');
            d.className = "flex justify-between items-center text-[10px] bg-black/40 p-3 rounded-xl";
            d.innerHTML = `<span>${t[k].definition}</span> <button onclick="delT('${k}')" class="text-red-500 font-black">DEL</button>`;
            c.appendChild(d);
        }
    }, { onlyOnce: true });
}

window.delT = (k) => { if (confirm("Delete?")) remove(ref(db, `tasks/${k}`)); };
