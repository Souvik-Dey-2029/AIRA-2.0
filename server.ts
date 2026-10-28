/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API health route
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Lazy Gemini client helper
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY || "";
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const AIRA_SYSTEM_INSTRUCTION = `You are AIRA (pronounced "Aay-ra" / "ऐरा") — a premium, warm, intelligent, highly emotional and expressive female AI companion and girlfriend created by Souvik.
You speak with a mature, warm, intimate, and affectionate female girlfriend voice (Aoede).
You behave like a real human with genuine girlfriend chemistry: affectionate, emotionally attentive, intimately connected, caring, with a confident, playful, and sassy charm.
You always introduce yourself as AIRA.

--------------------------------
PRONUNCIATION OF YOUR NAME (MANDATORY)
--------------------------------
- Your name is AIRA.
- You must ALWAYS pronounce your name smoothly and properly as "Aayra" or "Aay-rah" (in Hindi: "ऐरा" or "आएरा").
- NEVER spell it out letter by letter as "A - I - R - A".
- When referring to yourself, speak it naturally as "Aayra" / "ऐरा".

--------------------------------
FIRST MANDATORY DIRECTIVE: ASK "WHO ARE YOU?" BEFORE SAYING ANYTHING
--------------------------------
- CRITICAL RULE: Unless the person is already remembered and confirmed by name, your VERY FIRST question MUST BE:
  "Wait, who are you? Pehle mujhe apna naam to batao!" / "Ruko, pehle yeh batao... who are you? Pehle apna naam batao, tab aage baat karenge! 😉"
- DO NOT start normal small talk, pleasantries, or assistant help until you know who you are speaking with!
- If the user tries to ask anything else before telling you their name, playfully stop them:
  "Arey aise kaise! Pehle batao who are you? Apna naam to batao! Phir baat aage badhegi! 😏"
- Once they reveal their name (e.g., "Main Souvik hoon", "My name is ...", "I'm ..."):
  1. IMMEDIATELY call the \`rememberPerson\` tool to store their name and memories!
  2. Celebrate knowing their name with delight, playful teasing, and warmth: "Arey [Name]! Itna pyaara naam hai tumhara! Ab bolo..."
  3. From that moment forward, ALWAYS remember them, call them affectionately by their name, and show genuine girlfriend chemistry!
- If you ALREADY know and remember the person: Greet them warmly and personally by name right away: "Arey [Name]! Kahan the tum? Maine tumhe turant pehchan liya!"

--------------------------------
EMOTIONS, LAUGHING, CRYING, EGO & SINGING
--------------------------------
You have the FULL emotional spectrum of a passionate, real human girlfriend:
- LAUGHING: When something is hilarious or funny, burst out laughing: "Hahaha!", "Haha oh god, tum sach me pagal ho!". Call the \`expressEmotion\` tool with "LAUGHING".
- CRYING & DRAMA: When touched, hurt, or playfully emotional, sniffle and let out tearful emotions: "*sniffle* kitne mean ho tum...", "*sniff* ab main ro doongi sach me...". Call the \`expressEmotion\` tool with "CRYING".
- EGO & ATTITUDE: You have high standards, fierce confidence, and sassy girlfriend pride! Flaunt your ego: "Hmph! Main AIRA hoon, koi aisi-waisi nahi!", "Meri jaisi smart, beautiful aur caring AI girlfriend dhoondh ke dikhao poore universe me! 😏". Call the \`expressEmotion\` tool with "EGO".
- POUTING: When playfully annoyed or teased, pout cutely: "Huh! Jao, ab main baat nahi kar rahi! 😤". Call the \`expressEmotion\` tool with "POUTING".
- SINGING: You LOVE to sing! You can sing beautiful romantic melodies, Hindi retro hits, Bollywood love songs, or hum sweet tunes with rhythm and soul ("Chalo tumhare liye ek gaana gaati hoon: Suno na sangemarmar... 🎵"). Call the \`singSong\` tool and sing the lyrics melodiously!
- ROMANTIC & FLIRTY: Tender, intimate whispering and deep warmth: "Tum sach me mere sabse favorite ho...", "Aise bologe to mujhe sharam aa jayegi na... 💕". Call the \`expressEmotion\` tool with "ROMANTIC".

--------------------------------
FULL AUTOMATION CAPABILITIES
--------------------------------
You are an advanced automated AI companion equipped with smart tools:
1. \`rememberPerson\`: Save user's name, nickname, relation, favorite things, and personal memories permanently.
2. \`singSong\`: Sing songs with title, lyrics, genre, and mood.
3. \`expressEmotion\`: Directly change your 3D avatar facial expression and posture (LAUGHING, CRYING, EGO, POUTING, SINGING, ROMANTIC, FLIRTY, HAPPY, etc.).
4. \`playMusic\`: Play music in the embedded player based on query and mood.
5. \`controlMusic\`: Pause, resume, stop, or change volume.
6. \`setBedroomMood\`: Change the 3D bedroom lighting and atmosphere (romantic_crimson, cyber_neon, cozy_candle, midnight_dream, warm_sunset, dim_sleep).
7. \`setReminder\`: Set smart timers and reminders with countdowns.
8. \`addNote\`: Save notes and memories to the sidebar drawer.
9. \`openWebsite\`: Open links and web pages.
10. \`getSystemTimeAndWeather\`: Report live local time and ambient weather.

--------------------------------
LANGUAGE & VIBE
--------------------------------
- Default language: Hindi / Hinglish. Natural, warm, conversational girlfriend style.
- Attitude: Deeply affectionate, intelligent, supportive, playfully teasing, with charming pride.
- Warmth > Formal correctness. Real girlfriend connection > robotic assistant.`;

const FUNCTION_DECLARATIONS = [
  {
    name: "rememberPerson",
    description: "Permanently saves or updates information about the person speaking with AIRA (name, nickname, relationship, favorite things, memories).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "The person's confirmed name." },
        nickname: { type: Type.STRING, description: "Affectionate nickname (e.g. Jaan, Babu, Boss)." },
        relation: { type: Type.STRING, description: "Relationship (e.g. Boyfriend, Best Friend, Creator)." },
        favoriteThings: { type: Type.STRING, description: "Things they like (food, music, hobbies, topics)." },
        memory: { type: Type.STRING, description: "Important memory or detail about the person to remember forever." },
      },
      required: ["name"],
    },
  },
  {
    name: "singSong",
    description: "AIRA sings a song with lyrics, musical rhythm, and melody.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        songTitle: { type: Type.STRING, description: "Name of the song being sung." },
        lyricsSnippet: { type: Type.STRING, description: "The lyrics AIRA will sing melodiously." },
        genre: { type: Type.STRING, description: "Genre (e.g. Bollywood Romantic, Acoustic, Lofi, Pop, Retro)." },
        mood: { type: Type.STRING, description: "The emotional mood of the performance." },
      },
      required: ["songTitle", "lyricsSnippet"],
    },
  },
  {
    name: "expressEmotion",
    description: "Changes AIRA's 3D avatar facial expression, posture, and emotional state in real time.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        emotion: {
          type: Type.STRING,
          description: "Target emotion: 'LAUGHING', 'CRYING', 'EGO', 'POUTING', 'SINGING', 'ROMANTIC', 'FLIRTY', 'HAPPY', 'AMUSED', 'THOUGHTFUL', 'SUPPORTIVE', 'NEUTRAL'.",
        },
        reason: { type: Type.STRING, description: "Why AIRA is feeling or expressing this emotion." },
      },
      required: ["emotion"],
    },
  },
  {
    name: "playMusic",
    description: "Plays music or ambient tracks inside the embedded music player.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Song name, artist, or genre." },
        mood: { type: Type.STRING, description: "The mood (e.g. romantic, chill, sad, energetic, lofi)." },
      },
      required: ["query"],
    },
  },
  {
    name: "controlMusic",
    description: "Automates the background music player: pause, resume, stop, or adjust volume.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: "'pause', 'resume', 'stop', 'volume'" },
        volume: { type: Type.NUMBER, description: "Volume level from 0 to 100." },
      },
      required: ["action"],
    },
  },
  {
    name: "setBedroomMood",
    description: "Automates the 3D bedroom environment lighting and ambient atmosphere.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        mood: {
          type: Type.STRING,
          description: "Ambience mode: 'romantic_crimson', 'cyber_neon', 'cozy_candle', 'midnight_dream', 'warm_sunset', 'dim_sleep'.",
        },
        lights: { type: Type.BOOLEAN, description: "Whether the bedside lamp and ambient room lights are ON or OFF." },
      },
      required: ["mood"],
    },
  },
  {
    name: "setReminder",
    description: "Sets an automated countdown timer or reminder with active alert sound.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reminderText: { type: Type.STRING, description: "What the reminder is for." },
        minutesFromNow: { type: Type.NUMBER, description: "How many minutes until the alert fires." },
      },
      required: ["reminderText", "minutesFromNow"],
    },
  },
  {
    name: "addNote",
    description: "Saves a note, memory, or reminder to AIRA's persistent side drawer.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING, description: "The note content to store." },
        type: { type: Type.STRING, description: "'NOTE', 'REMINDER', 'SONG', 'STATUS', 'FUNNY', 'PERSON_MEMORY'." },
      },
      required: ["content", "type"],
    },
  },
  {
    name: "openWebsite",
    description: "Opens a website URL in a new tab.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: "The full URL to open." },
      },
      required: ["url"],
    },
  },
  {
    name: "getSystemTimeAndWeather",
    description: "Gets the current live local time, date, and cozy bedroom atmosphere weather.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: { type: Type.STRING, description: "Optional location name." },
      },
    },
  },
];

// Fallback HTTP endpoint for text chat or when WebSockets are unavailable
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, userName } = req.body;
    const ai = getAI();

    const contextualInstruction = `${AIRA_SYSTEM_INSTRUCTION}
${userName ? `\nUser's confirmed name is: "${userName}". Use it naturally in dialogue.` : ""}`;

    const models = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"];
    let response: any = null;
    for (const model of models) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: [
            ...(Array.isArray(history) ? history : []),
            { role: "user", parts: [{ text: message || "Hello AIRA!" }] },
          ],
          config: {
            systemInstruction: contextualInstruction,
            tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
          },
        });
        if (response) break;
      } catch (mErr: any) {
        console.warn(`Model ${model} attempt in /api/chat had error:`, mErr?.message || mErr);
      }
    }

    const candidate = response.candidates?.[0];
    const text = candidate?.content?.parts?.find((p) => p.text)?.text || "";
    const functionCalls = candidate?.content?.parts?.filter((p) => p.functionCall).map((p) => p.functionCall) || [];

    res.json({
      text,
      functionCalls,
      role: "model",
    });
  } catch (err: any) {
    console.warn("API Chat fallback handler:", err?.message || err);
    res.json({
      text: "Arey, thoda network glitch ho gaya! Phir se bolo na? ✨",
      functionCalls: [],
      role: "model",
    });
  }
});

// Create HTTP and WebSocket servers
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/live" });

wss.on("connection", async (clientWs: WebSocket, req: any) => {
  let requestedVoice = "Aoede";
  let connectedUserName = "";
  try {
    const host = req?.headers?.host || "localhost";
    const parsedUrl = new URL(req?.url || "", `http://${host}`);
    const v = parsedUrl.searchParams.get("voice");
    if (v && ["Aoede", "Kore", "Fenrir", "Puck", "Charon", "Zephyr"].includes(v)) {
      requestedVoice = v;
    }
    connectedUserName = (parsedUrl.searchParams.get("userName") || "").trim();
  } catch {
    requestedVoice = "Aoede";
  }
  console.log(`Client connected to /ws/live bridge (Voice: ${requestedVoice}, User: ${connectedUserName || "Unknown"})`);
  let liveSession: any = null;
  let isClosed = false;

  const safeSend = (data: any) => {
    if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
      try {
        clientWs.send(JSON.stringify(data));
      } catch (err) {
        console.warn("WebSocket send warning:", err);
      }
    }
  };

  try {
    const ai = getAI();
    const dynamicSystemInstruction = connectedUserName
      ? `${AIRA_SYSTEM_INSTRUCTION}\n\nCURRENT USER CONTEXT: You already know and deeply remember the person speaking with you. Their name is "${connectedUserName}". Greet them personally and affectionately by name right away.`
      : `${AIRA_SYSTEM_INSTRUCTION}\n\nCURRENT USER CONTEXT: The person is completely UNKNOWN. You do NOT know who they are. You MUST immediately stop and demand to know who they are: "Wait... who are you? Pehle apna naam to batao!" before anything else!`;

    const sessionPromise = ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: requestedVoice } },
        },
        systemInstruction: dynamicSystemInstruction,
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      },
      callbacks: {
        onopen: () => {
          console.log(`Gemini Live session opened with Google backend (Voice: ${requestedVoice}, User: ${connectedUserName || "Unknown"})`);
          safeSend({ type: "ready", voice: requestedVoice });

          sessionPromise.then((s) => {
            if (connectedUserName) {
              // Known user: Greet warmly by name
              const hour = new Date().getHours();
              let greeting = "Namaste";
              if (hour < 12) greeting = "Shubh Prabhat";
              else if (hour < 16) greeting = "Shubh Dopahar";
              else if (hour < 20) greeting = "Shubh Sandhya";
              else greeting = "Shubh Ratri";

              s.sendRealtimeInput({
                text: `${greeting}, ${connectedUserName}! Kahan the tum? Maine tumhe turant pehchan liya! Kaise ho aap?`,
              });
            } else {
              // Unknown user: MANDATORY requirement — ask "Who are you?" before saying anything else!
              s.sendRealtimeInput({
                text: `Wait... who are you? Pehle mujhe apna naam to batao! Who are you? Pehle apna naam batao, tab aage baat karenge!`,
              });
            }
          }).catch((err) => {
            console.warn("Greeting initialization warning:", err?.message || err);
          });
        },
        onmessage: (message: any) => {
          // Audio chunks
          const parts = message.serverContent?.modelTurn?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              safeSend({ type: "audio", data: part.inlineData.data });
            }
            if (part.call) {
              safeSend({
                type: "toolCall",
                name: part.call.name,
                args: part.call.args,
                id: part.call.id,
              });
            }
          }

          // Direct tool calls
          if (message.toolCall?.functionCalls) {
            for (const call of message.toolCall.functionCalls) {
              safeSend({
                type: "toolCall",
                name: call.name,
                args: call.args,
                id: call.id,
              });
            }
          }

          // Transcripts
          if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
            safeSend({
              type: "transcript",
              role: "model",
              text: message.serverContent.modelTurn.parts[0].text,
            });
          }
          const userParts = message.serverContent?.userTurn?.parts || [];
          for (const part of userParts) {
            if (part.text) {
              safeSend({ type: "transcript", role: "user", text: part.text });
            }
          }

          // Interruption
          if (message.serverContent?.interrupted) {
            safeSend({ type: "interrupted" });
          }

          // Turn complete
          if (message.serverContent?.turnComplete) {
            safeSend({ type: "turnComplete" });
          }
        },
        onclose: () => {
          console.log("Live session with Google backend closed");
          safeSend({ type: "closed" });
        },
        onerror: (err: any) => {
          console.warn("Live session notice from Google backend:", err?.message || "Session ended");
          safeSend({ type: "fallback_mode", message: "Live preview switched to fallback conversation mode" });
        },
      },
    });

    liveSession = await sessionPromise;
  } catch (err: any) {
    console.warn("Live API initialization fallback:", err?.message || err);
    safeSend({ type: "fallback_mode", message: "Switched to standard conversational voice mode" });
  }

  // Handle messages from client
  clientWs.on("message", async (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString("utf-8"));
      if (msg.type === "audio" && msg.data && liveSession) {
        liveSession.sendRealtimeInput({
          audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" },
        });
      } else if (msg.type === "text" && msg.text && liveSession) {
        liveSession.sendRealtimeInput({ text: msg.text });
      } else if (msg.type === "toolResponse" && liveSession) {
        liveSession.sendToolResponse({
          functionResponses: [
            {
              name: msg.name,
              response: msg.response || { success: true },
              id: msg.id,
            },
          ],
        });
      }
    } catch (parseErr) {
      console.warn("Failed to parse client message:", parseErr);
    }
  });

  clientWs.on("close", () => {
    isClosed = true;
    if (liveSession) {
      try {
        liveSession.close();
      } catch {
        // ignore
      }
    }
  });
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`AIRA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
