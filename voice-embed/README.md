# Voice Embedding Service

FastAPI microservice for generating voice embeddings using SpeechBrain ECAPA-TDNN model.

## Features

- Generate 192-dimensional voice embeddings from audio files
- Automatic audio preprocessing (16kHz mono conversion)
- L2 normalized embeddings for cosine similarity comparison
- Health check endpoint
- CORS enabled for web integration

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Start the service:
```bash
python main.py
```

The service will be available at `http://localhost:8000`

## API Endpoints

### POST /embed
Generate embedding from uploaded audio file.

**Request:**
- File upload (multipart/form-data)
- Content-Type: audio/* (WAV preferred)

**Response:**
```json
{
  "embedding": [192 float values],
  "success": true,
  "message": "Successfully generated 192-dimensional embedding"
}
```

### POST /embed-raw
Generate embedding from raw audio bytes.

### GET /health
Health check endpoint.

## Usage Example

```bash
curl -X POST "http://localhost:8000/embed" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@audio_sample.wav"
```

## Docker Support

```bash
# Build image
docker build -t voice-embed .

# Run container
docker run -p 8000:8000 voice-embed
```

## Notes

- First request may be slower due to model loading
- Model files are cached in `pretrained_models/` directory
- Minimum audio duration: 0.5 seconds
- Optimal audio format: 16kHz mono WAV
