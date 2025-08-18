"""
FastAPI microservice for voice embedding generation using SpeechBrain ECAPA-TDNN
"""

import io
import logging
import numpy as np
import torch
import torchaudio
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import speechbrain as sb
from speechbrain.pretrained import EncoderClassifier
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Voice Embedding Service",
    description="Microservice for generating voice embeddings using SpeechBrain ECAPA-TDNN",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variable
model = None

class EmbeddingResponse(BaseModel):
    embedding: List[float]
    success: bool
    message: str = ""

def load_model():
    """Load the SpeechBrain ECAPA-TDNN model for speaker verification"""
    global model
    try:
        logger.info("Loading SpeechBrain ECAPA-TDNN model...")
        # Use the pre-trained ECAPA-TDNN model from SpeechBrain
        model = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir="pretrained_models/spkrec-ecapa-voxceleb",
            run_opts={"device": "cpu"}  # Use CPU for compatibility
        )
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise e

def preprocess_audio(audio_bytes: bytes) -> torch.Tensor:
    """
    Preprocess audio bytes to the format expected by the model
    - Convert to 16kHz mono
    - Normalize
    """
    try:
        # Load audio from bytes
        audio_io = io.BytesIO(audio_bytes)
        waveform, sample_rate = torchaudio.load(audio_io)
        
        # Convert to mono if stereo
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
        
        # Resample to 16kHz if needed
        if sample_rate != 16000:
            resampler = torchaudio.transforms.Resample(sample_rate, 16000)
            waveform = resampler(waveform)
        
        # Normalize
        waveform = waveform / (torch.max(torch.abs(waveform)) + 1e-8)
        
        return waveform.squeeze(0)  # Remove channel dimension
        
    except Exception as e:
        logger.error(f"Error preprocessing audio: {e}")
        raise HTTPException(status_code=400, detail=f"Audio preprocessing failed: {e}")

def generate_embedding(waveform: torch.Tensor) -> np.ndarray:
    """Generate normalized embedding from waveform"""
    try:
        if model is None:
            raise HTTPException(status_code=500, detail="Model not loaded")
        
        # Add batch dimension
        waveform = waveform.unsqueeze(0)
        
        # Generate embedding
        with torch.no_grad():
            embedding = model.encode_batch(waveform)
            
        # Convert to numpy and normalize (L2 normalization)
        embedding_np = embedding.squeeze().cpu().numpy()
        embedding_normalized = embedding_np / (np.linalg.norm(embedding_np) + 1e-8)
        
        return embedding_normalized
        
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {e}")

@app.on_event("startup")
async def startup_event():
    """Load the model when the service starts"""
    load_model()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "message": "Voice embedding service is running"
    }

@app.post("/embed", response_model=EmbeddingResponse)
async def create_embedding(file: UploadFile = File(...)):
    """
    Generate voice embedding from uploaded WAV file
    
    Expected input: WAV file (preferably 16kHz mono, but will be converted if needed)
    Returns: 192-dimensional normalized embedding vector
    """
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('audio/'):
            raise HTTPException(
                status_code=400, 
                detail="File must be an audio file (WAV preferred)"
            )
        
        # Read file contents
        audio_bytes = await file.read()
        
        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")
        
        # Preprocess audio
        waveform = preprocess_audio(audio_bytes)
        
        # Check minimum duration (should be at least 0.5 seconds)
        min_samples = int(0.5 * 16000)  # 0.5 seconds at 16kHz
        if len(waveform) < min_samples:
            raise HTTPException(
                status_code=400, 
                detail=f"Audio too short. Minimum 0.5 seconds required, got {len(waveform)/16000:.2f} seconds"
            )
        
        # Generate embedding
        embedding = generate_embedding(waveform)
        
        # Validate embedding dimensions (ECAPA-TDNN produces 192-dim embeddings)
        if len(embedding) != 192:
            logger.warning(f"Unexpected embedding dimension: {len(embedding)}, expected 192")
        
        return EmbeddingResponse(
            embedding=embedding.tolist(),
            success=True,
            message=f"Successfully generated {len(embedding)}-dimensional embedding"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in create_embedding: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@app.post("/embed-raw")
async def create_embedding_raw(audio_data: bytes = File(...)):
    """
    Alternative endpoint for raw audio bytes
    """
    try:
        if len(audio_data) == 0:
            raise HTTPException(status_code=400, detail="Empty audio data")
        
        # Preprocess audio
        waveform = preprocess_audio(audio_data)
        
        # Check minimum duration
        min_samples = int(0.5 * 16000)
        if len(waveform) < min_samples:
            raise HTTPException(
                status_code=400, 
                detail=f"Audio too short. Minimum 0.5 seconds required"
            )
        
        # Generate embedding
        embedding = generate_embedding(waveform)
        
        return {
            "embedding": embedding.tolist(),
            "success": True,
            "dimension": len(embedding)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in create_embedding_raw: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
