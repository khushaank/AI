document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const micBtn = document.getElementById("mic-btn");
  const actionButtons = document.getElementById("action-buttons");

  // State
  let currentSessionId = null;

  // Load history immediately
  loadHistory();

  // Speech Recognition
  if (micBtn) {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      let isRecording = false;

      recognition.onstart = () => {
        isRecording = true;
        micBtn.classList.add("text-red-500");
        chatInput.placeholder = "Listening...";
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        chatInput.value = finalTranscript || interimTranscript;
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        stopRecording();
      };

      recognition.onend = () => {
        stopRecording();
      };

      function stopRecording() {
        isRecording = false;
        micBtn.classList.remove("text-red-500");
        chatInput.placeholder = "What to do wit my day";
      }

      micBtn.addEventListener("click", () => {
        if (isRecording) {
          recognition.stop();
        } else {
          chatInput.value = "";
          recognition.start();
        }
      });
    } else {
      micBtn.style.display = 'none';
    }
  }

  // Copy Button
  const copyBtn = document.getElementById("copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const text = document.getElementById("result-content").innerText;
      navigator.clipboard.writeText(text).then(() => {
        const icon = copyBtn.querySelector(".material-symbols-outlined");
        icon.textContent = "check";
        setTimeout(() => {
          icon.textContent = "content_copy";
        }, 2000);
      });
    });
  }

  // Form submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const message = chatInput.value.trim();
    if (!message) return;

    // View setup
    document.getElementById("welcome-view").classList.add("hidden");
    const outputPanel = document.getElementById("output-panel");
    outputPanel.classList.remove("hidden");
    outputPanel.classList.add("flex");

    document.getElementById("user-msg-display").textContent = message;

    // Hide action buttons during generation
    actionButtons.classList.add("hidden");

    chatInput.value = "";
    currentSessionId = Date.now().toString();

    setLoading(true);
    let fullResponse = "";
    updateResult(""); 

    let smoother = {
        buffer: "",
        displayed: "",
        interval: null,
        isFinished: false,
        addChunk(chunk) {
            this.buffer += chunk;
            if (!this.interval) this.start();
        },
        finish() {
            this.isFinished = true;
        },
        start() {
            this.interval = setInterval(() => {
                if (this.displayed.length < this.buffer.length) {
                    const remaining = this.buffer.length - this.displayed.length;
                    // Add characters in chunks to smooth out network bursts
                    const charsToAdd = Math.max(1, Math.floor(remaining / 5));
                    this.displayed += this.buffer.substring(this.displayed.length, this.displayed.length + charsToAdd);
                    this.render(this.displayed);
                } else if (this.isFinished) {
                    clearInterval(this.interval);
                    this.interval = null;
                    this.render(this.displayed);
                    
                    // Final UI updates once smoothing is completely done
                    actionButtons.classList.remove("hidden");
                    saveToHistory(message, this.buffer, currentSessionId);
                }
            }, 25); // Smooth ~40fps typewriter effect
        },
        render(text) {
            let formattedText = text;
            formattedText = formattedText.replace(/\\boxed\{([\s\S]*?)\}/g, "$1");

            if (formattedText.includes("<think>")) {
                formattedText = formattedText
                    .replace(/<think>/g, "\n\n<details class='mb-4 border border-white/10 rounded-xl bg-[#2f2f2f] group'><summary class='flex items-center gap-2 p-3 cursor-pointer select-none text-gray-300 font-medium hover:text-white transition-colors'><span class='material-symbols-outlined text-[18px] transition-transform duration-200 group-open:rotate-90'>chevron_right</span>Thought Process</summary><div class='p-4 border-t border-white/5 text-gray-400 text-sm leading-relaxed'>\n\n")
                    .replace(/<\/think>/g, "\n\n</div></details>\n\n");
                
                // Auto-close details safely if the thought process is still streaming
                if (formattedText.includes("<details") && !formattedText.includes("</details>")) {
                    formattedText += "\n\n</div></details>";
                }
            }

            updateResult(formattedText);
            
            // Auto scroll to bottom seamlessly
            const scrollContainer = document.getElementById("chat-scroll");
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    };

    try {
      await fetchStrategyStream(message, (chunk) => {
        smoother.addChunk(chunk);
      });
      
      smoother.finish();
      
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  });

  // Export functions to global scope
  window.loadSession = loadSession;
  window.resetView = resetView;
});

// ── Helpers ──────────────────────────────────────────

function setLoading(on) {
  const btn = document.getElementById("send-btn");
  const icon = btn.querySelector(".send-icon");
  const loader = btn.querySelector(".loader");

  btn.disabled = on;
  if (on) {
    if (icon) icon.classList.add("hidden");
    if (loader) loader.classList.remove("hidden");
  } else {
    if (icon) icon.classList.remove("hidden");
    if (loader) loader.classList.add("hidden");
  }
}

function resetView() {
  document.getElementById("output-panel").classList.add("hidden");
  document.getElementById("output-panel").classList.remove("flex");
  const welcomeView = document.getElementById("welcome-view");
  if (welcomeView) {
    welcomeView.classList.remove("hidden");
  }
  document.getElementById("chat-input").value = "";
}

function updateResult(markdown) {
  const content = document.getElementById("result-content");
  
  // Preserve details open state so it doesn't snap closed during streaming
  const existingDetails = content.querySelector('details');
  const isOpen = existingDetails ? existingDetails.open : false;

  if (typeof marked !== "undefined") {
      content.innerHTML = marked.parse(markdown);
  } else {
      content.innerHTML = markdown.replace(/\n/g, "<br>");
  }

  // Restore details open state
  const newDetails = content.querySelector('details');
  if (newDetails && isOpen) {
      newDetails.open = true;
  }
}

// ── History ──────────────────────────────────────────

async function getHistoryData() {
  try {
    const res = await fetch("http://localhost:3000/history");
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function loadHistory() {
  const list = document.getElementById("history-list");
  if (!list) return;

  let history = await getHistoryData();

  if (history.length === 0) {
    list.innerHTML = `<li class="text-sm text-gray-500 italic px-2">No history yet.</li>`;
    return;
  }

  list.innerHTML = "";
  // Show top 25 queries
  history.slice().reverse().slice(0, 25).forEach(session => {
    const li = document.createElement("li");
    li.className = "group flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-gray-300 hover:text-white";

    const title = document.createElement("span");
    title.className = "text-sm truncate w-full";
    title.textContent = session.prompt;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "hidden group-hover:block text-gray-500 hover:text-red-400 p-1 flex-shrink-0";
    deleteBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">delete</span>`;
    deleteBtn.onclick = async (e) => {
      e.stopPropagation(); // prevent loading session when deleting
      try {
        await fetch(`http://localhost:3000/history/${session.id}`, { method: 'DELETE' });
        if (currentSessionId === session.id) resetView();
        loadHistory();
      } catch (err) {
        console.error("Failed to delete", err);
      }
    };

    li.appendChild(title);
    li.appendChild(deleteBtn);

    li.onclick = () => {
      loadSession(session.id);
    };
    list.appendChild(li);
  });
}

async function loadSession(id) {
  const history = await getHistoryData();
  const session = history.find(c => c.id === id);
  if (!session) return;

  currentSessionId = id;

  // View setup
  document.getElementById("welcome-view").classList.add("hidden");
  const outputPanel = document.getElementById("output-panel");
  outputPanel.classList.remove("hidden");
  outputPanel.classList.add("flex");

  document.getElementById("user-msg-display").textContent = session.prompt;

  // Set AI response
  let formattedText = session.response;

  // Remove \boxed{...} wrappers
  formattedText = formattedText.replace(/\\boxed\{([\s\S]*?)\}/g, "$1");

  if (formattedText.includes("<think>")) {
    formattedText = formattedText
      .replace(/<think>/g, "\n\n<details class='mb-4 border border-white/10 rounded-xl bg-[#2f2f2f] group'><summary class='flex items-center gap-2 p-3 cursor-pointer select-none text-gray-300 font-medium hover:text-white transition-colors'><span class='material-symbols-outlined text-[18px] transition-transform duration-200 group-open:rotate-90'>chevron_right</span>Thought Process</summary><div class='p-4 border-t border-white/5 text-gray-400 text-sm leading-relaxed'>\n\n")
      .replace(/<\/think>/g, "\n\n</div></details>\n\n");
  }
  updateResult(formattedText);

  // Show buttons
  document.getElementById("action-buttons").classList.remove("hidden");
}

async function saveToHistory(prompt, response, sessionId) {
  try {
    await fetch("http://localhost:3000/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sessionId, prompt, response })
    });
    loadHistory();
  } catch (e) {
    console.error("Failed to save history", e);
  }
}

// ── API ───────────────────────────────────────────────

async function fetchStrategyStream(message, onChunk) {
  const url = `http://localhost:3000/generate`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) throw new Error("Failed to connect to local server.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.response) {
          onChunk(data.response);
        }
      } catch (e) { }
    }
  }
}