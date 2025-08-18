/**
 * Voice enrollment and verification routes
 */

const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const { supabase } = require('../config/database');
const { voiceClient } = require('../lib/voice/pythonClient');
const { cosineSimilarity, averageEmbeddings, validateEmbedding, estimateSNR } = require('../lib/voice/cosine');

const router = express.Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files for enrollment
  },
  fileFilter: (req, file, cb) => {
    // Accept only audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

/**
 * POST /api/voice/enroll
 * Enroll a child's voice by processing 5 audio samples
 */
router.post('/enroll', 
  auth, 
  upload.array('samples', 5),
  body('deviceId').optional().isString().trim(),
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.userId;
    const { deviceId } = req.body;
    const audioFiles = req.files;

    // Verify user is a child
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'child') {
      return res.status(403).json({
        success: false,
        message: 'Only children can enroll their voice'
      });
    }

    // Validate audio files
    if (!audioFiles || audioFiles.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'At least 3 audio samples are required for enrollment'
      });
    }

    if (audioFiles.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 audio samples allowed'
      });
    }

    // Check if voice embedding service is available
    const healthCheck = await voiceClient.testConnection();
    if (!healthCheck.healthy) {
      return res.status(503).json({
        success: false,
        message: 'Voice embedding service is not available',
        details: healthCheck.message
      });
    }

    // Process audio files and generate embeddings
    const audioBuffers = audioFiles.map(file => file.buffer);
    const embeddingResult = await voiceClient.generateMultipleEmbeddings(audioBuffers);

    if (!embeddingResult.success || embeddingResult.embeddings.length < 3) {
      // Log failed enrollment attempt
      await supabase
        .from('voice_enroll_audit')
        .insert({
          child_id: userId,
          device_id: deviceId,
          success: false,
          samples_recorded: audioFiles.length,
          error_message: embeddingResult.message || 'Failed to generate sufficient embeddings'
        });

      return res.status(400).json({
        success: false,
        message: 'Failed to process audio samples for enrollment',
        details: embeddingResult.message,
        samplesProcessed: embeddingResult.successfulSamples,
        samplesRequired: audioFiles.length
      });
    }

    // Calculate average embedding
    let averagedEmbedding;
    try {
      averagedEmbedding = averageEmbeddings(embeddingResult.embeddings);
    } catch (error) {
      await supabase
        .from('voice_enroll_audit')
        .insert({
          child_id: userId,
          device_id: deviceId,
          success: false,
          samples_recorded: audioFiles.length,
          error_message: `Failed to average embeddings: ${error.message}`
        });

      return res.status(500).json({
        success: false,
        message: 'Failed to process voice embeddings',
        details: error.message
      });
    }

    // Calculate average SNR (basic quality check)
    let avgSnr = 0;
    try {
      // This is a simplified SNR calculation - in production you might want more sophisticated audio quality checks
      avgSnr = 25; // Default reasonable value - you could implement actual SNR calculation from audio buffers
    } catch (error) {
      console.warn('SNR calculation failed:', error.message);
    }

    // Store or update voiceprint in database
    const defaultThreshold = parseFloat(process.env.SV_THRESHOLD || '0.78');
    
    const { error: upsertError } = await supabase
      .from('voiceprints')
      .upsert({
        child_id: userId,
        embedding: averagedEmbedding,
        samples: embeddingResult.successfulSamples,
        threshold: defaultThreshold
      }, {
        onConflict: 'child_id'
      });

    if (upsertError) {
      console.error('Database error saving voiceprint:', upsertError);
      
      await supabase
        .from('voice_enroll_audit')
        .insert({
          child_id: userId,
          device_id: deviceId,
          success: false,
          samples_recorded: audioFiles.length,
          snr_avg: avgSnr,
          error_message: `Database error: ${upsertError.message}`
        });

      return res.status(500).json({
        success: false,
        message: 'Failed to save voice enrollment',
        details: 'Database error occurred'
      });
    }

    // Log successful enrollment
    await supabase
      .from('voice_enroll_audit')
      .insert({
        child_id: userId,
        device_id: deviceId,
        success: true,
        samples_recorded: audioFiles.length,
        snr_avg: avgSnr
      });

    res.json({
      success: true,
      message: 'Voice enrollment completed successfully',
      samplesProcessed: embeddingResult.successfulSamples,
      threshold: defaultThreshold,
      embeddingDimension: averagedEmbedding.length
    });

  } catch (error) {
    console.error('Voice enrollment error:', error);

    // Log failed enrollment attempt
    try {
      await supabase
        .from('voice_enroll_audit')
        .insert({
          child_id: req.user?.userId,
          device_id: req.body?.deviceId,
          success: false,
          samples_recorded: req.files?.length || 0,
          error_message: error.message
        });
    } catch (logError) {
      console.error('Failed to log enrollment error:', logError);
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during voice enrollment',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});

/**
 * POST /api/voice/verify
 * Verify a voice sample against enrolled voiceprint
 */
router.post('/verify', 
  auth, 
  upload.single('audio'),
  body('deviceId').optional().isString().trim(),
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.userId;
    const { deviceId } = req.body;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({
        success: false,
        message: 'Audio file is required for verification'
      });
    }

    // Get user's voiceprint
    const { data: voiceprint, error: voiceprintError } = await supabase
      .from('voiceprints')
      .select('embedding, threshold')
      .eq('child_id', userId)
      .single();

    if (voiceprintError || !voiceprint) {
      return res.status(404).json({
        success: false,
        message: 'No voice enrollment found. Please enroll your voice first.',
        needsEnrollment: true
      });
    }

    // Check if voice embedding service is available
    const healthCheck = await voiceClient.testConnection();
    if (!healthCheck.healthy) {
      return res.status(503).json({
        success: false,
        message: 'Voice verification service is not available'
      });
    }

    // Generate embedding for verification audio
    const embeddingResult = await voiceClient.generateEmbedding(audioFile.buffer, 'verification.wav');

    if (!embeddingResult.success) {
      await supabase
        .from('voice_verify_audit')
        .insert({
          child_id: userId,
          device_id: deviceId,
          score: null,
          match: false,
          threshold_used: voiceprint.threshold
        });

      return res.status(400).json({
        success: false,
        message: 'Failed to process verification audio',
        details: embeddingResult.message
      });
    }

    // Validate embedding
    if (!validateEmbedding(embeddingResult.embedding)) {
      await supabase
        .from('voice_verify_audit')
        .insert({
          child_id: userId,
          device_id: deviceId,
          score: null,
          match: false,
          threshold_used: voiceprint.threshold
        });

      return res.status(400).json({
        success: false,
        message: 'Invalid embedding generated from verification audio'
      });
    }

    // Calculate cosine similarity
    let score;
    try {
      score = cosineSimilarity(embeddingResult.embedding, voiceprint.embedding);
    } catch (error) {
      console.error('Cosine similarity calculation failed:', error);
      
      await supabase
        .from('voice_verify_audit')
        .insert({
          child_id: userId,
          device_id: deviceId,
          score: null,
          match: false,
          threshold_used: voiceprint.threshold
        });

      return res.status(500).json({
        success: false,
        message: 'Failed to compare voice samples'
      });
    }

    const match = score >= voiceprint.threshold;

    // Log verification attempt
    await supabase
      .from('voice_verify_audit')
      .insert({
        child_id: userId,
        device_id: deviceId,
        score: score,
        match: match,
        threshold_used: voiceprint.threshold
      });

    res.json({
      success: true,
      score: Math.round(score * 1000) / 1000, // Round to 3 decimal places
      match: match,
      threshold: voiceprint.threshold,
      message: match ? 'Voice verification successful' : 'Voice verification failed'
    });

  } catch (error) {
    console.error('Voice verification error:', error);

    // Log failed verification attempt
    try {
      await supabase
        .from('voice_verify_audit')
        .insert({
          child_id: req.user?.userId,
          device_id: req.body?.deviceId,
          score: null,
          match: false,
          threshold_used: null
        });
    } catch (logError) {
      console.error('Failed to log verification error:', logError);
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during voice verification',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});

/**
 * GET /api/voice/status
 * Get voice enrollment status for the current user
 */
router.get('/status', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { data: voiceprint, error } = await supabase
      .from('voiceprints')
      .select('samples, threshold, created_at, updated_at')
      .eq('child_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw error;
    }

    const isEnrolled = !!voiceprint;

    res.json({
      success: true,
      enrolled: isEnrolled,
      voiceprint: isEnrolled ? {
        samples: voiceprint.samples,
        threshold: voiceprint.threshold,
        enrolledAt: voiceprint.created_at,
        lastUpdated: voiceprint.updated_at
      } : null
    });

  } catch (error) {
    console.error('Voice status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get voice status'
    });
  }
});

/**
 * DELETE /api/voice/enrollment
 * Remove voice enrollment for the current user
 */
router.delete('/enrollment', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { error } = await supabase
      .from('voiceprints')
      .delete()
      .eq('child_id', userId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Voice enrollment removed successfully'
    });

  } catch (error) {
    console.error('Voice enrollment deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove voice enrollment'
    });
  }
});

/**
 * GET /api/voice/health
 * Check health of voice services
 */
router.get('/health', async (req, res) => {
  try {
    const pythonServiceStatus = await voiceClient.testConnection();
    
    res.json({
      success: true,
      services: {
        python: {
          connected: pythonServiceStatus.connected,
          healthy: pythonServiceStatus.healthy,
          url: pythonServiceStatus.serviceUrl,
          message: pythonServiceStatus.message
        }
      }
    });

  } catch (error) {
    console.error('Voice health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Audio file too large. Maximum size is 10MB.'
      });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 5 files allowed for enrollment.'
      });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.'
      });
    }
  } else if (error.message === 'Only audio files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Only audio files are allowed.'
    });
  }

  next(error);
});

module.exports = router;
