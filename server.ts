/**
 * @file Full-Stack Server
 * @description Express server mounting Vite in development, hosting simulator APIs,
 * test runners, and server-side Gemini Science thinking analysis.
 */
import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import handleMessage from './tgcloud/handlers/message.js';
import handleCallbackQuery from './tgcloud/handlers/callback_query.js';
import { db, resetDatabase, apiCalls } from './tests/mocks/sdk.js';
import {
  users,
  files,
  uploadSessions,
  fileDeliveries,
  processedEvents,
  appSettings,
  abuseReports,
} from './tgcloud/schema.js';

dotenv.config();

const execAsync = promisify(exec);
const app = express();
const port = 3000;

app.use(express.json());

// Initialize GoogleGenAI server-side with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Seed default config into mock DB on server start
async function initMockDb() {
  const existing = await (db.select().from(appSettings) as any);
  if (existing.length === 0) {
    await db.insert(appSettings).values({
      key: 'STORAGE_CHANNEL_ID',
      value: '-1001234567890',
      updated_at: Math.floor(Date.now() / 1000),
    });
    await db.insert(appSettings).values({
      key: 'OWNER_TELEGRAM_ID',
      value: '12345678',
      updated_at: Math.floor(Date.now() / 1000),
    });
    await db.insert(appSettings).values({
      key: 'BOT_USERNAME',
      value: 'FileLinkBot',
      updated_at: Math.floor(Date.now() / 1000),
    });
  }
}
initMockDb();

// 1. Simulate Telegram Message Handler
app.post('/api/simulate/message', async (req, res) => {
  try {
    const { message } = req.body;
    apiCalls.clear();
    await handleMessage(message);

    res.json({
      success: true,
      sentMessages: [...apiCalls.sentMessages],
      copiedMessages: [...apiCalls.copiedMessages],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Simulate Telegram Callback Query Handler
app.post('/api/simulate/callback', async (req, res) => {
  try {
    const { callbackQuery } = req.body;
    apiCalls.clear();
    await handleCallbackQuery(callbackQuery);

    res.json({
      success: true,
      sentMessages: [...apiCalls.sentMessages],
      editedMessages: [...apiCalls.editedMessages],
      answeredCallbacks: [...apiCalls.answeredCallbacks],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Inspect In-Memory SQLite Database State
app.get('/api/db-state', async (_req, res) => {
  try {
    const [
      usersList,
      filesList,
      sessionsList,
      deliveriesList,
      eventsList,
      settingsList,
      reportsList,
    ] = await Promise.all([
      db.select().from(users),
      db.select().from(files),
      db.select().from(uploadSessions),
      db.select().from(fileDeliveries),
      db.select().from(processedEvents),
      db.select().from(appSettings),
      db.select().from(abuseReports),
    ]);

    res.json({
      users: usersList,
      files: filesList,
      uploadSessions: sessionsList,
      fileDeliveries: deliveriesList,
      processedEvents: eventsList,
      appSettings: settingsList,
      abuseReports: reportsList,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Reset Simulator Database
app.post('/api/db-reset', async (_req, res) => {
  try {
    resetDatabase();
    await initMockDb();
    res.json({ success: true, message: 'Database reset successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Run Platform Test Suite
app.get('/api/run-tests', async (_req, res) => {
  try {
    const { stdout, stderr } = await execAsync('npm test');
    res.json({
      success: true,
      output: stdout,
      passed: !stderr || stderr.trim().length === 0,
    });
  } catch (err: any) {
    res.json({
      success: false,
      output: err.stdout || err.message,
      error: err.stderr || '',
    });
  }
});

// 6. Science AI Inspector using gemini-4-argon with ThinkingLevel.HIGH
app.post('/api/science-analyze', async (req, res) => {
  const { fileName, fileContent, query } = req.body;

  const prompt = `You are a Senior Molecular Biologist, Bioinformatician, and Scientific Computing Specialist.
A user has uploaded a scientific file to FileLink Bot for verification and biological context.

File Name: ${fileName || 'Unknown'}
User Query: ${query || 'Perform an in-depth bioinformatics and scientific analysis of this file'}
File Content / Excerpt:
${fileContent || 'No raw content provided; analyze based on scientific file identifier, accession, or filename.'}

Please perform a rigorous scientific assessment:
1. Macromolecular / Chemical / Literature Classification: Identify the entity (e.g. RCSB PDB structure, AlphaFold prediction, UniProt accession, FASTA sequence, PubChem chemical compound, or PubMed clinical paper).
2. Biological & Functional Significance: Detail the molecular mechanism, protein domain function, catalytic active site, disease-associated variants (ClinVar/gnomAD), or pharmacological target interactions.
3. Data Provenance & Authoritative Sources: Distinguish experimental determination (PDB X-ray/Cryo-EM) vs computational prediction (AlphaFold pLDDT). Provide authoritative source links to RCSB PDB, UniProt, PubChem, or PubMed.
4. Summary for FileLink Bot Recipients: Provide a concise Persian summary (خلاصه علمی فارسی) suitable for Telegram file recipients.`;

  try {
    // Attempt gemini-4-argon with ThinkingLevel.HIGH as mandated
    const response = await ai.models.generateContent({
      model: 'gemini-4-argon',
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });

    res.json({
      success: true,
      modelUsed: 'gemini-4-argon',
      thinkingLevel: 'HIGH',
      analysis: response.text,
    });
  } catch (argonErr: any) {
    // Graceful fallback to gemini-3.8-flash if gemini-4-argon is unavailable or rate-limited
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      res.json({
        success: true,
        modelUsed: 'gemini-3.8-flash (fallback)',
        thinkingLevel: 'HIGH',
        analysis: fallbackResponse.text,
      });
    } catch (fallbackErr: any) {
      res.status(500).json({
        success: false,
        error: `Gemini API Error: ${argonErr.message || fallbackErr.message}`,
      });
    }
  }
});

// Mount Vite in development or serve dist in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[FileLink Bot Server] Listening on http://0.0.0.0:${port}`);
  });
}

startServer();
