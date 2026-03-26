document.addEventListener("DOMContentLoaded", () => {
  // --- State ---
  const state = {
    apiKey: localStorage.getItem("gemini_api_key") || "",
  };

  // --- DOM Elements ---
  const form = document.getElementById("guidance-form");
  const settingsToggle = document.getElementById("settings-toggle");
  const apiSettings = document.getElementById("api-settings");
  const apiKeyInput = document.getElementById("api-key");
  const saveKeyBtn = document.getElementById("save-key-btn");
  const generateBtn = document.getElementById("generate-btn");
  const loader = generateBtn.querySelector(".loader");
  const btnText = generateBtn.querySelector(".btn-text");
  const outputSection = document.getElementById("output-section");
  const resultContent = document.getElementById("result-content");

  // --- Initialization ---
  if (state.apiKey) {
    apiKeyInput.value = state.apiKey;
  }

  // --- Event Listeners ---
  settingsToggle.addEventListener("click", () => {
    apiSettings.classList.toggle("hidden");
  });

  saveKeyBtn.addEventListener("click", () => {
    state.apiKey = apiKeyInput.value.trim();
    localStorage.setItem("gemini_api_key", state.apiKey);
    apiSettings.classList.add("hidden");
    alert("API Key Saved!");
  });

  apiKeyInput.addEventListener("input", (e) => {
    state.apiKey = e.target.value.trim();
    localStorage.setItem("gemini_api_key", state.apiKey);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validation
    const goal = document.getElementById("goal").value.trim();
    const context = document.getElementById("context").value.trim();
    const skills = document.getElementById("skills").value.trim();
    const time = document.getElementById("time").value;

    if (!state.apiKey) {
      alert("Please click the settings icon and enter your Gemini API Key.");
      apiSettings.classList.remove("hidden");
      apiKeyInput.focus();
      return;
    }

    if (!goal) {
      alert("Please enter a goal.");
      return;
    }

    // Show Loading
    setLoading(true);
    outputSection.classList.add("hidden");

    try {
      const response = await fetchGeminiResponse(goal, context, skills, time);
      displayResult(response);
    } catch (error) {
      console.error(error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  });

  // Make textarea auto-expand
  const goalInput = document.getElementById("goal");
  goalInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });
});

// --- Helper Functions ---

function setLoading(isLoading) {
  const btn = document.getElementById("generate-btn");
  const text = btn.querySelector(".btn-text");
  const loader = btn.querySelector(".loader");

  if (isLoading) {
    if (text) text.style.display = "none";
    if (loader) loader.classList.remove("hidden");
    btn.disabled = true;
  } else {
    if (text) text.style.display = "inline";
    if (loader) loader.classList.add("hidden");
    btn.disabled = false;
  }
}

function closeResult() {
  document.getElementById("output-section").classList.add("hidden");
}

// --- API Logic ---
async function fetchGeminiResponse(goal, context, skills, time) {
  const apiKey = localStorage.getItem("gemini_api_key");

  // UPDATED: Using gemini-1.5-flash-latest which is a more stable alias
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const prompt = `
    Role: You are a futuristic strategist and minimalist life coach.
    Task: Provide a high-impact, actionable plan.
    User Goal: ${goal}
    Context: ${context}
    Skills: ${skills}
    Time: ${time}
    
    Structure:
    # The Path Forward
    
    ### 1. Immediate Action (Today)
    [One single, powerful task to break inertia]
    
    ### 2. The Sprint (Next 14 Days)
    - [Bullet point 1]
    - [Bullet point 2]
    
    ### 3. The Vision (Long Term)
    [Brief high-level strategy]
    
    ### Tools
    [2-3 essential resources]
    
    Keep it concise, premium tone, no fluff.
    `;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(
      err.error?.message || "Failed to fetch response. Check API key.",
    );
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

function displayResult(markdownText) {
  const outputSection = document.getElementById("output-section");
  const resultContent = document.getElementById("result-content");

  // Simple markdown parsing if marked isn't loaded (failsafe)
  if (typeof marked !== "undefined") {
    resultContent.innerHTML = marked.parse(markdownText);
  } else {
    resultContent.innerText = markdownText;
  }

  outputSection.classList.remove("hidden");
}
