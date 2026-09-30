"""Abstract speech-to-text provider."""
from abc import ABC, abstractmethod

class SpeechToTextProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> dict:
        pass
