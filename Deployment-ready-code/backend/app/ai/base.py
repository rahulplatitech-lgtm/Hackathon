"""Abstract AI provider."""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class AIProvider(ABC):
    @abstractmethod
    async def analyze_emergency(self, text: str, location: Optional[str] = None) -> Dict[str, Any]:
        """Extract emergency information from text."""
        pass

    @abstractmethod
    async def generate_explanation(self, context: Dict[str, Any]) -> str:
        """Generate human-readable explanation for plan changes."""
        pass
