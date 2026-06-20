import { pipeline, env } from '@huggingface/transformers';

// Suppress local cache warnings if needed
env.allowLocalModels = false;

// We will load the models lazily so the server starts fast.
let embedder = null;
let generator = null;

export async function getEmbedder() {
  if (!embedder) {
    console.log('Loading embedding model (all-MiniLM-L6-v2)...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embedding model loaded.');
  }
  return embedder;
}

export async function getGenerator() {
  if (!generator) {
    console.log('Loading local LLM (Qwen 0.5B)... This may take a minute the first time.');
    generator = await pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Chat');
    console.log('LLM loaded.');
  }
  return generator;
}

/**
 * Generate embedding for a single text.
 */
export async function generateEmbedding(text) {
  const model = await getEmbedder();
  const result = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

/**
 * Helper to compute cosine similarity between two vectors.
 */
export function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generate an answer using the local LLM.
 */
export async function generateAnswer(question, contextChunks, topK = 5) {
  // Sort chunks by similarity if they aren't already, but we assume they are.
  const contextText = contextChunks.map(c => `[${c.filename}] ${c.text}`).join('\n\n');
  
  const prompt = `<|im_start|>system
You are a helpful AI assistant. Answer the user's question using ONLY the provided context.
Context:
${contextText}<|im_end|>
<|im_start|>user
${question}<|im_end|>
<|im_start|>assistant
`;

  const model = await getGenerator();
  const output = await model(prompt, {
    max_new_tokens: 256,
    temperature: 0.1,
    repetition_penalty: 1.1,
    return_full_text: false,
  });

  return output[0].generated_text.trim();
}
