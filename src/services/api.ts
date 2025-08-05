import { Config, TranscriptionResult, ApiError } from '../types/api';

const API_BASE_URL = 'http://localhost:3001/api';

class ApiService {
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail);
    }
    return response.json();
  }

  async getConfig(): Promise<Omit<Config, 'assemblyAIKey'> & { hasApiKey: boolean }> {
    const response = await fetch(`${API_BASE_URL}/config`);
    return this.handleResponse(response);
  }

  async updateConfig(config: Config): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxFileSize: config.maxFileSize,
        maxDuration: config.maxDuration,
        supportedExtensions: config.supportedExtensions,
        assemblyAIKey: config.assemblyAIKey,
      }),
    });
    return this.handleResponse(response);
  }

  async transcribeAudio(file: File): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/transcribe`, {
      method: 'POST',
      body: formData,
    });

    return this.handleResponse(response);
  }

  async getTranscriptionStatus(jobId: string): Promise<{ status: string; progress: number }> {
    const response = await fetch(`${API_BASE_URL}/transcription/${jobId}/status`);
    return this.handleResponse(response);
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${API_BASE_URL}/health`);
    return this.handleResponse(response);
  }
}

export const apiService = new ApiService();