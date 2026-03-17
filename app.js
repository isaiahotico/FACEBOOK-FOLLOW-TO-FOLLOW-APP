
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- Telegram Setup ---
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const userId = tgUser?.id || "guest_user";
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest";

document.getElementById("userBar").innerText = "👤 " + username;

// --- State ---
let userData = {};

// --- Monetag Interstitial ---
function showMonetag() {
    if (typeof show_10555746 === 'function') {
        show_10555746({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
}

// --- Initialization ---
async function initUser() {
    const userRef = ref(db, 'users/' + userId);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        userData = {
            balance: 0,
            freeTasks: 0,
            refCode: newCode,
            refCount: 0,
            refEarned: 0,
            referredBy: "",
            completedTasks: {}
        };
        await set(userRef, userData);
    } else {
        userData = snapshot.val();
    }
    updateUI();
    loadTasks();
    loadChat();
}

function updateUI() {
    document.getElementById("userBalance").innerText = `₱${parseFloat(userData.balance).toFixed(3)}`;
    document.getElementById("myRefCode").innerText = userData.refCode;
    document.getElementById("refCount").innerText = userData.refCount || 0;
    document.getElementById("refEarned").innerText = (userData.refEarned || 0).toFixed(2);
    document.getElementById("taskTypeInfo").innerText = userData.freeTasks < 5 ? 
        `You have ${5 - userData.freeTasks} free slots left.` : 
        "Free slots used. Cost: ₱1.00 per 100 capacity.";
}

// --- Navigation ---
window.showSec = (id) => {
    document.querySelectorAll('main section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`sec-${id}`).classList.remove('hidden-section');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-tab'));
    event.currentTarget.classList.add('active-tab');
    if (id === 'profile') loadMyLinks();
};

// --- Tasks Logic ---
async function submitTask() {
    const url = document.getElementById("fbUrl").value;
    const def = document.getElementById("fbDef").value;
    if (!url || !def) return alert("Fill all fields");

    let isFree = userData.freeTasks < 5;
    if (!isFree && userData.balance < 1) return alert("Insufficient balance (₱1 needed)");

    const taskData = {
        url,
        definition: def,
        owner: userId,
        ownerName: username,
        capacity: 100,
        clicks: 0,
        reward: 0.01,
        type: isFree ? "free" : "paid"
    };

    const newTaskRef = push(ref(db, 'tasks'));
    await set(newTaskRef, taskData);

    if (isFree) {
        await update(ref(db, 'users/' + userId), { freeTasks: userData.freeTasks + 1 });
    } else {
        await update(ref(db, 'users/' + userId), { balance: userData.balance - 1 });
    }
    
    alert("Task Registered!");
    location.reload();
}

function loadTasks() {
    const tasksRef = ref(db, 'tasks');
    onValue(tasksRef, (snapshot) => {
        const container = document.getElementById("tasksContainer");
        container.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        Object.keys(data).forEach(key => {
            const task = data[key];
            // Hide if finished or already completed by user
            if (task.clicks >= task.capacity) return;
            if (userData.completedTasks && userData.completedTasks[key]) return;

            const div = document.createElement("div");
            div.className = "bg-gray-800 p-4 rounded-lg border-l-4 " + (task.type === 'admin' ? 'border-purple-500' : 'border-yellow-500');
            div.innerHTML = `
                <p class="text-xs text-gray-500 mb-1">${task.type === 'admin' ? 'OFFICIAL' : 'USER TASK'}</p>
                <h3 class="font-bold">${task.definition}</h3>
                <div class="flex justify-between items-center mt-3">
                    <span class="text-green-400 font-bold">₱${task.reward}</span>
                    <button onclick="startTask('${key}', '${task.url}', ${task.reward})" class="bg-yellow-600 px-4 py-1 rounded text-sm">Follow</button>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

// --- Task Execution & Ads ---
window.startTask = (taskId, url, reward) => {
    // Show 3 Ads (2 Monetag, 1 Adsgram)
    showMonetag();
    
    const AdController = window.Adsgram?.init({ blockId: "24438" });
    AdController?.show().then(() => {
        // After Ads, open FB and start timer
        tg.openLink(url);
        runTimer(taskId, reward);
    }).catch(() => {
        // Fallback if ads fail
        tg.openLink(url);
        runTimer(taskId, reward);
    });
};

function runTimer(taskId, reward) {
    const overlay = document.getElementById("timerOverlay");
    const countEl = document.getElementById("countdown");
    overlay.classList.remove("hidden");
    let count = 30;

    const timer = setInterval(async () => {
        count--;
        countEl.innerText = count;
        if (count <= 0) {
            clearInterval(timer);
            overlay.classList.add("hidden");
            await creditReward(taskId, reward);
            showSec('home');
        }
    }, 1000);
}

async function creditReward(taskId, reward) {
    // Logic to update user balance and task click count
    const userRef = ref(db, 'users/' + userId);
    const taskRef = ref(db, 'tasks/' + taskId);
    
    const taskSnap = await get(taskRef);
    if (!taskSnap.exists()) return;
    const task = taskSnap.val();

    // Reward User
    const newBalance = (userData.balance || 0) + reward;
    const completed = userData.completedTasks || {};
    completed[taskId] = true;
    
    await update(userRef, { 
        balance: newBalance,
        completedTasks: completed
    });

    // Handle Referral Commission (20%)
    if (userData.referredBy) {
        const refOwnerRef = ref(db, 'users/' + userData.referredBy);
        const refOwnerSnap = await get(refOwnerRef);
        if (refOwnerSnap.exists()) {
            const commission = reward * 0.20;
            const currentRefEarned = refOwnerSnap.val().refEarned || 0;
            const currentRefBal = refOwnerSnap.val().balance || 0;
            await update(refOwnerRef, {
                balance: currentRefBal + commission,
                refEarned: currentRefEarned + commission
            });
        }
    }

    // Update Task Capacity
    await update(taskRef, { clicks: (task.clicks || 0) + 1 });
    
    userData.balance = newBalance;
    userData.completedTasks = completed;
    updateUI();
    alert(`Success! Reward ₱${reward} credited.`);
}

// --- Wallet & Referral ---
window.submitDeposit = async () => {
    const name = document.getElementById("depName").value;
    const amount = document.getElementById("depAmount").value;
    const refNum = document.getElementById("depRef").value;
    const method = document.getElementById("depMethod").value;

    if (!name || !amount || !refNum) return alert("Fill all fields");

    const depRef = push(ref(db, 'deposits'));
    await set(depRef, {
        userId, username, name, amount: parseFloat(amount), refNum, method, status: "pending", timestamp: Date.now()
    });
    alert("Deposit submitted for approval!");
};

window.applyReferral = async () => {
    const code = document.getElementById("inputRef").value.trim().toUpperCase();
    if (userData.referredBy) return alert("Already referred");
    if (code === userData.refCode) return alert("Cannot refer yourself");

    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    const users = snapshot.val();

    let foundOwnerId = null;
    for (let id in users) {
        if (users[id].refCode === code) {
            foundOwnerId = id;
            break;
        }
    }

    if (foundOwnerId) {
        await update(ref(db, 'users/' + userId), { referredBy: foundOwnerId });
        const currentCount = users[foundOwnerId].refCount || 0;
        await update(ref(db, 'users/' + foundOwnerId), { refCount: currentCount + 1 });
        alert("Referral Applied!");
        location.reload();
    } else {
        alert("Invalid Code");
    }
};

// --- Chat Logic ---
function loadChat() {
    const chatRef = ref(db, 'chat');
    onValue(chatRef, (snapshot) => {
        const box = document.getElementById("chatBox");
        box.innerHTML = "";
        const data = snapshot.val();
        if (data) {
            Object.values(data).slice(-50).forEach(msg => {
                const p = document.createElement("div");
                p.className = "mb-2 text-sm";
                p.innerHTML = `<span class="text-yellow-500 font-bold">${msg.user}:</span> ${msg.text}`;
                box.appendChild(p);
            });
            box.scrollTop = box.scrollHeight;
        }
    });
}

window.sendMessage = async () => {
    const input = document.getElementById("chatInput");
    if (!input.value) return;
    await push(ref(db, 'chat'), { user: username, text: input.value, time: Date.now() });
    input.value = "";
};

// --- Profile / My Links ---
async function loadMyLinks() {
    const tasksRef = ref(db, 'tasks');
    const snapshot = await get(tasksRef);
    const container = document.getElementById("myLinksContainer");
    container.innerHTML = "";
    const data = snapshot.val();
    if (!data) return;

    Object.keys(data).forEach(key => {
        if (data[key].owner === userId) {
            const div = document.createElement("div");
            div.className = "bg-gray-800 p-3 rounded flex justify-between items-center text-sm";
            div.innerHTML = `
                <span>${data[key].definition} (${data[key].clicks}/${data[key].capacity})</span>
                <button onclick="deleteLink('${key}')" class="text-red-500">Delete</button>
            `;
            container.appendChild(div);
        }
    });
}

window.deleteLink = async (key) => {
    if (confirm("Delete this link?")) {
        await remove(ref(db, 'tasks/' + key));
        loadMyLinks();
    }
};

// --- Admin Panel Logic ---
window.checkAdmin = () => {
    if (document.getElementById("adminPass").value === "Propetas12") {
        document.getElementById("adminAuth").classList.add("hidden-section");
        document.getElementById("adminContent").classList.remove("hidden-section");
        loadAdminDeposits();
    } else {
        alert("Wrong Password");
    }
};

function loadAdminDeposits() {
    const depRef = ref(db, 'deposits');
    onValue(depRef, (snapshot) => {
        const container = document.getElementById("adminDeposits");
        container.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        Object.keys(data).forEach(key => {
            if (data[key].status === 'pending') {
                const div = document.createElement("div");
                div.className = "bg-gray-700 p-2 rounded text-xs";
                div.innerHTML = `
                    <p>User: ${data[key].username} | Amt: ${data[key].amount}</p>
                    <p>Ref: ${data[key].refNum} (${data[key].method})</p>
                    <button onclick="approveDep('${key}', '${data[key].userId}', ${data[key].amount})" class="bg-green-600 px-2 py-1 mt-1 rounded">Approve</button>
                `;
                container.appendChild(div);
            }
        });
    });
}

window.approveDep = async (depKey, targetUid, amount) => {
    const userRef = ref(db, 'users/' + targetUid);
    const snap = await get(userRef);
    if (snap.exists()) {
        const newBal = (snap.val().balance || 0) + amount;
        await update(userRef, { balance: newBal });
        await update(ref(db, 'deposits/' + depKey), { status: "approved" });
        alert("Approved!");
    }
};

window.postAdminTask = async () => {
    const url = document.getElementById("admUrl").value;
    const def = document.getElementById("admDef").value;
    const taskData = {
        url, definition: def, owner: "admin", capacity: 100000, clicks: 0, reward: 0.021, type: "admin"
    };
    await push(ref(db, 'tasks'), taskData);
    alert("Admin Task Posted!");
};

// Initialize
initUser();
// Auto Interstitial Cooldown
setInterval(showMonetag, 180000); // 3 minutes
