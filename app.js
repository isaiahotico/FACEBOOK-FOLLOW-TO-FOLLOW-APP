
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, remove, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";


const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "facebook-follow-to-follow.firebaseapp.com",
    databaseURL: "https://facebook-follow-to-follow-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facebook-follow-to-follow",
    storageBucket: "facebook-follow-to-follow.firebasestorage.app",
    messagingSenderId: "589427984313",
    appId: "1:589427984313:web:a17b8cc851efde6dd79868"
};



const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Telegram Initialization ---
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const userId = tgUser?.id || "888888"; // Fallback for testing
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_User";

document.getElementById("userBar").innerText = "👤 " + username;

let userData = {};

// --- Monetag Control ---
function triggerInterstitial() {
    if (typeof show_10555746 === 'function') {
        show_10555746({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
}

// --- Data Core ---
async function initUser() {
    const userRef = ref(db, 'users/' + userId);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
        const genCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        userData = {
            balance: 0,
            freeTasks: 0,
            refCode: genCode,
            refCount: 0,
            refEarned: 0,
            referredBy: "",
            completedTasks: {}
        };
        await set(userRef, userData);
    } else {
        userData = snapshot.val();
        if (!userData.completedTasks) userData.completedTasks = {};
    }
    updateUI();
    loadTasks();
    loadChat();
}

function updateUI() {
    document.getElementById("userBalance").innerText = `₱${parseFloat(userData.balance || 0).toFixed(3)}`;
    document.getElementById("myRefCode").innerText = userData.refCode;
    document.getElementById("refCount").innerText = userData.refCount || 0;
    document.getElementById("refEarned").innerText = (userData.refEarned || 0).toFixed(2);
    
    const infoBox = document.getElementById("taskTypeInfo");
    if (userData.freeTasks < 5) {
        infoBox.innerHTML = `🎁 You have <b class="text-white">${5 - userData.freeTasks} FREE</b> promo slots left.`;
    } else {
        infoBox.innerHTML = `💳 No free slots. Cost: <b class="text-white">₱1.00</b> (100 Capacity)`;
    }
}

// --- Navigation ---
window.showSec = (id) => {
    document.querySelectorAll('main section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`sec-${id}`).classList.remove('hidden-section');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-tab'));
    const btn = event.currentTarget;
    if(btn) btn.classList.add('active-tab');
    
    if (id === 'profile') loadMyLinks();
};

// --- Link Registration Logic (FIXED) ---
window.submitTask = async () => {
    const url = document.getElementById("fbUrl").value.trim();
    const def = document.getElementById("fbDef").value.trim();

    if (!url || !def) return alert("Please provide both URL and Definition.");
    if (!url.includes("facebook.com")) return alert("Please enter a valid Facebook link.");

    const isFree = userData.freeTasks < 5;
    if (!isFree && userData.balance < 1) return alert("Insufficient balance! Registration costs ₱1.00.");

    const taskData = {
        url,
        definition: def,
        owner: userId,
        ownerName: username,
        capacity: 100,
        clicks: 0,
        reward: 0.01,
        type: isFree ? "free" : "paid",
        createdAt: Date.now()
    };

    try {
        const tasksRef = ref(db, 'tasks');
        const newTaskRef = push(tasksRef);
        await set(newTaskRef, taskData);

        if (isFree) {
            await update(ref(db, 'users/' + userId), { freeTasks: (userData.freeTasks || 0) + 1 });
        } else {
            await update(ref(db, 'users/' + userId), { balance: userData.balance - 1 });
        }

        alert("Link Registered Successfully! It is now live in the Tasks section.");
        document.getElementById("fbUrl").value = "";
        document.getElementById("fbDef").value = "";
        location.reload(); 
    } catch (e) {
        alert("Error: " + e.message);
    }
};

// --- Tasks Visibility Logic (FIXED) ---
function loadTasks() {
    const tasksRef = ref(db, 'tasks');
    onValue(tasksRef, (snapshot) => {
        const container = document.getElementById("tasksContainer");
        container.innerHTML = "";
        const data = snapshot.val();
        
        if (!data) {
            container.innerHTML = `<div class="text-center py-10 text-gray-500">No active tasks. Be the first to post!</div>`;
            return;
        }

        let taskCount = 0;
        Object.keys(data).forEach(key => {
            const task = data[key];
            
            // AUTO-HIDE: Skip if user finished OR capacity reached
            if (userData.completedTasks && userData.completedTasks[key]) return;
            if (task.clicks >= task.capacity) return;

            taskCount++;
            const div = document.createElement("div");
            div.className = "bg-gray-800 p-5 rounded-2xl border-l-4 border-yellow-500 shadow-lg animate-fadeIn transition-all hover:bg-gray-750";
            if(task.type === 'admin') div.className = "bg-gray-800 p-5 rounded-2xl border-l-4 border-purple-500 shadow-xl border border-purple-900/30";

            div.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[9px] font-black px-2 py-0.5 rounded bg-gray-900 text-gray-400 uppercase tracking-tighter">
                        ${task.type === 'admin' ? '🔥 Official Task' : '👤 User Promo'}
                    </span>
                    <span class="text-xs text-gray-500">${task.clicks}/${task.capacity} Follows</span>
                </div>
                <h3 class="font-bold text-gray-100 text-lg mb-4 leading-tight">${task.definition}</h3>
                <div class="flex justify-between items-center">
                    <div>
                        <p class="text-[10px] text-gray-500 uppercase font-bold">Reward</p>
                        <p class="text-green-400 font-black text-xl">₱${task.reward}</p>
                    </div>
                    <button onclick="startTask('${key}', '${task.url}', ${task.reward})" class="bg-yellow-600 hover:bg-yellow-500 text-black font-black px-6 py-2 rounded-xl text-sm transition-transform active:scale-90">FOLLOW</button>
                </div>
            `;
            container.appendChild(div);
        });

        if(taskCount === 0) {
            container.innerHTML = `<div class="text-center py-10 text-gray-500 italic">No tasks available right now.</div>`;
        }
    });
}

// --- Task Execution & Ads Flow ---
window.startTask = (taskId, url, reward) => {
    // Show 3 Ads immediately
    triggerInterstitial(); // Monetag 1
    
    // Adsgram (Reward Ad)
    const AdController = window.Adsgram?.init({ blockId: "24438" });
    AdController?.show().then(() => {
        proceedToFacebook(taskId, url, reward);
    }).catch(() => {
        // Fallback to avoid breaking user experience
        proceedToFacebook(taskId, url, reward);
    });
};

function proceedToFacebook(taskId, url, reward) {
    tg.openLink(url);
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
            await finalizeReward(taskId, reward);
        }
    }, 1000);
}

async function finalizeReward(taskId, reward) {
    const userRef = ref(db, 'users/' + userId);
    const taskRef = ref(db, 'tasks/' + taskId);
    
    const taskSnap = await get(taskRef);
    if (!taskSnap.exists()) return;
    const task = taskSnap.val();

    // Reward Logic
    const newBal = (userData.balance || 0) + reward;
    const completed = userData.completedTasks || {};
    completed[taskId] = true;
    
    await update(userRef, { 
        balance: newBal,
        completedTasks: completed
    });

    // Referral Commission (20%)
    if (userData.referredBy) {
        const refOwnerRef = ref(db, 'users/' + userData.referredBy);
        const refOwnerSnap = await get(refOwnerRef);
        if (refOwnerSnap.exists()) {
            const comm = reward * 0.20;
            const rData = refOwnerSnap.val();
            await update(refOwnerRef, {
                balance: (rData.balance || 0) + comm,
                refEarned: (rData.refEarned || 0) + comm
            });
        }
    }

    // Update Task Usage
    await update(taskRef, { clicks: (task.clicks || 0) + 1 });
    
    userData.balance = newBal;
    userData.completedTasks = completed;
    updateUI();
    alert(`Success! ₱${reward} credited to your account.`);
    showSec('home');
}

// --- Wallet & Referral ---
window.submitDeposit = async () => {
    const name = document.getElementById("depName").value;
    const amount = document.getElementById("depAmount").value;
    const refNum = document.getElementById("depRef").value;
    const method = document.getElementById("depMethod").value;

    if (!name || !amount || !refNum) return alert("Fill all payment details.");

    const dRef = push(ref(db, 'deposits'));
    await set(dRef, {
        userId, username, name, amount: parseFloat(amount), refNum, method, status: "pending", time: Date.now()
    });
    alert("Deposit request sent to Admin. Please wait for approval.");
};

window.applyReferral = async () => {
    const code = document.getElementById("inputRef").value.trim().toUpperCase();
    if (userData.referredBy) return alert("You have already used a referral code.");
    if (code === userData.refCode) return alert("You cannot refer yourself.");

    const usersRef = ref(db, 'users');
    const snap = await get(usersRef);
    const users = snap.val();

    let ownerId = null;
    for (let id in users) {
        if (users[id].refCode === code) { ownerId = id; break; }
    }

    if (ownerId) {
        await update(ref(db, 'users/' + userId), { referredBy: ownerId });
        const currentCount = users[ownerId].refCount || 0;
        await update(ref(db, 'users/' + ownerId), { refCount: currentCount + 1 });
        alert("Referral bonus activated!");
        location.reload();
    } else {
        alert("Invalid referral code.");
    }
};

// --- Chat ---
function loadChat() {
    const chatRef = query(ref(db, 'chat'), limitToLast(30));
    onValue(chatRef, (snapshot) => {
        const box = document.getElementById("chatBox");
        box.innerHTML = "";
        const data = snapshot.val();
        if (data) {
            Object.values(data).forEach(msg => {
                const isMe = msg.user === username;
                const div = document.createElement("div");
                div.className = `max-w-[80%] p-3 rounded-2xl text-sm ${isMe ? 'bg-yellow-600 ml-auto rounded-tr-none text-black font-bold' : 'bg-gray-700 rounded-tl-none'}`;
                div.innerHTML = `<p class="text-[10px] opacity-60 mb-1">${msg.user}</p>${msg.text}`;
                box.appendChild(div);
            });
            box.scrollTop = box.scrollHeight;
        }
    });
}

window.sendMessage = async () => {
    const inp = document.getElementById("chatInput");
    if (!inp.value.trim()) return;
    await push(ref(db, 'chat'), { user: username, text: inp.value, time: Date.now() });
    inp.value = "";
};

// --- Profile / My Links ---
async function loadMyLinks() {
    const tasksRef = ref(db, 'tasks');
    const snap = await get(tasksRef);
    const container = document.getElementById("myLinksContainer");
    container.innerHTML = "";
    const data = snap.val();
    if (!data) return;

    Object.keys(data).forEach(key => {
        if (data[key].owner === userId) {
            const div = document.createElement("div");
            div.className = "bg-gray-800 p-4 rounded-xl flex justify-between items-center border border-gray-700";
            div.innerHTML = `
                <div>
                    <p class="font-bold text-sm">${data[key].definition}</p>
                    <p class="text-[10px] text-gray-500">${data[key].clicks} / ${data[key].capacity} follows</p>
                </div>
                <button onclick="deleteLink('${key}')" class="bg-red-900/50 text-red-500 p-2 rounded-lg text-xs font-bold border border-red-900">DELETE</button>
            `;
            container.appendChild(div);
        }
    });
}

window.deleteLink = async (key) => {
    if (confirm("Permanently delete this promo?")) {
        await remove(ref(db, 'tasks/' + key));
        loadMyLinks();
    }
};

// --- Admin Operations ---
window.checkAdmin = () => {
    if (document.getElementById("adminPass").value === "Propetas12") {
        document.getElementById("adminAuth").classList.add("hidden-section");
        document.getElementById("adminContent").classList.remove("hidden-section");
        loadAdminDeposits();
        loadAdminTasksManagement();
    } else {
        alert("Invalid Admin Key.");
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
                div.className = "bg-gray-900 p-3 rounded-lg border border-gray-700 text-[11px]";
                div.innerHTML = `
                    <p><b>User:</b> ${data[key].username}</p>
                    <p><b>Amt:</b> ₱${data[key].amount} via ${data[key].method}</p>
                    <p class="text-yellow-500"><b>Ref:</b> ${data[key].refNum}</p>
                    <button onclick="approveDep('${key}', '${data[key].userId}', ${data[key].amount})" class="bg-green-600 w-full mt-2 py-1 rounded font-bold">APPROVE</button>
                `;
                container.appendChild(div);
            }
        });
    });
}

window.approveDep = async (depKey, targetUid, amount) => {
    const targetRef = ref(db, 'users/' + targetUid);
    const snap = await get(targetRef);
    if (snap.exists()) {
        const currentBal = snap.val().balance || 0;
        await update(targetRef, { balance: currentBal + amount });
        await update(ref(db, 'deposits/' + depKey), { status: "approved" });
        alert("Deposit Processed!");
    }
};

window.postAdminTask = async () => {
    const url = document.getElementById("admUrl").value;
    const def = document.getElementById("admDef").value;
    if(!url || !def) return alert("Fill all fields");
    const taskData = {
        url, definition: def, owner: "admin", capacity: 100000, clicks: 0, reward: 0.021, type: "admin", createdAt: Date.now()
    };
    await push(ref(db, 'tasks'), taskData);
    alert("Admin Task Live!");
};

// --- NEW: Admin Task Management (MANUAL DELETE) ---
function loadAdminTasksManagement() {
    const tasksRef = ref(db, 'tasks');
    onValue(tasksRef, (snapshot) => {
        const container = document.getElementById("adminAllTasks");
        container.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        Object.keys(data).forEach(key => {
            const div = document.createElement("div");
            div.className = "bg-gray-900 p-2 rounded flex justify-between items-center text-[10px] border border-gray-800";
            div.innerHTML = `
                <span class="truncate mr-2"><b>[${data[key].ownerName}]</b> ${data[key].definition}</span>
                <button onclick="deleteLink('${key}')" class="bg-red-600 px-2 py-1 rounded font-bold">DEL</button>
            `;
            container.appendChild(div);
        });
    });
}

// Global Cooldown Ad
setInterval(triggerInterstitial, 180000); 

initUser();
