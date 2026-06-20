import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { db } from './db.js';
import { processPdf } from './processor.js';
import { cosineSimilarity, generateAnswer } from './ai.js';
import { randomUUID } from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const upload = multer({ storage: multer.memoryStorage() });

// 1. Upload PDF
app.post('/api/documents', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const fileId = randomUUID();
    const filename = req.file.originalname;
    
    // Parse PDF, chunk, embed
    const chunks = await processPdf(req.file.buffer, filename);
    
    // Store in DB
    await db.addDocument(fileId, filename);
    await db.addChunks(fileId, chunks);
    
    res.json({ success: true, id: fileId, filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. List Documents
app.get('/api/documents', async (req, res) => {
  try {
    const docs = await db.getDocuments();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Delete Document
app.delete('/api/documents/:id', async (req, res) => {
  try {
    await db.deleteDocument(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Ask Question
app.post('/api/ask', async (req, res) => {
  try {
    const { question, topK = 5 } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    // Embed the question
    const { generateEmbedding } = await import('./ai.js');
    const qEmbedding = await generateEmbedding(question);

    // Get all chunks (in-memory search for simplicity)
    const allChunks = await db.getAllChunks();
    
    if (allChunks.length === 0) {
      return res.json({ answer: "You haven't uploaded any documents yet!" });
    }

    // Calculate similarities
    const scoredChunks = allChunks.map(chunk => ({
      ...chunk,
      score: cosineSimilarity(qEmbedding, chunk.embedding)
    }));

    // Sort by descending score and take top K
    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, topK);

    // Generate answer using local LLM
    const answer = await generateAnswer(question, topChunks);
    
    res.json({ answer, sources: topChunks.map(c => c.filename) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Node backend running locally at http://localhost:${PORT}`);
});
