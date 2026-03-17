
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get, remove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

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

let currentUser = null;
let userData = {};

// Helper: Generate Referral Code
function makeRefCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Adsgram Initialization
const AdController = window.Adsgram?.init({ blockId: "24438" });

// Handle Monetag Interstitial every 3 mins
setInterval(() => {
    if (typeof show_10555746 === 'function') {
        show_10555746({ type: 'inApp' });
    }
}, 180000);

// --- Auth Logic ---
window.handleLogin = async () => {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const refCode = document.getElementById('ref-code-input').value.trim();

    if (!user || !pass) return alert("Fill all fields");

    const userRef = ref(db, 'users/' + user);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.password === pass) {
            loginSuccess(user, data);
        } else {
            alert("Wrong password");
        }
    } else {
        // Register
        const newData = {
            username: user,
            password: pass,
            balance: 0,
            referralCode: makeRefCode(),
            referredBy: refCode || "",
            refCount: 0,
            refEarned: 0
        };
        await set(userRef, newData);
        
        // Handle referral commission
        if (refCode) {
            const usersRef = ref(db, 'users');
            const allUsers = await get(usersRef);
            allUsers.forEach((child) => {
                if (child.val().referralCode === refCode) {
                    const owner = child.val();
                    update(ref(db, 'users/' + owner.username), {
                        refCount: (owner.refCount || 0) + 1
                    });
                }
            });
        }
        loginSuccess(user, newData);
    }
};

function loginSuccess(uid, data) {
    currentUser = uid;
    userData = data;
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('display-name').innerText = uid;
    document.getElementById('my-ref-code').innerText = data.referralCode;
    syncData();
    loadTasks();
    loadChat();
}

function syncData() {
    onValue(ref(db, 'users/' + currentUser), (snap) => {
        userData = snap.val();
        document.getElementById('user-balance').innerText = userData.balance.toFixed(2);
        document.getElementById('ref-count').innerText = userData.refCount || 0;
        document.getElementById('ref-earned').innerText = (userData.refEarned || 0).toFixed(2);
    });
}

// --- Tabs ---
window.showTab = (tab) => {
    const sections = ['home', 'tasks', 'chat', 'profile', 'admin'];
    sections.forEach(s => {
        document.getElementById('section-' + s).classList.add('hidden');
        document.getElementById('tab-' + s).classList.remove('active-tab');
    });
    document.getElementById('section-' + tab).classList.remove('hidden');
    document.getElementById('tab-' + tab).classList.add('active-tab');
    
    if (tab === 'profile') loadMyLinks();
};

// --- Tasks Logic ---
window.addTask = async () => {
    const link = document.getElementById('task-link').value;
    const desc = document.getElementById('task-desc').value;
    const type = document.getElementById('task-type').value;

    if (!link || !desc) return alert("Fill data");
    
    if (type === 'paid') {
        if (userData.balance < 1) return alert("Insufficient balance (₱1 needed)");
        update(ref(db, 'users/' + currentUser), { balance: userData.balance - 1 });
    }

    const newTask = {
        link,
        desc,
        type,
        owner: currentUser,
        capacity: type === 'free' ? 5 : 100,
        reward: 0.01,
        clicks: 0,
        timestamp: Date.now()
    };
    
    await push(ref(db, 'tasks'), newTask);
    alert("Task Registered!");
    document.getElementById('task-link').value = "";
    document.getElementById('task-desc').value = "";
};

function loadTasks() {
    onValue(ref(db, 'tasks'), (snap) => {
        const tasks = snap.val();
        const container = document.getElementById('tasks-list');
        container.innerHTML = "";
        
        get(ref(db, `completions/${currentUser}`)).then((compSnap) => {
            const completed = compSnap.val() || {};
            
            for (let id in tasks) {
                const t = tasks[id];
                if (completed[id] || t.clicks >= t.capacity) continue;

                const div = document.createElement('div');
                div.className = "bg-white p-4 rounded shadow flex justify-between items-center";
                div.innerHTML = `
                    <div>
                        <p class="font-bold text-blue-600 truncate w-40">${t.link}</p>
                        <p class="text-xs text-gray-500">${t.desc}</p>
                        <p class="text-[10px] text-gray-400">Reward: ₱${t.reward} | Cap: ${t.clicks}/${t.capacity}</p>
                    </div>
                    <button onclick="startTask('${id}', '${t.link}', ${t.reward})" class="bg-blue-500 text-white px-4 py-2 rounded text-sm">Follow</button>
                `;
                container.appendChild(div);
            }
        });
    });
}

window.startTask = async (id, link, reward) => {
    // Show 3 Ads
    if (typeof show_10555663 === 'function') show_10555663();
    if (AdController) AdController.show();
    
    // Redirect & Timer
    window.open(link, '_blank');
    const overlay = document.getElementById('timer-overlay');
    const display = document.getElementById('timer-display');
    overlay.classList.remove('hidden');
    
    let timeLeft = 30;
    const interval = setInterval(() => {
        timeLeft--;
        display.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(interval);
            overlay.classList.add('hidden');
            finishTask(id, reward);
        }
    }, 1000);
};

async function finishTask(taskId, reward) {
    // Credit User
    const newBalance = userData.balance + reward;
    await update(ref(db, 'users/' + currentUser), { balance: newBalance });
    
    // Mark completed for user
    await set(ref(db, `completions/${currentUser}/${taskId}`), true);
    
    // Increment task clicks
    const taskSnap = await get(ref(db, 'tasks/' + taskId));
    if (taskSnap.exists()) {
        update(ref(db, 'tasks/' + taskId), { clicks: (taskSnap.val().clicks || 0) + 1 });
    }

    // Referral Commission (20%)
    if (userData.referredBy) {
        const usersRef = ref(db, 'users');
        const snap = await get(usersRef);
        snap.forEach(u => {
            if (u.val().referralCode === userData.referredBy) {
                const comm = reward * 0.2;
                update(ref(db, 'users/' + u.key), {
                    balance: (u.val().balance || 0) + comm,
                    refEarned: (u.val().refEarned || 0) + comm
                });
            }
        });
    }
    
    alert(`Reward ₱${reward} credited!`);
    showTab('home');
}

// --- Chat Logic ---
window.sendChat = () => {
    const msg = document.getElementById('chat-input').value;
    if (!msg) return;
    push(ref(db, 'chats'), { user: currentUser, text: msg, time: Date.now() });
    document.getElementById('chat-input').value = "";
};

function loadChat() {
    onValue(ref(db, 'chats'), (snap) => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(child => {
            const c = child.val();
            box.innerHTML += `<div class="text-sm"><b>${c.user}:</b> ${c.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// --- Deposit Logic ---
window.submitDeposit = () => {
    const refNum = document.getElementById('dep-ref').value;
    const amt = document.getElementById('dep-amount').value;
    if (!refNum || !amt) return alert("Enter details");

    push(ref(db, 'deposits'), {
        uid: currentUser,
        ref: refNum,
        amount: parseFloat(amt),
        status: 'pending'
    });
    alert("Deposit submitted for approval");
};

// --- Admin Logic ---
window.checkAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-auth').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdminData();
    } else {
        alert("Wrong Admin Password");
    }
};

function loadAdminData() {
    onValue(ref(db, 'deposits'), (snap) => {
        const list = document.getElementById('admin-deposits');
        list.innerHTML = "";
        snap.forEach(child => {
            const d = child.val();
            if (d.status === 'pending') {
                const div = document.createElement('div');
                div.className = "p-2 bg-white border rounded flex justify-between";
                div.innerHTML = `
                    <span>${d.uid} - ₱${d.amount} (${d.ref})</span>
                    <button onclick="approveDep('${child.key}', '${d.uid}', ${d.amount})" class="text-green-600 font-bold">Approve</button>
                `;
                list.appendChild(div);
            }
        });
    });
}

window.approveDep = async (key, uid, amount) => {
    const userSnap = await get(ref(db, 'users/' + uid));
    if (userSnap.exists()) {
        const currentBal = userSnap.val().balance || 0;
        update(ref(db, 'users/' + uid), { balance: currentBal + amount });
        update(ref(db, 'deposits/' + key), { status: 'approved' });
        alert("Approved!");
    }
};

window.adminPostTask = () => {
    const link = document.getElementById('adm-link').value;
    if (!link) return;
    push(ref(db, 'tasks'), {
        link,
        desc: "Official Admin Task - Follow Now",
        type: "admin",
        owner: "admin",
        capacity: 100000,
        reward: 0.021,
        clicks: 0
    });
    alert("Admin Task Posted!");
};

// --- Profile / My Links ---
function loadMyLinks() {
    onValue(ref(db, 'tasks'), (snap) => {
        const list = document.getElementById('my-links-list');
        list.innerHTML = "";
        snap.forEach(child => {
            const t = child.val();
            if (t.owner === currentUser) {
                const div = document.createElement('div');
                div.className = "flex justify-between border-b pb-1";
                div.innerHTML = `<span>${t.link} (${t.clicks}/${t.capacity})</span> 
                                 <button onclick="deleteLink('${child.key}')" class="text-red-500">Delete</button>`;
                list.appendChild(div);
            }
        });
    });
}

window.deleteLink = (key) => {
    if (confirm("Delete this link?")) remove(ref(db, 'tasks/' + key));
};
