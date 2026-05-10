import "./style.css";
import { invoke } from "@tauri-apps/api/core";

/* ELEMENTS */
const messages = document.getElementById("messages");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("send-btn");
const modelSelect = document.getElementById("mode-select");

const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const closeSettingsBtn = document.getElementById("close-settings");
const messengerBtn = document.getElementById("messenger-btn");

const nameInput = document.getElementById("name-input");
const displayName = document.getElementById("display-name");

const pfpUpload = document.getElementById("pfp-upload");
const pfpPreview = document.getElementById("pfp-preview");
const settingsPfpPreview = document.getElementById("settings-pfp-preview");

const uploadBtn = document.getElementById("upload-btn");
const fileUpload = document.getElementById("file-upload");

const newChatBtn = document.getElementById("new-chat");
const chatHistory = document.getElementById("chat-history");

const bgPicker = document.getElementById("bg-color");
const userPicker = document.getElementById("user-color");
const aiPicker = document.getElementById("ai-color");
const textPicker = document.getElementById("text-color");
const resetBtn = document.getElementById("reset-theme");

const tutorialModal = document.getElementById("tutorial-modal");
const tutorialText = document.getElementById("tutorial-text");
const nextTutorialBtn = document.getElementById("next-tutorial");
const skipTutorialBtn = document.getElementById("skip-tutorial");

const modeRecommendModal = document.getElementById("mode-recommend-modal");
const modeRecommendText = document.getElementById("mode-recommend-text");
const chooseLiteBtn = document.getElementById("choose-lite");
const chooseProBtn = document.getElementById("choose-pro");

const liteCard = document.getElementById("lite-card");
const proCard = document.getElementById("pro-card");

/* STATE */
let currentUploadedImage = null;
let currentUploadedText = null;
let currentUploadedFileName = null;
let messengerModeOpen = false;
let messengerPoller = null;

let chats = JSON.parse(localStorage.getItem("phoenixChats")) || [];
let currentChatId = localStorage.getItem("phoenixCurrentChatId") || null;

/* SAVE / LOAD */
function saveChats() {
  localStorage.setItem("phoenixChats", JSON.stringify(chats));

  if (currentChatId) {
    localStorage.setItem("phoenixCurrentChatId", currentChatId);
  }
}

function saveSettings() {
  localStorage.setItem(
    "phoenixSettings",
    JSON.stringify({
      name: nameInput.value,
      pfp: pfpPreview.src,
      bg: bgPicker.value,
      user: userPicker.value,
      ai: aiPicker.value,
      text: textPicker.value,
    })
  );
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem("phoenixSettings"));
  if (!saved) return;

  if (saved.name) {
    nameInput.value = saved.name;
    displayName.textContent = saved.name;
  }

  if (saved.pfp) {
    pfpPreview.src = saved.pfp;

    if (settingsPfpPreview) {
      settingsPfpPreview.src = saved.pfp;
    }
  }

  if (saved.bg) {
    bgPicker.value = saved.bg;
    document.documentElement.style.setProperty("--bg", saved.bg);
  }

  if (saved.user) {
    userPicker.value = saved.user;
    document.documentElement.style.setProperty("--user-bubble", saved.user);
  }

  if (saved.ai) {
    aiPicker.value = saved.ai;
    document.documentElement.style.setProperty("--ai-bubble", saved.ai);
  }

  if (saved.text) {
    textPicker.value = saved.text;
    document.documentElement.style.setProperty("--text", saved.text);
  }
}

/* MESSAGES */
function addMessage(text, who, save = true) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;

  div.innerHTML = `
    <div class="msg-header">
      ${who === "ai" ? "🔥 PHOENIX AI <span>🏅 GOLD</span>" : "You"}
    </div>
    <div class="msg-body">${text}</div>
  `;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;

  if (save && currentChatId) {
    const chat = chats.find((c) => c.id === currentChatId);

    if (chat) {
      chat.messages.push({ text, who });
      saveChats();
    }
  }
}

function addImageToChat(imageUrl, save = true) {
  const img = document.createElement("img");

  img.src = imageUrl;
  img.style.maxWidth = "320px";
  img.style.borderRadius = "18px";
  img.style.marginTop = "10px";
  img.style.marginBottom = "10px";
  img.style.boxShadow = "0 18px 45px rgba(0,0,0,0.35)";

  messages.appendChild(img);
  messages.scrollTop = messages.scrollHeight;

  if (save && currentChatId) {
    const chat = chats.find((c) => c.id === currentChatId);

    if (chat) {
      chat.messages.push({
        who: "image",
        text: imageUrl,
      });

      saveChats();
    }
  }
}

function typeMessage(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;

  const header = document.createElement("div");
  header.className = "msg-header";
  header.innerHTML =
    who === "ai" ? "🔥 PHOENIX AI <span>🏅 GOLD</span>" : "You";

  const body = document.createElement("div");
  body.className = "msg-body";

  div.appendChild(header);
  div.appendChild(body);
  messages.appendChild(div);

  let i = 0;

  function type() {
    if (i < text.length) {
      body.textContent += text[i];
      i++;
      messages.scrollTop = messages.scrollHeight;
      setTimeout(type, 12);
    }
  }

  type();

  if (currentChatId) {
    const chat = chats.find((c) => c.id === currentChatId);

    if (chat) {
      chat.messages.push({ text, who });
      saveChats();
    }
  }
}

/* HISTORY */
function renderHistory() {
  chatHistory.innerHTML = "";

  if (chats.length === 0) {
    chatHistory.innerHTML = `
      <div id="empty-history">
        Start a chat to see history
      </div>
    `;
    return;
  }

  chats.forEach((chat) => {
    const item = document.createElement("div");

    item.className =
      chat.id === currentChatId ? "history-item active" : "history-item";

    item.textContent = chat.title;

    item.onclick = () => {
      messengerModeOpen = false;
      currentChatId = chat.id;
      saveChats();
      loadChat(chat.id);
      renderHistory();
    };

    chatHistory.appendChild(item);
  });
}

function createNewChat(title = "New Chat") {
  const id = Date.now().toString();

  const chat = {
    id,
    title,
    messages: [],
  };

  chats.unshift(chat);
  currentChatId = id;

  saveChats();
  renderHistory();

  return chat;
}

function loadChat(id) {
  const chat = chats.find((c) => c.id === id);
  if (!chat) return;

  messages.innerHTML = "";

  chat.messages.forEach((msg) => {
    if (msg.who === "image") {
      addImageToChat(msg.text, false);
    } else {
      addMessage(msg.text, msg.who, false);
    }
  });
}

function startNewChat() {
  messengerModeOpen = false;
  messages.innerHTML = "";

  currentUploadedImage = null;
  currentUploadedText = null;
  currentUploadedFileName = null;

  createNewChat("New Chat");

  addMessage("New chat started. What would you like to ask Phoenix AI?", "ai");

  promptInput.focus();
}

/* SEND MESSAGE */
async function sendMessage() {
  const prompt = promptInput.value.trim();

  if (!prompt) return;

  if (!currentChatId) {
    createNewChat(prompt.length > 32 ? prompt.substring(0, 32) + "..." : prompt);
  }

  const chat = chats.find((c) => c.id === currentChatId);

  if (chat && chat.title === "New Chat") {
    chat.title = prompt.length > 32 ? prompt.substring(0, 32) + "..." : prompt;
    saveChats();
    renderHistory();
  }

  addMessage(prompt, "user");

  if (checkSecretCodes(prompt)) {
    promptInput.value = "";
    return;
  }

  if (modelSelect.value === "image-fast") {
    promptInput.value = "";

    const typing = document.getElementById("typing-indicator");
    if (typing) typing.classList.remove("hidden");

    try {
      const imageUrl = await invoke("generate_image_sdxl", {
        prompt,
      });

      if (typing) typing.classList.add("hidden");

      addMessage("🎨 Generated image:", "ai");
      addImageToChat(imageUrl);
    } catch (err) {
      if (typing) typing.classList.add("hidden");
      addMessage("Image generation error: " + err, "ai");
    }

    return;
  }

  let finalPrompt = prompt;

  if (currentUploadedText) {
    finalPrompt = `
The user uploaded a text file named "${currentUploadedFileName}".

File contents:
${currentUploadedText}

User question:
${prompt}
`;
  }

  if (currentUploadedImage) {
    finalPrompt = `
The user uploaded an image named "${currentUploadedFileName}".

User question:
${prompt}
`;
  }

  promptInput.value = "";

  const typing = document.getElementById("typing-indicator");
  if (typing) typing.classList.remove("hidden");

  try {
    const response = await invoke("run_local_ai", {
      model:
        modelSelect.value === "high"
          ? "Qwen2_7B"
          : modelSelect.value === "vision"
          ? "VisionAI"
          : "Phi3Mini",

      prompt: finalPrompt,
      image: currentUploadedImage,
    });

    if (typing) typing.classList.add("hidden");

    typeMessage(response, "ai");
  } catch (err) {
    if (typing) typing.classList.add("hidden");
    addMessage("Error: " + err, "ai");
  }
}

/* SETTINGS */
function applyTheme() {
  document.documentElement.style.setProperty("--bg", bgPicker.value);
  document.documentElement.style.setProperty("--user-bubble", userPicker.value);
  document.documentElement.style.setProperty("--ai-bubble", aiPicker.value);
  document.documentElement.style.setProperty("--text", textPicker.value);

  saveSettings();
}

settingsBtn.onclick = () => {
  settingsModal.classList.remove("hidden");
  updateModeCards();
};

closeSettingsBtn.onclick = () => {
  settingsModal.classList.add("hidden");
};

nameInput.oninput = () => {
  displayName.textContent = nameInput.value || "PHOENIX 🏅";
  saveSettings();
};

pfpUpload.onchange = () => {
  const file = pfpUpload.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    pfpPreview.src = e.target.result;

    if (settingsPfpPreview) {
      settingsPfpPreview.src = e.target.result;
    }

    saveSettings();
  };

  reader.readAsDataURL(file);
};

bgPicker.oninput = applyTheme;
userPicker.oninput = applyTheme;
aiPicker.oninput = applyTheme;
textPicker.oninput = applyTheme;

resetBtn.onclick = () => {
  localStorage.removeItem("phoenixSettings");
  location.reload();
};

/* ATTACHMENT UPLOAD */
uploadBtn.onclick = () => {
  fileUpload.click();
};

fileUpload.onchange = () => {
  const file = fileUpload.files[0];

  if (!file) return;

  currentUploadedFileName = file.name;

  addMessage(`📎 Uploaded: ${file.name}`, "user");

  if (file.type.startsWith("image/")) {
    const reader = new FileReader();

    reader.onload = (e) => {
      currentUploadedImage = e.target.result;
      currentUploadedText = null;

      addImageToChat(currentUploadedImage);

      addMessage(
        "Image attached. Ask me something like: “describe this image.”",
        "ai"
      );
    };

    reader.readAsDataURL(file);
    return;
  }

  if (file.type.includes("text") || file.name.endsWith(".txt")) {
    const reader = new FileReader();

    reader.onload = (e) => {
      currentUploadedText = e.target.result;
      currentUploadedImage = null;

      addMessage("Text file attached. Ask me something about it.", "ai");
    };

    reader.readAsText(file);
    return;
  }

  currentUploadedImage = null;
  currentUploadedText = null;

  addMessage(
    "File attached, but Phoenix can currently read images and text files best.",
    "ai"
  );
};

/* BUTTONS */
newChatBtn.onclick = startNewChat;
sendBtn.onclick = sendMessage;

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

/* MESSENGER */
function addMessengerBubble(text, who) {
  const bubble = document.createElement("div");
  bubble.className = `messenger-bubble ${who}`;
  bubble.textContent = text;

  const chat = document.getElementById("messenger-chat");

  if (chat) {
    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;
  }
}

async function pollMessengerMessages() {
  if (!messengerModeOpen) return;

  try {
    const newMessages = await invoke("get_messenger_messages");

    newMessages.forEach((msg) => {
      if (msg.startsWith("ME: ")) {
        addMessengerBubble(msg.replace("ME: ", ""), "me");
      } else if (msg.startsWith("FRIEND: ")) {
        addMessengerBubble(msg.replace("FRIEND: ", ""), "other");
      } else if (msg.startsWith("SYSTEM: ")) {
        addMessengerBubble(msg.replace("SYSTEM: ", ""), "other");
      } else {
        addMessengerBubble(msg, "other");
      }
    });
  } catch (err) {
    console.log("Messenger polling error:", err);
  }
}

function openMessengerPage() {
  messengerModeOpen = true;

  document
    .querySelectorAll("#nav button")
    .forEach((b) => b.classList.remove("active"));

  messengerBtn.classList.add("active");

  messages.innerHTML = "";

  const panel = document.createElement("div");
  panel.id = "messenger-panel";

  panel.innerHTML = `
    <div class="messenger-card">
      <h2>📡 Phoenix Messenger</h2>
      <p>Local Wi-Fi chat. No internet needed.</p>

      <div class="messenger-actions">
        <button id="create-room-btn">Create Room</button>
        <button id="join-room-btn">Join Room</button>
      </div>

      <input
        id="room-ip-input"
        placeholder="Host IP, example: 192.168.1.24:7878"
      />

      <div id="messenger-status">
        Not connected
      </div>
    </div>

    <div id="messenger-chat"></div>

    <div id="messenger-input-row">
      <input
        id="messenger-input"
        placeholder="Type a message..."
      />

      <button id="messenger-send-btn">
        Send
      </button>
    </div>
  `;

  messages.appendChild(panel);

  document.getElementById("create-room-btn").onclick = async () => {
    const status = document.getElementById("messenger-status");

    try {
      const serverMsg = await invoke("start_messenger_server");
      const ip = await invoke("get_local_ip");

      status.textContent = `${serverMsg} Your room address: ${ip}`;
      addMessengerBubble(`Room created. Share this address: ${ip}`, "other");
    } catch (err) {
      status.textContent = "Error: " + err;
      addMessengerBubble("Error: " + err, "other");
    }
  };

  document.getElementById("join-room-btn").onclick = async () => {
    const ip = document.getElementById("room-ip-input").value.trim();
    const status = document.getElementById("messenger-status");

    if (!ip) {
      status.textContent = "Enter a host IP first.";
      return;
    }

    try {
      const result = await invoke("set_messenger_peer", {
        peer: ip,
      });

      status.textContent = result;
      addMessengerBubble(result, "other");
    } catch (err) {
      status.textContent = "Error: " + err;
      addMessengerBubble("Error: " + err, "other");
    }
  };

  document.getElementById("messenger-send-btn").onclick = async () => {
    const input = document.getElementById("messenger-input");
    const text = input.value.trim();

    if (!text) return;

    try {
      await invoke("send_messenger_message", {
        message: text,
      });

      addMessengerBubble(text, "me");
      input.value = "";
    } catch (err) {
      addMessengerBubble("Error: " + err, "other");
    }
  };

  document.getElementById("messenger-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      document.getElementById("messenger-send-btn").click();
    }
  });

  pollMessengerMessages();
}

messengerBtn.onclick = openMessengerPage;

if (!messengerPoller) {
  messengerPoller = setInterval(pollMessengerMessages, 1000);
}

/* NAVIGATION */
document.querySelectorAll("#nav button").forEach((button) => {
  if (button.id === "settings-btn") return;
  if (button.id === "messenger-btn") return;

  button.onclick = () => {
    messengerModeOpen = false;

    document
      .querySelectorAll("#nav button")
      .forEach((b) => b.classList.remove("active"));

    button.classList.add("active");

    const text = button.textContent.toLowerCase();

    if (text.includes("models")) {
      messages.innerHTML = "";

      addMessage(
        "Models page opened. Choose Phi3Mini, Qwen 2.5, Vision AI, or Image Gen.",
        "ai",
        false
      );
    }

    if (text.includes("prompts")) {
      messages.innerHTML = "";

      addMessage(
        "Prompts page opened. Soon you can add Phoenix personalities.",
        "ai",
        false
      );
    }

    if (text.includes("chats")) {
      if (currentChatId) {
        loadChat(currentChatId);
      }
    }
  };
});

/* TUTORIAL */
const tutorialSteps = [
  "Phoenix AI is your offline AI assistant. It runs locally using models like Phi and Qwen.",
  "Use the message bar at the bottom to ask Phoenix AI anything.",
  "Use the model selector at the top right to switch between fast, smart, vision, and image generation models.",
  "Click the plus button in the input bar to upload files or images.",
  "Use New Chat to start fresh. Your chat history will appear in the sidebar.",
  "Open Settings to change your name, theme colors, and profile picture.",
  "Open Messenger to create or join a local Wi-Fi chat room.",
];

let tutorialIndex = 0;

function showTutorialStep() {
  tutorialText.textContent = tutorialSteps[tutorialIndex];

  nextTutorialBtn.textContent =
    tutorialIndex === tutorialSteps.length - 1 ? "Finish" : "Next";
}

function closeTutorial() {
  tutorialModal.classList.add("hidden");
  localStorage.setItem("phoenixTutorialDone", "true");
}

if (!localStorage.getItem("phoenixTutorialDone")) {
  tutorialModal.classList.remove("hidden");
  showTutorialStep();
}

nextTutorialBtn.onclick = () => {
  if (tutorialIndex < tutorialSteps.length - 1) {
    tutorialIndex++;
    showTutorialStep();
  } else {
    closeTutorial();
  }
};

skipTutorialBtn.onclick = closeTutorial;

/* EASTER EGGS */
function checkSecretCodes(prompt) {
  const code = prompt.toLowerCase().trim();

  if (code === "440255") {
    addMessage("citiboi oliver 67", "ai");
    return true;
  }

  if (code === "phoenix") {
    showPhoenixAnimation();
    addMessage("🔥 The Phoenix has awakened.", "ai");
    return true;
  }

  if (code === "devmode") {
    activateDevMode();
    addMessage("Developer Mode Activated.", "ai");
    return true;
  }

  if (code === "boom") {
    playSecretSound();
    addMessage("💥 BOOM.", "ai");
    return true;
  }

  return false;
}

const konami = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

let konamiIndex = 0;

window.addEventListener("keydown", (e) => {
  if (e.key === konami[konamiIndex]) {
    konamiIndex++;

    if (konamiIndex === konami.length) {
      activatePhoenixMode();
      konamiIndex = 0;
    }
  } else {
    konamiIndex = 0;
  }
});

function activatePhoenixMode() {
  document.body.style.transition = "1s";

  document.body.style.background =
    "linear-gradient(45deg, #ff6a00, #ff0000, #7c3aed)";

  showPhoenixAnimation();
  addMessage("🔥 PHOENIX MODE UNLOCKED 🔥", "ai");

  setTimeout(() => {
    document.body.style.background = "";
  }, 5000);
}

function showPhoenixAnimation() {
  const phoenix = document.createElement("div");

  phoenix.textContent = "🔥";
  phoenix.style.position = "fixed";
  phoenix.style.left = "50%";
  phoenix.style.top = "50%";
  phoenix.style.transform = "translate(-50%, -50%) scale(0.2)";
  phoenix.style.fontSize = "160px";
  phoenix.style.zIndex = "99999";
  phoenix.style.opacity = "0";
  phoenix.style.transition = "0.7s ease";
  phoenix.style.pointerEvents = "none";
  phoenix.style.filter = "drop-shadow(0 0 40px rgba(255,100,0,0.9))";

  document.body.appendChild(phoenix);

  setTimeout(() => {
    phoenix.style.opacity = "1";
    phoenix.style.transform = "translate(-50%, -50%) scale(1)";
  }, 50);

  setTimeout(() => {
    phoenix.style.opacity = "0";
    phoenix.style.transform = "translate(-50%, -50%) scale(0.2) rotate(30deg)";
  }, 2300);

  setTimeout(() => {
    phoenix.remove();
  }, 3200);
}

function activateDevMode() {
  console.log("🔥 Phoenix AI Developer Mode Enabled");
  document.body.classList.toggle("dev-mode");
  alert("Developer Mode Activated");
}

function playSecretSound() {
  const audio = new Audio(
    "https://www.myinstants.com/media/sounds/vine-boom.mp3"
  );

  audio.play();
}

/* LITE / PRO MODE */
function applyPhoenixMode() {
  const phoenixMode = localStorage.getItem("phoenixMode");

  if (!phoenixMode) return;

  const options = modelSelect.querySelectorAll("option");

  options.forEach((option) => {
    option.hidden = false;
    option.disabled = false;
  });

  if (phoenixMode === "lite") {
    options.forEach((option) => {
      if (option.value === "vision" || option.value === "image-fast") {
        option.hidden = true;
        option.disabled = true;
      }
    });

    modelSelect.value = "low";
  }

  updateModeCards();
}

function detectPhoenixMode() {
  if (localStorage.getItem("phoenixMode")) {
    applyPhoenixMode();
    return;
  }

  let recommended = "pro";

  const ram = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 2;
  const ua = navigator.userAgent.toLowerCase();
  const isChromebook = ua.includes("cros");

  if (ram <= 4 || cores <= 4 || isChromebook) {
    recommended = "lite";
  }

  modeRecommendModal.classList.remove("hidden");

  if (recommended === "lite") {
    modeRecommendText.textContent =
      "Phoenix AI recommends Lite Mode for this device. Better performance and lower RAM usage.";
  } else {
    modeRecommendText.textContent =
      "Phoenix AI recommends Pro Mode for this device. Full AI features enabled.";
  }
}

chooseLiteBtn.onclick = () => {
  localStorage.setItem("phoenixMode", "lite");
  modeRecommendModal.classList.add("hidden");
  applyPhoenixMode();
  addMessage("⚡ Lite Mode enabled.", "ai", false);
};

chooseProBtn.onclick = () => {
  localStorage.setItem("phoenixMode", "pro");
  modeRecommendModal.classList.add("hidden");
  applyPhoenixMode();
  addMessage("🔥 Pro Mode enabled.", "ai", false);
};

/* SETTINGS MODE CARDS */
function updateModeCards() {
  if (!liteCard || !proCard) return;

  const mode = localStorage.getItem("phoenixMode");

  liteCard.classList.remove("selected");
  proCard.classList.remove("selected");

  if (mode === "lite") {
    liteCard.classList.add("selected");
  }

  if (mode === "pro") {
    proCard.classList.add("selected");
  }
}

if (liteCard) {
  liteCard.onclick = () => {
    localStorage.setItem("phoenixMode", "lite");
    applyPhoenixMode();
    updateModeCards();
    addMessage("⚡ Switched to Lite Mode.", "ai", false);
  };
}

if (proCard) {
  proCard.onclick = () => {
    localStorage.setItem("phoenixMode", "pro");
    applyPhoenixMode();
    updateModeCards();
    addMessage("🔥 Switched to Pro Mode.", "ai", false);
  };
}

/* STARTUP */
loadSettings();
renderHistory();
detectPhoenixMode();
updateModeCards();

if (currentChatId && chats.find((c) => c.id === currentChatId)) {
  loadChat(currentChatId);
} else {
  addMessage("Welcome to Phoenix AI. Start a new chat to begin.", "ai", false);
}