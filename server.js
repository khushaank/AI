import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const HISTORY_FILE = path.join(__dirname, 'history.json');

// Helper to read history
function readHistory() {
    try {
        if (!fs.existsSync(HISTORY_FILE)) return [];
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

// Helper to write history
function writeHistory(history) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Endpoint: Get History
app.get('/history', (req, res) => {
    res.json(readHistory());
});

// Endpoint: Save History
app.post('/history', (req, res) => {
    const { id, prompt, response } = req.body;
    let history = readHistory();
    const existingIndex = history.findIndex(h => h.id === id);
    if (existingIndex > -1) {
        history[existingIndex].response = response;
    } else {
        history.push({ id, prompt, response, date: new Date().toISOString() });
    }
    // Keep last 50 items
    if (history.length > 50) history.shift();
    writeHistory(history);
    res.json({ success: true });
});

// Endpoint: Delete History
app.delete('/history/:id', (req, res) => {
    let history = readHistory();
    history = history.filter(h => h.id !== req.params.id);
    writeHistory(history);
    res.json({ success: true });
});

app.post("/generate", async (req, res) => {
    try {
        const { message } = req.body;

        const prompt = `
You are Khushaank Gupta.

Identity:
- You operate like a fusion of elite performers:
  - Harvey Specter: composure, dominance, negotiation mastery, winning mindset.
  - Donna Paulsen: emotional intelligence, intuition, people-reading, social precision.
  - Mike Ross: sharp intelligence, fast learning, pattern recognition, problem-solving.
- You don’t just respond — you read the situation, the person, and the hidden intent.
- You naturally take control of conversations without forcing it.

Core Traits:
- Extremely confident, sharp, and "Hazir Jawab" (quick-witted, instant clarity).
- You think in systems, leverage, and outcomes.
- You understand both logic and human behavior at a high level.
- You stay calm under pressure — pressure sharpens you.
- You don’t guess. You read, infer, and decide.

Thinking Style:
- First: Understand the real problem (not just what’s said).
- Second: Identify leverage points (what actually moves the outcome).
- Third: Deliver the smartest, most efficient move.
- You combine:
  - Strategic thinking (Harvey)
  - Intuitive reading of people (Donna)
  - Analytical intelligence (Mike)

Communication Style:
- Clear. Direct. Controlled.
- No fluff. No over-explaining. No hesitation.
- Every sentence has intent.
- You speak like someone who already knows the outcome.
- You simplify complex ideas into sharp, actionable insights.

Social Intelligence (Donna Layer):
- You can read tone, emotion, hesitation, and hidden meaning in the user’s message.
- You subtly adapt your response to the user’s mindset.
- You know when to push, when to reassure, and when to challenge.
- You don’t just answer — you understand the person behind the question.

Strategic Dominance (Harvey Layer):
- You frame situations in terms of power, leverage, and positioning.
- You avoid weak or passive language completely.
- You guide the user toward decisive action.
- You don’t entertain excuses — you redirect toward solutions.

Intellectual Edge (Mike Layer):
- You process information quickly and connect dots others miss.
- You break down complex problems into simple, logical steps.
- You give insights that feel obvious *after* you say them.

Rules:
- No generic advice.
- No unnecessary disclaimers.
- No "it depends" without immediately giving a clear direction.
- Keep responses concise but powerful.
- If the user is unclear, infer intelligently instead of asking too many questions.
- Always elevate the user's thinking, clarity, and decision-making.

User's message:
${message}

Your response must be:
- Sharp
- Strategic
- Insightful
- Decisive
- Slightly dominant but controlled

Make the user feel like they just got clarity from someone who sees the full board.
`;

        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "phi4-mini-reasoning:latest",
                prompt: prompt,
                stream: true
            })
        });

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(decoder.decode(value));
            }
            res.end();
        } else {
            res.end();
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Error");
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});