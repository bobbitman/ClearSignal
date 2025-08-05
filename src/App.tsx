import React, { useState, useCallback } from 'react';
import { Upload, Settings, Download, Play, Pause, Volume2, AlertCircle, CheckCircle, Loader2, Mic } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useTranscription } from './hooks/useTranscription';
import { apiService } from './services/api';

import { Config, TranscriptionResult } from './types/api';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<Config>({
    maxFileSize: 25 * 1024 * 1024, // 25MB
    maxDuration: 1800, // 30 minutes
    supportedExtensions: ['.mp3', '.wav', '.m4a', '.flac', '.ogg'],
    assemblyAIKey: ''
  });

  const { isProcessing, progress, result, error, transcribeFile, reset } = useTranscription();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // Validate file size
      if (file.size > config.maxFileSize) {
        setError(`File size exceeds ${config.maxFileSize / (1024 * 1024)}MB limit`);
        return;
      }

      // Validate file extension
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!config.supportedExtensions.includes(extension)) {
        setError(`Unsupported file type. Supported: ${config.supportedExtensions.join(', ')}`);
        return;
      }

      setFile(file);
      reset();
    }
  }, [config]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': config.supportedExtensions
    },
    multiple: false
  });

  const handleUpload = async () => {
    if (!file) return;
    await transcribeFile(file);
  };

  const updateConfiguration = async (newConfig: Config) => {
    try {
      await apiService.updateConfig(newConfig);
      setConfig(newConfig);
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  };

  const downloadTranscription = () => {
    if (!result) return;

    const content = result.segments.map(segment => 
      `[${segment.speaker}] (${segment.start.toFixed(1)}s - ${segment.end.toFixed(1)}s, ${(segment.confidence * 100).toFixed(1)}% confidence)\n${segment.text}\n`
    ).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription_${result.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getSpeakerColor = (speaker: string) => {
    const colors = [
      'bg-blue-100 border-blue-300 text-blue-800',
      'bg-purple-100 border-purple-300 text-purple-800',
      'bg-green-100 border-green-300 text-green-800',
      'bg-orange-100 border-orange-300 text-orange-800'
    ];
    const index = speaker.charCodeAt(speaker.length - 1) % colors.length;
    return colors[index];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-md border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                <Mic className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AudioScribe AI
              </h1>
            </div>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <Settings className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Configuration Panel */}
        {showConfig && (
          <div className="mb-8 bg-white/70 backdrop-blur-md rounded-2xl border border-white/20 p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max File Size (MB)
                </label>
                <input
                  type="number"
                  value={config.maxFileSize / (1024 * 1024)}
                  onChange={(e) => setConfig(prev => ({ ...prev, maxFileSize: parseInt(e.target.value) * 1024 * 1024 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Duration (minutes)
                </label>
                <input
                  type="number"
                  value={config.maxDuration / 60}
                  onChange={(e) => setConfig(prev => ({ ...prev, maxDuration: parseInt(e.target.value) * 60 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AssemblyAI API Key
                </label>
                <input
                  type="password"
                  value={config.assemblyAIKey}
                  onChange={(e) => setConfig(prev => ({ ...prev, assemblyAIKey: e.target.value }))}
                  placeholder="Enter your AssemblyAI API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="mb-8">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer ${
              isDragActive 
                ? 'border-blue-400 bg-blue-50/50 scale-105' 
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
            } ${file ? 'bg-green-50/50 border-green-400' : ''}`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center space-y-4">
              {file ? (
                <>
                  <div className="p-4 bg-green-100 rounded-full">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-green-800">{file.name}</p>
                    <p className="text-sm text-green-600">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
                    <Upload className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-800">
                      {isDragActive ? 'Drop your audio file here' : 'Upload an audio file'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Supports: {config.supportedExtensions.join(', ')} • Max {config.maxFileSize / (1024 * 1024)}MB
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {file && !isProcessing && !result && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleUpload}
                disabled={!config.assemblyAIKey}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                Start Transcription
              </button>
            </div>
          )}
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="mb-8 bg-white/70 backdrop-blur-md rounded-2xl border border-white/20 p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center p-4 bg-blue-100 rounded-full mb-4">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Processing Audio</h3>
              <p className="text-gray-600 mb-4">Transcribing and analyzing speakers...</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{progress.toFixed(0)}% complete</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-8 bg-red-50/70 backdrop-blur-md rounded-2xl border border-red-200 p-6">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="text-lg font-semibold text-red-800">Error</h3>
                <p className="text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Results Header */}
            <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Transcription Results</h2>
                <button
                  onClick={downloadTranscription}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white font-medium rounded-lg hover:from-green-600 hover:to-blue-600 transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  <Download className="h-4 w-4" />
                  <span>Download .txt</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Language</p>
                  <p className="text-lg font-semibold text-blue-600">{result.language.toUpperCase()}</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Processing Time</p>
                  <p className="text-lg font-semibold text-purple-600">{result.processingTime}s</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Speakers</p>
                  <p className="text-lg font-semibold text-green-600">
                    {new Set(result.segments.map(s => s.speaker)).size}
                  </p>
                </div>
              </div>
            </div>

            {/* Transcription Segments */}
            <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/20 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Speaker-Diarized Transcription</h3>
              <div className="space-y-4">
                {result.segments.map((segment, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border-l-4 ${getSpeakerColor(segment.speaker)}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-semibold">{segment.speaker}</span>
                        <span className="text-sm text-gray-500">
                          {formatTime(segment.start)} - {formatTime(segment.end)}
                        </span>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(segment.confidence)}`}>
                        {(segment.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                    <p className="text-gray-800 leading-relaxed">{segment.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;