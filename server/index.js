const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration
let config = {
  maxFileSize: 25 * 1024 * 1024, // 25MB
  maxDuration: 1800, // 30 minutes
  supportedExtensions: ['.mp3', '.wav', '.m4a', '.flac', '.ogg'],
  assemblyAIKey: process.env.ASSEMBLY_AI_KEY || ''
};

// Load config from file if exists
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  try {
    const fileConfig = fs.readJsonSync(configPath);
    config = { ...config, ...fileConfig };
  } catch (error) {
    console.error('Error loading config.json:', error);
  }
}

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.supportedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Supported: ${config.supportedExtensions.join(', ')}`));
    }
  }
});

// Utility functions
const cleanupFile = async (filePath) => {
  try {
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
      console.log(`Cleaned up file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error cleaning up file ${filePath}:`, error);
  }
};

const uploadToAssemblyAI = async (filePath) => {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  const response = await axios.post('https://api.assemblyai.com/v2/upload', formData, {
    headers: {
      'authorization': config.assemblyAIKey,
      ...formData.getHeaders()
    }
  });

  return response.data.upload_url;
};

const submitTranscriptionJob = async (uploadUrl) => {
  const response = await axios.post('https://api.assemblyai.com/v2/transcript', {
    audio_url: uploadUrl,
    speaker_labels: true,
    language_detection: true,
    punctuate: true,
    format_text: true
  }, {
    headers: {
      'authorization': config.assemblyAIKey,
      'content-type': 'application/json'
    }
  });

  return response.data.id;
};

const getTranscriptionResult = async (jobId) => {
  while (true) {
    const response = await axios.get(`https://api.assemblyai.com/v2/transcript/${jobId}`, {
      headers: {
        'authorization': config.assemblyAIKey
      }
    });

    const result = response.data;
    const status = result.status;

    if (status === 'completed') {
      return result;
    } else if (status === 'error') {
      throw new Error(`Transcription failed: ${result.error || 'Unknown error'}`);
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
};

const processTranscriptionResult = (rawResult) => {
  const segments = [];

  if (rawResult.utterances) {
    rawResult.utterances.forEach(utterance => {
      segments.push({
        speaker: `Speaker ${utterance.speaker}`,
        text: utterance.text,
        start: utterance.start / 1000.0, // Convert to seconds
        end: utterance.end / 1000.0,
        confidence: utterance.confidence
      });
    });
  }

  return {
    id: rawResult.id,
    language: rawResult.language_code || 'unknown',
    segments: segments,
    fullText: rawResult.text || '',
    processingTime: rawResult.audio_duration ? rawResult.audio_duration / 1000.0 : 0
  };
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    maxFileSize: config.maxFileSize,
    maxDuration: config.maxDuration,
    supportedExtensions: config.supportedExtensions,
    hasApiKey: !!config.assemblyAIKey
  });
});

app.post('/api/config', async (req, res) => {
  try {
    const newConfig = {
      maxFileSize: req.body.maxFileSize || config.maxFileSize,
      maxDuration: req.body.maxDuration || config.maxDuration,
      supportedExtensions: req.body.supportedExtensions || config.supportedExtensions,
      assemblyAIKey: req.body.assemblyAIKey || config.assemblyAIKey
    };

    config = newConfig;

    // Save to config.json
    await fs.writeJson(configPath, config, { spaces: 2 });

    res.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!config.assemblyAIKey) {
      return res.status(400).json({ error: 'AssemblyAI API key not configured' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    filePath = req.file.path;
    const startTime = Date.now();

    console.log(`Processing file: ${req.file.originalname}`);

    // Upload to AssemblyAI
    const uploadUrl = await uploadToAssemblyAI(filePath);
    console.log(`Uploaded to AssemblyAI: ${uploadUrl}`);

    // Submit transcription job
    const jobId = await submitTranscriptionJob(uploadUrl);
    console.log(`Submitted transcription job: ${jobId}`);

    // Get result (this will poll until completion)
    const rawResult = await getTranscriptionResult(jobId);

    // Process result
    const result = processTranscriptionResult(rawResult);

    // Calculate processing time
    const processingTime = (Date.now() - startTime) / 1000;
    result.processingTime = processingTime;

    console.log(`Transcription completed in ${processingTime.toFixed(2)}s`);

    // Cleanup file
    setTimeout(() => cleanupFile(filePath), 1000);

    res.json(result);

  } catch (error) {
    console.error('Transcription error:', error);
    
    // Cleanup file on error
    if (filePath) {
      setTimeout(() => cleanupFile(filePath), 1000);
    }

    res.status(500).json({ 
      error: error.message || 'Failed to process audio file' 
    });
  }
});

app.get('/api/transcription/:jobId/status', async (req, res) => {
  try {
    if (!config.assemblyAIKey) {
      return res.status(400).json({ error: 'AssemblyAI API key not configured' });
    }

    const response = await axios.get(`https://api.assemblyai.com/v2/transcript/${req.params.jobId}`, {
      headers: {
        'authorization': config.assemblyAIKey
      }
    });

    const result = response.data;
    res.json({
      status: result.status,
      progress: result.progress || 0
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to get transcription status' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: `File size exceeds ${config.maxFileSize / (1024 * 1024)}MB limit` 
      });
    }
  }
  
  console.error('Server error:', error);
  res.status(500).json({ error: error.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Config loaded:`, {
    maxFileSize: `${config.maxFileSize / (1024 * 1024)}MB`,
    maxDuration: `${config.maxDuration / 60}min`,
    supportedExtensions: config.supportedExtensions,
    hasApiKey: !!config.assemblyAIKey
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});