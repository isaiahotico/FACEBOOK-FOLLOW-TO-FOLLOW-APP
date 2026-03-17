
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, update, remove, get } from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let currentUser = null;
let userData = null;
let currentTask = null;
let adCooldown = false;

// Initialize Session
signInAnonymously(auth).catch(console.error);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        listenToUserData(user.uid);
    }
});

// Logic: Listen to User Data
function listenToUserData(uid) {
    onValue(ref(db, `users/${uid}`), (snapshot) => {
        if (!snapshot.exists()) {
            const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            set(ref(db, `users/${uid}`), {
                balance: 0,
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

// Logic: Ads
function triggerAds() {
    if (adCooldown) return;

    // Adsgram
    const AdController = window.Adsgram.init({ blockId: "24438" });
    AdController.show().catch(e => console.log("Adsgram skip"));

    // Monetag Interstitial
    if (typeof show_10555746 === 'function') {
        show_10555746({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 0, everyPage: true }
        });
    }

    adCooldown = true;
    setTimeout(() => { adCooldown = false; }, 180000); // 3 min cooldown
}

// Logic: Navigation
window.showView = (view) => {
    document.querySelectorAll('main > div').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${view}-view`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('tab-active'));
    document.getElementById(`nav-${view}`).classList.add('tab-active');
};

// Logic: Tasks
window.handleRegisterTask = async () => {
    const link = document.getElementById('reg-link').value;
    const def = document.getElementById('reg-def').value;
    if (!link || !def) return alert("Fill all fields");

    const cost = userData.freeTasksUsed < 5 ? 0 : 1.00;
    if (userData.balance < cost) return alert("Insufficient balance");

    const taskData = {
        url: link,
        definition: def,
        capacity: 100,
        visits: 0,
        reward: 0.01,
        ownerId: currentUser.uid,
        type: 'user'
    };

    const newKey = push(ref(db, 'tasks')).key;
    await update(ref(db), {
        [`tasks/${newKey}`]: taskData,
        [`users/${currentUser.uid}/balance`]: userData.balance - cost,
        [`users/${currentUser.uid}/freeTasksUsed`]: userData.freeTasksUsed + (cost === 0 ? 1 : 0)
    });
    alert("Task Registered!");
};

function renderTasks() {
    onValue(ref(db, 'tasks'), (snapshot) => {
        const container = document.getElementById('tasks-list');
        container.innerHTML = "";
        const tasks = snapshot.val();
        for (let id in tasks) {
            if (userData.finishedTasks && userData.finishedTasks[id]) continue;
            if (tasks[id].visits >= tasks[id].capacity) continue;

            const div = document.createElement('div');
            div.className = "bg-slate-800 p-4 rounded-xl flex justify-between items-center border border-slate-700";
            div.innerHTML = `
                <div>
                    <p class="font-bold text-sky-400">${tasks[id].definition}</p>
                    <p class="text-xs text-gray-400">Reward: ₱${tasks[id].reward}</p>
                </div>
                <button onclick="startTask('${id}')" class="bg-sky-600 px-4 py-2 rounded text-sm font-bold">Follow</button>
            `;
            container.appendChild(div);
        }
    });
}

window.startTask = (id) => {
    get(ref(db, `tasks/${id}`)).then(snap => {
        currentTask = { ...snap.val(), id };
        triggerAds();
        document.getElementById('task-modal-def').innerText = currentTask.definition;
        document.getElementById('task-modal').classList.remove('hidden');
        
        let timeLeft = 30;
        const timerEl = document.getElementById('timer');
        
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
    const refBonus = reward * 0.20;

    const updates = {};
    updates[`users/${currentUser.uid}/balance`] = userData.balance + reward;
    updates[`users/${currentUser.uid}/finishedTasks/${currentTask.id}`] = true;
    updates[`tasks/${currentTask.id}/visits`] = (currentTask.visits || 0) + 1;

    // Referral Logic
    if (userData.referredBy) {
        get(ref(db, `users/${userData.referredBy}`)).then(snap => {
            if (snap.exists()) {
                const rData = snap.val();
                update(ref(db, `users/${userData.referredBy}`), {
                    balance: rData.balance + refBonus,
                    refEarnings: (rData.refEarnings || 0) + refBonus
                });
            }
        });
    }

    await update(ref(db), updates);
    alert(`Success! Reward ₱${reward} credited.`);
    document.getElementById('task-modal').classList.add('hidden');
    showView('main');
}

// Logic: Admin
window.checkAdmin = () => {
    const pass = prompt("Enter Admin Password:");
    if (pass === "Propetas12") {
        showView('admin');
        listenToAdminDeposits();
    } else {
        alert("Wrong Password");
    }
};

window.postAdminTask = () => {
    const link = document.getElementById('adm-link').value;
    const def = document.getElementById('adm-def').value;
    const taskData = {
        url: link,
        definition: def,
        capacity: 100000,
        visits: 0,
        reward: 0.021,
        type: 'admin'
    };
    push(ref(db, 'tasks'), taskData);
    alert("Admin Task Posted");
};

// Logic: Deposit
window.handleDeposit = () => {
    const dep = {
        name: document.getElementById('dep-name').value,
        ref: document.getElementById('dep-ref').value,
        amount: parseFloat(document.getElementById('dep-amount').value),
        uid: currentUser.uid,
        status: 'pending'
    };
    push(ref(db, 'deposits'), dep);
    alert("Deposit request sent to admin.");
};

function listenToAdminDeposits() {
    onValue(ref(db, 'deposits'), (snapshot) => {
        const container = document.getElementById('admin-deposits');
        container.innerHTML = "";
        const deps = snapshot.val();
        for (let id in deps) {
            if (deps[id].status === 'pending') {
                const div = document.createElement('div');
                div.className = "bg-slate-900 p-2 text-xs rounded border border-slate-700";
                div.innerHTML = `
                    <p>Name: ${deps[id].name} | Amt: ₱${deps[id].amount}</p>
                    <p>Ref: ${deps[id].ref}</p>
                    <button onclick="approveDeposit('${id}', '${deps[id].uid}', ${deps[id].amount})" class="bg-green-600 p-1 mt-1 rounded">Approve</button>
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
    alert("Approved!");
};

// Logic: Profile / Referral
window.applyReferral = async () => {
    const code = document.getElementById('input-ref').value.toUpperCase();
    if (userData.referredBy) return alert("Already referred");
    
    const usersSnap = await get(ref(db, 'users'));
    const users = usersSnap.val();
    let ownerUid = null;

    for (let u in users) {
        if (users[u].refCode === code && u !== currentUser.uid) {
            ownerUid = u;
            break;
        }
    }

    if (ownerUid) {
        await update(ref(db, `users/${currentUser.uid}`), { referredBy: ownerUid });
        await update(ref(db, `users/${ownerUid}`), { referredCount: (users[ownerUid].referredCount || 0) + 1 });
        alert("Referral Applied!");
    } else {
        alert("Invalid Code");
    }
};

// Logic: Chat
window.sendChatMessage = () => {
    const msg = document.getElementById('chat-input').value;
    if (!msg) return;
    push(ref(db, 'chat'), {
        uid: currentUser.uid.substring(0, 5),
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
        const p = document.createElement('p');
        p.className = "text-sm";
        p.innerHTML = `<span class="text-sky-400 font-bold">${msgs[id].uid}:</span> ${msgs[id].text}`;
        box.appendChild(p);
    }
    box.scrollTop = box.scrollHeight;
});

function renderMyLinks() {
    const container = document.getElementById('my-links-list');
    container.innerHTML = "";
    onValue(ref(db, 'tasks'), (snap) => {
        const tasks = snap.val();
        for (let id in tasks) {
            if (tasks[id].ownerId === currentUser.uid) {
                const div = document.createElement('div');
                div.className = "flex justify-between text-xs bg-slate-900 p-2 rounded";
                div.innerHTML = `<span>${tasks[id].definition}</span> <button onclick="deleteLink('${id}')" class="text-red-500">Delete</button>`;
                container.appendChild(div);
            }
        }
    }, { onlyOnce: true });
}

window.deleteLink = (id) => {
    if (confirm("Delete this link?")) remove(ref(db, `tasks/${id}`));
};
