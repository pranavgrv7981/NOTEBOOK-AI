import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { generateEmbedding } from './ai.js';

export async function processPdf(buffer, filename) {
  const data = await pdfParse(buffer);
  const text = data.text;
  
  // Clean up and chunk
  const chunks = chunkText(text);
  
  console.log(`Extracted ${chunks.length} chunks from ${filename}. Generating embeddings...`);
  
  const processedChunks = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    const embedding = await generateEmbedding(chunkText);
    processedChunks.push({
      text: chunkText,
      embedding
    });
  }
  
  return processedChunks;
}

function chunkText(text) {
  // Simple overlapping window chunking
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    
    if ((currentChunk.length + trimmed.length) > 1000) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = trimmed + ' ';
    } else {
      currentChunk += trimmed + ' ';
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}
