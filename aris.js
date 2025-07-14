import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getDatabase, ref, push, get, set, update, remove, child
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import {
  getStorage, ref as sRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

// ✅ Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBs7Ig4mXccOco7uLwZrzcUPGOxYgjEhfw",
  authDomain: "myvoiceai07.firebaseapp.com",
  projectId: "myvoiceai07",
  storageBucket: "myvoiceai07.appspot.com",
  messagingSenderId: "612070825870",
  appId: "1:612070825870:web:787c63ec83c8eec3e2cedf",
  measurementId: "G-DD4NL3DM6Z",
  databaseURL: "https://myvoiceai07-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);

// ✅ User Identity
const currentUserId = localStorage.getItem("aris-user") || "guest";
const currentUserName = localStorage.getItem("aris-name") || "User";

let knowledge = [];
let currentChatId = Date.now().toString();
let currentChatName = "Untitled";
let correctPassword = "1234";
let attempts = 0;
const maxAttempts = 3;

// 🔧 Elements
const chatBox = document.getElementById("chat-box");
const input = document.getElementById("userInput");
const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");

// 📥 Load knowledge
fetch("aris-knowledge.json")
  .then(res => res.json())
  .then(data => knowledge = data);

// 🎤 Voice
document.getElementById("voiceBtn").addEventListener("click", startVoice);
document.getElementById("sendBtn").addEventListener("click", sendMsg);

// 💬 Display Message
function appendMessage(type, text) {
  const div = document.createElement("div");
  div.className = `msg ${type}`;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 🖼️ Display Image
function appendImage(type, imageUrl) {
  const div = document.createElement("div");
  div.className = `msg ${type}`;
  const img = document.createElement("img");
  img.src = imageUrl;
  img.style.maxWidth = "200px";
  img.style.borderRadius = "10px";
  img.style.marginTop = "0.5rem";
  div.appendChild(img);
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 📤 Send Message
function sendMsg() {
  const msg = input.value.trim();
  if (!msg) return;
  appendMessage("user", msg);
  storeToFirebase("user", msg);
  processInput(msg.toLowerCase());
  input.value = "";
}

// 🧠 AI Processing + Memory
async function processInput(msg) {
  msg = msg.toLowerCase().trim();
  let reply = "🤔 I don't know that yet, but I’ve saved your question to learn.";

  const learnedRef = ref(db, `learned/${encodeURIComponent(msg)}`);
  const learnedSnap = await get(learnedRef);
  if (learnedSnap.exists()) {
    reply = learnedSnap.val();
  } else {
    const exact = knowledge.find(k => msg === k.command);
    const keyword = knowledge.find(k => msg.includes(k.command));
    if (exact) reply = getDynamicResponse(exact.response);
    else if (keyword) reply = getDynamicResponse(keyword.response);
    else {
      const unknownRef = ref(db, `unknown`);
      push(unknownRef, {
        question: msg,
        timestamp: new Date().toLocaleString(),
        user: currentUserId
      });
    }
  }

  appendMessage("aris", reply);
  storeToFirebase("aris", reply);
}

function getDynamicResponse(text) {
  if (text.includes("date")) return `📅 Today is ${new Date().toDateString()}`;
  if (text.includes("time")) return `⏰ It's ${new Date().toLocaleTimeString()}`;
  return text;
}

// 💾 Store to Firebase (per user)
function storeToFirebase(sender, text) {
  const msgRef = ref(db, `users/${currentUserId}/chat/${currentChatId}/messages`);
  push(msgRef, {
    sender,
    text,
    timestamp: new Date().toLocaleString()
  });

  const metaRef = ref(db, `users/${currentUserId}/chat/${currentChatId}/meta`);
  set(metaRef, {
    name: currentChatName,
    startedAt: new Date().toLocaleString()
  });
}

// 🔐 Lock screen & TEACH bypass
window.checkPassword = function () {
  const inputVal = document.getElementById("passwordInput").value.trim();
  const error = document.getElementById("errorMsg");

  if (inputVal.toUpperCase() === "TEACH") {
    window.location.href = "teach.html";
    return;
  }

  if (inputVal === correctPassword) {
    document.getElementById("lock-screen").style.display = "none";
  } else {
    attempts++;
    error.textContent = `Wrong password (${attempts}/${maxAttempts})`;
    appendMessage("aris", "⚠️ Wrong password attempt detected.");
    intruderCapture();
    if (attempts >= maxAttempts) {
      error.textContent = "Too many wrong attempts!";
    }
  }
};

// 📸 Intruder Capture
function intruderCapture() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      video.srcObject = stream;
      setTimeout(() => {
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        video.srcObject.getTracks().forEach(track => track.stop());

        canvas.toBlob(blob => {
          const filename = `intruders/${currentUserId}_${Date.now()}.jpg`;
          const storageRef = sRef(storage, filename);
          uploadBytes(storageRef, blob).then(snapshot => {
            getDownloadURL(snapshot.ref).then(url => {
              const logRef = ref(db, `intruders`);
              push(logRef, {
                user: currentUserId,
                photoURL: url,
                timestamp: Date.now()
              });

              appendMessage("aris", "📸 Intruder photo captured.");
              appendImage("aris", url);
            });
          });
        }, "image/jpeg");
      }, 1000);
    })
    .catch(err => {
      console.error("Camera error:", err);
    });
}

// 🎤 Voice
function startVoice() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "en-US";
  recognition.onresult = function (event) {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    sendMsg();
  };
  recognition.start();
}

// 🆕 Start New Chat
window.startNewChat = function () {
  const name = prompt("Name this chat session:");
  currentChatId = Date.now().toString();
  currentChatName = name || `Chat_${currentChatId}`;
  chatBox.innerHTML = `<h4>🆕 New Chat: ${currentChatName}</h4>`;
};

// 📚 Load Old Chats
window.loadOldChats = async function () {
  const chatRef = ref(db, `users/${currentUserId}/chat`);
  const snapshot = await get(chatRef);
  if (!snapshot.exists()) {
    alert("No old chats found.");
    return;
  }

  chatBox.innerHTML = "<h4>📚 Old Chats:</h4>";
  const data = snapshot.val();

  for (let sessionId in data) {
    const session = data[sessionId];
    const meta = session.meta?.name || sessionId;
    chatBox.innerHTML += `<h5>🗂 ${meta} (${sessionId})</h5>`;
    for (let msgId in session.messages) {
      const { sender, text, timestamp } = session.messages[msgId];
      const type = sender === "user" ? "user" : "aris";
      chatBox.innerHTML += `<div class="msg ${type}">🕓 ${timestamp}<br/>${text}</div>`;
    }
    chatBox.innerHTML += "<hr/>";
  }

  chatBox.scrollTop = chatBox.scrollHeight;
};

// 🔄 Resume Chat
window.resumeChat = async function () {
  const id = prompt("Enter Chat ID to resume:");
  if (!id) return;
  currentChatId = id;

  const sessionRef = ref(db, `users/${currentUserId}/chat/${currentChatId}/messages`);
  const snapshot = await get(sessionRef);
  if (!snapshot.exists()) {
    alert("Chat not found.");
    return;
  }

  chatBox.innerHTML = `<h4>🔄 Resumed Chat: ${currentChatId}</h4>`;
  const data = snapshot.val();
  for (let msgId in data) {
    const { sender, text, timestamp } = data[msgId];
    const type = sender === "user" ? "user" : "aris";
    chatBox.innerHTML += `<div class="msg ${type}">🕓 ${timestamp}<br/>${text}</div>`;
  }
};

// 👤 Save User Prefs
window.saveUserInfo = function () {
  const name = prompt("Your name?");
  const favColor = prompt("Favorite color?");
  const refUser = ref(db, `users/${currentUserId}/prefs`);
  set(refUser, {
    name,
    favoriteColor: favColor
  });
  localStorage.setItem("aris-name", name);
  alert("✅ Saved! I’ll remember you.");
};

// 👤 Load User Prefs
window.loadUserInfo = async function () {
  const refUser = ref(db, `users/${currentUserId}/prefs`);
  const snapshot = await get(refUser);
  if (snapshot.exists()) {
    const data = snapshot.val();
    appendMessage("aris", `👋 Welcome back, ${data.name}! I remember your favorite color is ${data.favoriteColor}.`);
  }
};

window.addEventListener("load", loadUserInfo);