"""
Embedding service.
Uses OpenAI API to generate embeddings for semantic search.
"""
from openai import OpenAI
from typing import List
from app.core.config import settings


class EmbedderService:
    """
    Service for generating text embeddings using OpenAI API.
    Uses text-embedding-3-small model (1536 dimensions).
    """

    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "text-embedding-3-small"
        self.dimensions = 1536
        self.max_tokens = 8191  # Max input tokens for this model

    async def embed(self, text: str) -> List[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            List of floats (1536 dimensions)
        """
        try:
            # Truncate if too long (rough estimate: 4 chars per token)
            max_chars = self.max_tokens * 4
            if len(text) > max_chars:
                text = text[:max_chars]

            response = self.client.embeddings.create(
                input=text,
                model=self.model
            )

            return response.data[0].embedding

        except Exception as e:
            # Return zero vector on error (not ideal, but prevents crashes)
            return [0.0] * self.dimensions

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts.

        Args:
            texts: List of texts to embed

        Returns:
            List of embeddings
        """
        try:
            # Truncate each text
            max_chars = self.max_tokens * 4
            processed_texts = [t[:max_chars] for t in texts]

            response = self.client.embeddings.create(
                input=processed_texts,
                model=self.model
            )

            return [data.embedding for data in response.data]

        except Exception as e:
            # Return zero vectors on error
            return [[0.0] * self.dimensions for _ in texts]

    def prepare_text_for_embedding(
        self,
        title: str,
        summary: str = "",
        concepts: List[str] = None
    ) -> str:
        """
        Prepare text for embedding by combining relevant fields.

        Args:
            title: Content title
            summary: Content summary
            concepts: List of concepts/keywords

        Returns:
            Combined text ready for embedding
        """
        parts = []

        if title:
            parts.append(f"Title: {title}")

        if summary:
            parts.append(f"Summary: {summary}")

        if concepts:
            parts.append(f"Keywords: {', '.join(concepts)}")

        return "\n".join(parts)


# Singleton instance
embedder_service = EmbedderService()
