"""
Audio transcription service using OpenAI Whisper API.
Handles transcription of audio files (m4a, mp3, wav, etc.)
"""
import os
import tempfile
from typing import Optional, Tuple
from openai import OpenAI
from app.core.config import settings


class AudioTranscriber:
    """Service for transcribing audio files using OpenAI Whisper API."""

    # Supported audio formats by Whisper
    SUPPORTED_EXTENSIONS = {'.m4a', '.mp3', '.wav', '.webm', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg'}

    # MIME types for audio files
    AUDIO_MIME_TYPES = {
        'audio/x-m4a': 'M4A Audio',
        'audio/mp4': 'M4A Audio',
        'audio/m4a': 'M4A Audio',
        'audio/mpeg': 'MP3 Audio',
        'audio/mp3': 'MP3 Audio',
        'audio/wav': 'WAV Audio',
        'audio/x-wav': 'WAV Audio',
        'audio/webm': 'WebM Audio',
        'audio/ogg': 'OGG Audio',
    }

    # Max file size for Whisper API (25MB)
    MAX_FILE_SIZE = 25 * 1024 * 1024

    def __init__(self):
        self.client = None
        if settings.OPENAI_API_KEY:
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def is_available(self) -> bool:
        """Check if transcription service is available."""
        return self.client is not None

    def is_supported_mime_type(self, mime_type: str) -> bool:
        """Check if the MIME type is a supported audio format."""
        return mime_type in self.AUDIO_MIME_TYPES

    def get_audio_type_name(self, mime_type: str) -> str:
        """Get human-readable name for audio type."""
        return self.AUDIO_MIME_TYPES.get(mime_type, 'Audio')

    def transcribe(
        self,
        audio_data: bytes,
        filename: str,
        language: Optional[str] = None
    ) -> Tuple[str, Optional[str]]:
        """
        Transcribe audio data to text using Whisper API.

        Args:
            audio_data: Raw audio file bytes
            filename: Original filename (used for extension detection)
            language: Optional language code (e.g., 'es', 'en'). Auto-detected if not provided.

        Returns:
            Tuple of (transcription_text, detected_language)

        Raises:
            ValueError: If service not available or file too large
            Exception: If transcription fails
        """
        if not self.is_available():
            raise ValueError("Audio transcription service not available. Check OPENAI_API_KEY.")

        # Check file size
        if len(audio_data) > self.MAX_FILE_SIZE:
            raise ValueError(f"Audio file too large. Maximum size is {self.MAX_FILE_SIZE // (1024*1024)}MB")

        # Get file extension
        _, ext = os.path.splitext(filename.lower())
        if not ext:
            ext = '.m4a'  # Default for iPhone recordings

        # Write to temp file (Whisper API requires a file)
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_path = temp_file.name

        try:
            # Call Whisper API
            with open(temp_path, 'rb') as audio_file:
                transcription_params = {
                    "model": "whisper-1",
                    "file": audio_file,
                    "response_format": "verbose_json"
                }

                # Only set language if explicitly provided
                if language:
                    transcription_params["language"] = language

                response = self.client.audio.transcriptions.create(**transcription_params)

            # Extract text and language
            transcription_text = response.text
            detected_language = getattr(response, 'language', None)

            return transcription_text, detected_language

        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except Exception:
                pass

    def estimate_cost(self, file_size_bytes: int, duration_minutes: Optional[float] = None) -> float:
        """
        Estimate transcription cost.

        Args:
            file_size_bytes: Size of audio file in bytes
            duration_minutes: Optional known duration in minutes

        Returns:
            Estimated cost in USD
        """
        # Whisper pricing: $0.006 per minute
        COST_PER_MINUTE = 0.006

        if duration_minutes:
            return duration_minutes * COST_PER_MINUTE

        # Rough estimate: ~1MB per minute for typical audio
        estimated_minutes = file_size_bytes / (1024 * 1024)
        return estimated_minutes * COST_PER_MINUTE


# Singleton instance
audio_transcriber = AudioTranscriber()
