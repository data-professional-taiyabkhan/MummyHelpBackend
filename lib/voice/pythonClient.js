/**
 * Client for communicating with the Python FastAPI voice embedding service
 */

const axios = require('axios');
const FormData = require('form-data');

class PythonVoiceClient {
  constructor(baseUrl = null) {
    this.baseUrl = baseUrl || process.env.VOICE_EMBED_URL || 'http://localhost:8000';
    this.timeout = 30000; // 30 seconds timeout
    
    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'User-Agent': 'MummyHelp-Backend/1.0'
      }
    });
  }
  
  /**
   * Check if the Python service is healthy
   * @returns {Promise<boolean>} True if service is healthy
   */
  async isHealthy() {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy' && response.data.model_loaded === true;
    } catch (error) {
      console.error('Python voice service health check failed:', error.message);
      return false;
    }
  }
  
  /**
   * Generate embedding from audio buffer
   * @param {Buffer} audioBuffer - Audio file buffer (WAV format preferred)
   * @param {string} filename - Original filename (optional, for debugging)
   * @returns {Promise<{embedding: number[], success: boolean, message: string}>}
   */
  async generateEmbedding(audioBuffer, filename = 'audio.wav') {
    try {
      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('Audio buffer is empty');
      }
      
      // Create form data
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: filename,
        contentType: 'audio/wav'
      });
      
      // Make request to Python service
      const response = await this.client.post('/embed', formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Length': formData.getLengthSync()
        },
        maxContentLength: 50 * 1024 * 1024, // 50MB max
        maxBodyLength: 50 * 1024 * 1024
      });
      
      const data = response.data;
      
      if (!data.success) {
        throw new Error(data.message || 'Embedding generation failed');
      }
      
      if (!Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding format received');
      }
      
      // Validate embedding dimension (ECAPA-TDNN should return 192-dim)
      if (data.embedding.length !== 192) {
        console.warn(`Unexpected embedding dimension: ${data.embedding.length}, expected 192`);
      }
      
      return {
        embedding: data.embedding,
        success: true,
        message: data.message || 'Embedding generated successfully',
        dimension: data.embedding.length
      };
      
    } catch (error) {
      console.error('Error generating embedding:', error.message);
      
      if (error.response) {
        // HTTP error from Python service
        const status = error.response.status;
        const message = error.response.data?.detail || error.response.data?.message || error.message;
        
        return {
          embedding: null,
          success: false,
          message: `Python service error (${status}): ${message}`,
          httpStatus: status
        };
      } else if (error.code === 'ECONNREFUSED') {
        return {
          embedding: null,
          success: false,
          message: 'Cannot connect to voice embedding service. Please ensure it is running.',
          error: 'CONNECTION_REFUSED'
        };
      } else if (error.code === 'ETIMEDOUT') {
        return {
          embedding: null,
          success: false,
          message: 'Voice embedding service timeout. Audio file may be too large.',
          error: 'TIMEOUT'
        };
      } else {
        return {
          embedding: null,
          success: false,
          message: `Embedding generation failed: ${error.message}`,
          error: error.code || 'UNKNOWN'
        };
      }
    }
  }
  
  /**
   * Generate embeddings for multiple audio files (for enrollment)
   * @param {Buffer[]} audioBuffers - Array of audio file buffers
   * @returns {Promise<{embeddings: number[][], success: boolean, failures: number}>}
   */
  async generateMultipleEmbeddings(audioBuffers) {
    try {
      if (!Array.isArray(audioBuffers) || audioBuffers.length === 0) {
        throw new Error('Audio buffers array is empty');
      }
      
      const results = [];
      const promises = audioBuffers.map((buffer, index) => 
        this.generateEmbedding(buffer, `sample_${index + 1}.wav`)
      );
      
      const responses = await Promise.allSettled(promises);
      let failures = 0;
      
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        
        if (response.status === 'fulfilled' && response.value.success) {
          results.push(response.value.embedding);
        } else {
          failures++;
          console.error(`Failed to generate embedding for sample ${i + 1}:`, 
            response.status === 'fulfilled' ? response.value.message : response.reason);
        }
      }
      
      return {
        embeddings: results,
        success: results.length > 0,
        totalSamples: audioBuffers.length,
        successfulSamples: results.length,
        failures: failures,
        message: `Generated ${results.length}/${audioBuffers.length} embeddings successfully`
      };
      
    } catch (error) {
      console.error('Error generating multiple embeddings:', error.message);
      return {
        embeddings: [],
        success: false,
        failures: audioBuffers?.length || 0,
        message: `Failed to generate embeddings: ${error.message}`
      };
    }
  }
  
  /**
   * Test the connection with a simple health check
   * @returns {Promise<{connected: boolean, healthy: boolean, message: string}>}
   */
  async testConnection() {
    try {
      const response = await this.client.get('/health');
      const data = response.data;
      
      return {
        connected: true,
        healthy: data.status === 'healthy' && data.model_loaded === true,
        message: data.message || 'Service is reachable',
        modelLoaded: data.model_loaded,
        serviceUrl: this.baseUrl
      };
      
    } catch (error) {
      return {
        connected: false,
        healthy: false,
        message: error.code === 'ECONNREFUSED' 
          ? 'Cannot connect to voice embedding service'
          : `Connection test failed: ${error.message}`,
        serviceUrl: this.baseUrl,
        error: error.code || 'UNKNOWN'
      };
    }
  }
}

// Create singleton instance
const voiceClient = new PythonVoiceClient();

module.exports = {
  PythonVoiceClient,
  voiceClient
};
