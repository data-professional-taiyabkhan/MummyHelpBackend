/**
 * Cosine similarity calculation utilities for voice verification
 */

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vectorA - First embedding vector
 * @param {number[]} vectorB - Second embedding vector
 * @returns {number} Cosine similarity score between -1 and 1
 */
function cosineSimilarity(vectorA, vectorB) {
  if (!vectorA || !vectorB) {
    throw new Error('Both vectors must be provided');
  }
  
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  if (vectorA.length === 0) {
    throw new Error('Vectors cannot be empty');
  }
  
  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
  }
  
  // Calculate magnitudes
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < vectorA.length; i++) {
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  
  // Avoid division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  // Calculate cosine similarity
  const similarity = dotProduct / (magnitudeA * magnitudeB);
  
  // Clamp to valid range [-1, 1] to handle floating point errors
  return Math.max(-1, Math.min(1, similarity));
}

/**
 * Average multiple embeddings (for enrollment)
 * @param {number[][]} embeddings - Array of embedding vectors
 * @returns {number[]} Averaged embedding vector
 */
function averageEmbeddings(embeddings) {
  if (!embeddings || embeddings.length === 0) {
    throw new Error('Embeddings array cannot be empty');
  }
  
  const dimension = embeddings[0].length;
  
  // Validate all embeddings have same dimension
  for (let i = 1; i < embeddings.length; i++) {
    if (embeddings[i].length !== dimension) {
      throw new Error('All embeddings must have the same dimension');
    }
  }
  
  // Calculate average
  const averaged = new Array(dimension).fill(0);
  
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = 0; j < dimension; j++) {
      averaged[j] += embeddings[i][j];
    }
  }
  
  // Divide by number of embeddings
  for (let j = 0; j < dimension; j++) {
    averaged[j] /= embeddings.length;
  }
  
  // Normalize the averaged embedding (L2 normalization)
  const magnitude = Math.sqrt(averaged.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude === 0) {
    throw new Error('Cannot normalize zero vector');
  }
  
  for (let j = 0; j < dimension; j++) {
    averaged[j] /= magnitude;
  }
  
  return averaged;
}

/**
 * Validate embedding vector
 * @param {number[]} embedding - Embedding vector to validate
 * @param {number} expectedDimension - Expected dimension (default: 192 for ECAPA-TDNN)
 * @returns {boolean} True if valid
 */
function validateEmbedding(embedding, expectedDimension = 192) {
  if (!Array.isArray(embedding)) {
    return false;
  }
  
  if (embedding.length !== expectedDimension) {
    return false;
  }
  
  // Check if all elements are numbers and finite
  for (let i = 0; i < embedding.length; i++) {
    if (typeof embedding[i] !== 'number' || !isFinite(embedding[i])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Calculate signal-to-noise ratio estimation (basic)
 * @param {number[]} audioSamples - Audio samples array
 * @returns {number} Estimated SNR in dB
 */
function estimateSNR(audioSamples) {
  if (!audioSamples || audioSamples.length === 0) {
    return 0;
  }
  
  // Calculate RMS (signal power)
  const rms = Math.sqrt(
    audioSamples.reduce((sum, sample) => sum + sample * sample, 0) / audioSamples.length
  );
  
  // Simple noise estimation using quieter parts
  const sortedSamples = [...audioSamples].map(Math.abs).sort((a, b) => a - b);
  const noiseFloor = sortedSamples[Math.floor(sortedSamples.length * 0.1)]; // Bottom 10%
  
  if (noiseFloor === 0) {
    return 60; // Assume high SNR if no noise detected
  }
  
  const snr = 20 * Math.log10(rms / noiseFloor);
  return Math.max(0, Math.min(60, snr)); // Clamp between 0-60 dB
}

module.exports = {
  cosineSimilarity,
  averageEmbeddings,
  validateEmbedding,
  estimateSNR
};
