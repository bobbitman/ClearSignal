# AudioScribe AI - Node.js Backend

Express.js backend for audio transcription using AssemblyAI.

## Setup

1. Install dependencies (already done if running from root):
```bash
npm install
```

2. Set up your AssemblyAI API key:
   - Copy `.env.example` to `.env` in the root directory
   - Add your AssemblyAI API key to the `.env` file
   - Or update `server/config.json` with your API key

3. Run the server:
```bash
npm run server
```

## Configuration

The backend can be configured through:
- `server/config.json` file
- Environment variables (see `.env.example`)
- Runtime API calls to `/api/config` endpoint

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/config` - Get current configuration
- `POST /api/config` - Update configuration
- `POST /api/transcribe` - Upload and transcribe audio file
- `GET /api/transcription/{job_id}/status` - Get transcription status

## Features

- File upload validation (size, type, duration)
- AssemblyAI integration with speaker diarization
- Language detection
- Temporary file cleanup
- Comprehensive error handling and logging
- CORS support for frontend integration
- Multer for secure file handling