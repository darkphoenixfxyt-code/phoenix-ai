import "./style.css";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

let invoke = null;

if (window.__TAURI_INTERNALS__) {
  const tauri = await import("@tauri-apps/api/core");
  invoke = tauri.invoke;
}

const isTauri = !!window.__TAURI_INTERNALS__;

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
const groqApiKeyInput = document.getElementById("groq-api-key");
const saveGroqKeyBtn = document.getElementById("save-groq-key");

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

const inputBar = document.getElementById("input-bar");
const typingIndicator = document.getElementById("typing-indicator");

/* STATE */
let currentUploadedImage = null;
let currentUploadedText = null;
let currentUploadedFileName = null;
let messengerModeOpen = false;

let currentRoom = "";
let currentUsername = "";
let roomChannel = null;

let chats = JSON.parse(localStorage.getItem("phoenixChats")) || [];
let currentChatId = localStorage.getItem("phoenixCurrentChatId") || null;

/* HELPERS */
function getMessengerUsername() {
  return nameInput?.value?.trim() || "Phoenix User";
}

function getGroqApiKey() {
  return groqApiKeyInput?.value?.trim() || "";
}

function showAiBar() {
  if (inputBar) inputBar.classList.remove("hidden");
}

function hideAiBar() {
  if (inputBar) inputBar.classList.add("hidden");
  if (typingIndicator) typingIndicator.classList.add("hidden");
}

function showTyping() {
  if (typingIndicator && !messengerModeOpen) {
    typingIndicator.classList.remove("hidden");
  }
}

function hideTyping() {
  if (typingIndicator) typingIndicator.classList.add("hidden");
}

/* BROWSER MODE */
function applyBrowserModeLocks() {
  if (isTauri) return;
  if (!modelSelect) return;

  const offlineValues = ["low", "high", "vision"];

  [...modelSelect.options].forEach((option) => {
    if (offlineValues.includes(option.value)) {
      option.disabled = true;
      option.hidden = true;
    }
  });

  if (modelSelect.value !== "image-fast") {
    modelSelect.value = "groq";
  }

  if (messages) {
    addMessage(
      "🌐 Browser Mode detected. Offline AI and Vision are locked. Use Groq Online or Online Image Gen.",
      "ai",
      false
    );
  }
}

/* SAVE / LOAD */
function saveChats() {
  localStorage.setItem("phoenixChats", JSON.stringify(chats));
  if (currentChatId) localStorage.setItem("phoenixCurrentChatId", currentChatId);
}

function saveSettings() {
  localStorage.setItem(
    "phoenixSettings",
    JSON.stringify({
      name: nameInput?.value || "PHOENIX 🏅",
      pfp: pfpPreview?.src || "",
      bg: bgPicker?.value || "#050509",
      user: userPicker?.value || "#7c3aed",
      ai: aiPicker?.value || "#2f3136",
      text: textPicker?.value || "#ffffff",
      groqApiKey: groqApiKeyInput?.value || "",
    })
  );
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem("phoenixSettings") || "null");
  if (!saved) return;

  if (saved.name && nameInput && displayName) {
    nameInput.value = saved.name;
    displayName.textContent = saved.name;
  }

  if (saved.pfp && pfpPreview) {
    pfpPreview.src = saved.pfp;
    if (settingsPfpPreview) settingsPfpPreview.src = saved.pfp;
  }

  if (saved.bg && bgPicker) {
    bgPicker.value = saved.bg;
    document.documentElement.style.setProperty("--bg", saved.bg);
  }

  if (saved.user && userPicker) {
    userPicker.value = saved.user;
    document.documentElement.style.setProperty("--user-bubble", saved.user);
  }

  if (saved.ai && aiPicker) {
    aiPicker.value = saved.ai;
    document.documentElement.style.setProperty("--ai-bubble", saved.ai);
  }

  if (saved.text && textPicker) {
    textPicker.value = saved.text;
    document.documentElement.style.setProperty("--text", saved.text);
  }

  if (saved.groqApiKey && groqApiKeyInput) {
    groqApiKeyInput.value = saved.groqApiKey;
  }
}

/* CHAT MESSAGES */
function addMessage(text, who, save = true) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;

  const header = document.createElement("div");
  header.className = "msg-header";
  header.innerHTML = who === "ai" ? "🔥 PHOENIX AI <span>🏅 GOLD</span>" : "You";

  const body = document.createElement("div");
  body.className = "msg-body";
  body.textContent = text;

  div.appendChild(header);
  div.appendChild(body);
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
      chat.messages.push({ who: "image", text: imageUrl });
      saveChats();
    }
  }
}

function typeMessage(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;

  const header = document.createElement("div");
  header.className = "msg-header";
  header.innerHTML = who === "ai" ? "🔥 PHOENIX AI <span>🏅 GOLD</span>" : "You";

  const body = document.createElement("div");
  body.className = "msg-body";

  div.appendChild(header);
  div.appendChild(body);
  messages.appendChild(div);

  let i = 0;
  const finalText = String(text || "");

  function type() {
    if (i < finalText.length) {
      body.textContent += finalText[i];
      i++;
      messages.scrollTop = messages.scrollHeight;
      setTimeout(type, 12);
    }
  }

  type();

  if (currentChatId) {
    const chat = chats.find((c) => c.id === currentChatId);
    if (chat) {
      chat.messages.push({ text: finalText, who });
      saveChats();
    }
  }
}

/* HISTORY */
function renderHistory() {
  chatHistory.innerHTML = "";

  if (chats.length === 0) {
    chatHistory.innerHTML = `<div id="empty-history">Start a chat to see history</div>`;
    return;
  }

  chats.forEach((chat) => {
    const item = document.createElement("div");
    item.className = chat.id === currentChatId ? "history-item active" : "history-item";
    item.textContent = chat.title;

    item.onclick = () => {
      messengerModeOpen = false;
      showAiBar();
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
  const chat = { id, title, messages: [] };

  chats.unshift(chat);
  currentChatId = id;

  saveChats();
  renderHistory();
  return chat;
}

function loadChat(id) {
  messengerModeOpen = false;
  showAiBar();

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
  showAiBar();

  if (roomChannel) {
    supabase.removeChannel(roomChannel);
    roomChannel = null;
  }

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
  if (messengerModeOpen) return;

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

  if (!isTauri && modelSelect.value !== "groq" && modelSelect.value !== "image-fast") {
    promptInput.value = "";
    addMessage(
      "🌐 Browser Mode uses Groq Online and Online Image Gen. Offline AI works only in the desktop app.",
      "ai"
    );
    return;
  }

  if (modelSelect.value === "image-fast") {
    promptInput.value = "";
    showTyping();

    try {
      const finalPrompt = `${prompt}, high quality, cinematic, neon purple and orange theme`;
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
        finalPrompt
      )}?width=1024&height=1024&nologo=true`;

      hideTyping();
      addMessage("🎨 Generated image:", "ai");
      addImageToChat(imageUrl);
    } catch (err) {
      hideTyping();
      addMessage("Image generation error: " + err.message, "ai");
    }

    return;
  }

  if (!isTauri && modelSelect.value === "groq") {
    promptInput.value = "";
    showTyping();

    try {
      const apiKey = getGroqApiKey();

      if (!apiKey) {
        hideTyping();
        addMessage(
          "Missing Groq API key. Open Settings → Online AI and paste your Groq API key.",
          "ai"
        );
        return;
      }

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content:
                "You are Phoenix AI, a helpful, fast, modern AI assistant. Keep answers useful and clear.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "Groq API error");
      }

      const response =
        data?.choices?.[0]?.message?.content || "Groq returned no response.";

      hideTyping();
      typeMessage(response, "ai");
    } catch (err) {
      hideTyping();
      addMessage("Browser Groq error: " + err.message, "ai");
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
  showTyping();

  try {
    let response = "";
    const selectedModel = modelSelect.value;

    if (selectedModel === "groq" || selectedModel.toLowerCase().includes("groq")) {
      const apiKey = getGroqApiKey();

      if (!apiKey) {
        hideTyping();
        addMessage(
          "Missing Groq API key. Open Settings → Online AI and paste your Groq API key.",
          "ai"
        );
        return;
      }

      response = await invoke("run_groq_ai", {
        apiKey,
        prompt: finalPrompt,
      });
    } else {
      response = await invoke("run_local_ai", {
        model:
          selectedModel === "high"
            ? "Qwen2_7B"
            : selectedModel === "vision"
            ? "VisionAI"
            : "Phi3Mini",
        prompt: finalPrompt,
        image: currentUploadedImage,
      });
    }

    hideTyping();
    typeMessage(response, "ai");
  } catch (err) {
    hideTyping();
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

if (groqApiKeyInput) {
  groqApiKeyInput.oninput = saveSettings;
}

if (saveGroqKeyBtn) {
  saveGroqKeyBtn.onclick = () => {
    saveSettings();
    addMessage("✅ Groq API key saved locally on this device.", "ai", false);
    settingsModal.classList.add("hidden");
  };
}

pfpUpload.onchange = () => {
  const file = pfpUpload.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e) => {
    pfpPreview.src = e.target.result;
    if (settingsPfpPreview) settingsPfpPreview.src = e.target.result;
    saveSettings();
  };

  reader.readAsDataURL(file);
};

bgPicker.oninput = applyTheme;
userPicker.oninput = applyTheme;
aiPicker.oninput = applyTheme;
textPicker.oninput = applyTheme;

resetBtn.onclick = () => {
  const keepGroqKey = groqApiKeyInput?.value || "";
  localStorage.removeItem("phoenixSettings");

  if (keepGroqKey) {
    localStorage.setItem("phoenixSettings", JSON.stringify({ groqApiKey: keepGroqKey }));
  }

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
      addMessage("Image attached. Ask me something like: “describe this image.”", "ai");
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

  addMessage("File attached, but Phoenix can currently read images and text files best.", "ai");
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

/* REALTIME SUPABASE MESSENGER */
function createRoomCode() {
  return "phoenix-" + Math.random().toString(36).substring(2, 8);
}

function getRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("room") || "";
}

function makeInviteLink(room) {
  return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room)}`;
}

function addMessengerBubble(message, who = "other") {
  const bubble = document.createElement("div");
  bubble.className = `messenger-bubble ${who}`;

  const username = document.createElement("div");
  username.className = "messenger-username";
  username.textContent = message.username || "User";

  const body = document.createElement("div");
  body.className = "messenger-message";
  body.textContent = message.content || "";

  bubble.appendChild(username);
  bubble.appendChild(body);

  const chat = document.getElementById("messenger-chat");

  if (chat) {
    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;
  }
}

async function loadRoomMessages(room) {
  const chat = document.getElementById("messenger-chat");
  if (chat) chat.innerHTML = "";

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("room", room)
    .order("created_at", { ascending: true });

  if (error) {
    addMessengerBubble(
      {
        username: "System",
        content: "Error loading messages: " + error.message,
      },
      "other"
    );
    return;
  }

  data.forEach((msg) => {
    addMessengerBubble(msg, msg.username === currentUsername ? "me" : "other");
  });
}

function subscribeToRoom(room) {
  if (roomChannel) {
    supabase.removeChannel(roomChannel);
    roomChannel = null;
  }

  roomChannel = supabase
    .channel(`room-${room}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room=eq.${room}`,
      },
      (payload) => {
        const msg = payload.new;
        addMessengerBubble(msg, msg.username === currentUsername ? "me" : "other");
      }
    )
    .subscribe();
}

async function joinRealtimeRoom(room, username) {
  if (!room || !username) {
    alert("Enter a username and room code first.");
    return;
  }

  currentRoom = room;
  currentUsername = username;

  localStorage.setItem("phoenixMessengerUsername", username);
  localStorage.setItem("phoenixMessengerRoom", room);

  const status = document.getElementById("messenger-status");
  const invite = document.getElementById("messenger-invite-link");

  if (status) {
    status.textContent = `Joined room: ${room}`;
  }

  if (invite) {
    invite.value = makeInviteLink(room);
  }

  await loadRoomMessages(room);
  subscribeToRoom(room);
}

async function sendRealtimeMessage() {
  const input = document.getElementById("messenger-input");
  const text = input.value.trim();

  if (!text) return;

  if (!currentRoom || !currentUsername) {
    alert("Join a room first.");
    return;
  }

  input.value = "";

  const { error } = await supabase.from("messages").insert({
    room: currentRoom,
    username: currentUsername,
    content: text,
  });

  if (error) {
    addMessengerBubble(
      {
        username: "System",
        content: "Send error: " + error.message,
      },
      "other"
    );
  }
}

function openMessengerPage() {
  messengerModeOpen = true;
  hideAiBar();

  document.querySelectorAll("#nav button").forEach((b) => b.classList.remove("active"));
  messengerBtn.classList.add("active");

  messages.innerHTML = "";

  const savedUsername =
    localStorage.getItem("phoenixMessengerUsername") ||
    getMessengerUsername() ||
    "Phoenix User";

  const roomFromUrl = getRoomFromUrl();
  const savedRoom = localStorage.getItem("phoenixMessengerRoom") || "";
  const startingRoom = roomFromUrl || savedRoom;

  const panel = document.createElement("div");
  panel.id = "messenger-panel";

  panel.innerHTML = `
    <div class="messenger-card">
      <h2>📡 Phoenix Messenger</h2>
      <p>Real online rooms powered by Supabase Realtime. Share the invite link so friends can join.</p>

      <input id="messenger-username-input" placeholder="Your username" value="${savedUsername}" />

      <div class="messenger-actions">
        <input id="room-code-input" placeholder="Room code" value="${startingRoom}" />
        <button id="create-room-btn">Create Room</button>
        <button id="join-room-btn">Join Room</button>
      </div>

      <input id="messenger-invite-link" readonly placeholder="Invite link will appear here" />

      <div class="messenger-actions">
        <button id="copy-invite-btn">Copy Invite Link</button>
      </div>

      <div id="messenger-status">Not connected</div>
    </div>

    <div id="messenger-chat"></div>

    <div id="messenger-input-row">
      <input id="messenger-input" placeholder="Type a message..." />
      <button id="messenger-send-btn">Send</button>
    </div>
  `;

  messages.appendChild(panel);

  document.getElementById("create-room-btn").onclick = async () => {
    const room = createRoomCode();
    const username = document.getElementById("messenger-username-input").value.trim();

    document.getElementById("room-code-input").value = room;

    const newUrl = makeInviteLink(room);
    window.history.replaceState({}, "", newUrl);

    await joinRealtimeRoom(room, username);
  };

  document.getElementById("join-room-btn").onclick = async () => {
    const room = document.getElementById("room-code-input").value.trim();
    const username = document.getElementById("messenger-username-input").value.trim();

    const newUrl = makeInviteLink(room);
    window.history.replaceState({}, "", newUrl);

    await joinRealtimeRoom(room, username);
  };

  document.getElementById("copy-invite-btn").onclick = async () => {
    const room = document.getElementById("room-code-input").value.trim();

    if (!room) {
      alert("Create or join a room first.");
      return;
    }

    const link = makeInviteLink(room);
    document.getElementById("messenger-invite-link").value = link;

    await navigator.clipboard.writeText(link);
    alert("Invite link copied!");
  };

  document.getElementById("messenger-send-btn").onclick = sendRealtimeMessage;

  document.getElementById("messenger-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sendRealtimeMessage();
    }
  });

  if (roomFromUrl) {
    joinRealtimeRoom(roomFromUrl, savedUsername);
  }
}

messengerBtn.onclick = openMessengerPage;

/* MODELS PAGE */
function openModelsPage() {
  messengerModeOpen = false;
  showAiBar();

  if (roomChannel) {
    supabase.removeChannel(roomChannel);
    roomChannel = null;
  }

  messages.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "messenger-card";

  panel.innerHTML = `
    <h2>📦 Phoenix Model Installer</h2>

    <p>Install local AI models for offline use with Ollama, ComfyUI SDXL image generation, or use Groq Online.</p>

    <div class="messenger-actions">
      <button id="install-phi">Install Phi 3 Mini</button>
      <button id="install-qwen">Install Qwen 3 4B</button>
      <button id="install-vision">Install Vision AI</button>
      <button id="install-sdxl">Install SDXL Image Gen</button>
    </div>

    <div id="model-install-status">Ready to install models.</div>

    <hr style="opacity: 0.12; margin: 18px 0;" />

    <h3>🌐 Groq Online</h3>
    <p>Select “Groq Online” from the top-right model menu and add your API key in Settings.</p>
  `;

  messages.appendChild(panel);

  const status = document.getElementById("model-install-status");

  document.getElementById("install-phi").onclick = async () => {
    status.textContent = "Installing Phi 3 Mini...";

    try {
      status.textContent = await invoke("install_ollama_model", { model: "phi" });
    } catch (err) {
      status.textContent = "Error: " + err;
    }
  };

  document.getElementById("install-qwen").onclick = async () => {
    status.textContent = "Installing Qwen 3 4B...";

    try {
      status.textContent = await invoke("install_ollama_model", { model: "qwen" });
    } catch (err) {
      status.textContent = "Error: " + err;
    }
  };

  document.getElementById("install-vision").onclick = async () => {
    status.textContent = "Installing Vision AI...";

    try {
      status.textContent = await invoke("install_ollama_model", { model: "vision" });
    } catch (err) {
      status.textContent = "Error: " + err;
    }
  };

  document.getElementById("install-sdxl").onclick = async () => {
    status.textContent = "Starting SDXL / ComfyUI installer...";

    try {
      status.textContent = await invoke("install_sdxl_stack");
    } catch (err) {
      status.textContent = "Error: " + err;
    }
  };
}

/* NAVIGATION */
document.querySelectorAll("#nav button").forEach((button) => {
  if (button.id === "settings-btn") return;
  if (button.id === "messenger-btn") return;

  button.onclick = () => {
    messengerModeOpen = false;
    showAiBar();

    if (roomChannel) {
      supabase.removeChannel(roomChannel);
      roomChannel = null;
    }

    document.querySelectorAll("#nav button").forEach((b) => b.classList.remove("active"));
    button.classList.add("active");

    const text = button.textContent.toLowerCase();

    if (text.includes("models")) {
      openModelsPage();
      return;
    }

    if (text.includes("prompts")) {
      messages.innerHTML = "";
      addMessage("Prompts page opened. Soon you can add Phoenix personalities.", "ai", false);
      return;
    }

    if (text.includes("image")) {
      messages.innerHTML = "";
      modelSelect.value = "image-fast";
      addMessage("🎨 Online Image Gen mode enabled. Type an image prompt below.", "ai", false);
      return;
    }

    if (text.includes("chats")) {
      if (currentChatId) {
        loadChat(currentChatId);
      } else {
        messages.innerHTML = "";
        addMessage("Welcome to Phoenix AI. Start a new chat to begin.", "ai", false);
      }
    }
  };
});

/* TUTORIAL */
const tutorialSteps = [
  "Phoenix AI is your offline and online AI assistant. It runs locally using Phi/Qwen or online using Groq.",
  "Use the message bar at the bottom to ask Phoenix AI anything.",
  "Use the model selector at the top right to switch between fast offline, smart offline, vision, Groq Online, and image generation.",
  "For Groq Online, open Settings and paste your Groq API key.",
  "Click the plus button in the input bar to upload files or images.",
  "Use New Chat to start fresh. Your chat history will appear in the sidebar.",
  "Open Settings to change your name, theme colors, profile picture, and online AI key.",
  "Open Messenger to create or join a real online room with an invite link.",
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
  const audio = new Audio("https://www.myinstants.com/media/sounds/vine-boom.mp3");
  audio.play().catch(() => {});
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
      if (
        option.value === "vision" ||
        option.value === "image-fast" ||
        option.value === "groq"
      ) {
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
      "Phoenix AI recommends Pro Mode for this device. Full AI + online features enabled.";
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

  if (mode === "lite") liteCard.classList.add("selected");
  if (mode === "pro") proCard.classList.add("selected");
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
showAiBar();
applyBrowserModeLocks();

if (currentChatId && chats.find((c) => c.id === currentChatId)) {
  loadChat(currentChatId);
} else {
  addMessage("Welcome to Phoenix AI. Start a new chat to begin.", "ai", false);
}