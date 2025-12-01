"""
Embeddings service using OpenAI API.
Generates vector embeddings for semantic search.
"""
from typing import List, Optional
from openai import OpenAI

from app.core.config import settings
from app.services.usage_tracker import usage_tracker


class EmbeddingsService:
    """
    Service for generating text embeddings using OpenAI.
    Uses text-embedding-3-small model (1536 dimensions).
    """

    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "text-embedding-3-small"
        self.dimensions = 1536

    async def generate_embedding(
        self,
        text: str,
        user_id: str = None,
        operation: str = "embedding"
    ) -> List[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed (max ~8000 tokens)
            user_id: Optional user ID for tracking
            operation: Operation type for tracking

        Returns:
            List of floats representing the embedding vector
        """
        try:
            # Truncate text if too long (roughly 8000 tokens ~ 32000 chars)
            truncated_text = text[:32000] if len(text) > 32000 else text

            response = self.client.embeddings.create(
                model=self.model,
                input=truncated_text,
                dimensions=self.dimensions
            )

            # Track usage if user_id provided
            if user_id and response.usage:
                await usage_tracker.track_usage(
                    user_id=user_id,
                    provider="openai",
                    model=self.model,
                    operation=operation,
                    input_tokens=response.usage.total_tokens,
                    output_tokens=0
                )

            return response.data[0].embedding

        except Exception as e:
            print(f"Error generating embedding: {e}")
            raise

    async def generate_embeddings_batch(
        self,
        texts: List[str],
        user_id: str = None,
        operation: str = "embedding_batch"
    ) -> List[List[float]]:
        """
        Generate embeddings for multiple texts in batch.

        Args:
            texts: List of texts to embed
            user_id: Optional user ID for tracking
            operation: Operation type for tracking

        Returns:
            List of embedding vectors
        """
        try:
            # Truncate each text
            truncated_texts = [
                text[:32000] if len(text) > 32000 else text
                for text in texts
            ]

            response = self.client.embeddings.create(
                model=self.model,
                input=truncated_texts,
                dimensions=self.dimensions
            )

            # Track usage if user_id provided
            if user_id and response.usage:
                await usage_tracker.track_usage(
                    user_id=user_id,
                    provider="openai",
                    model=self.model,
                    operation=operation,
                    input_tokens=response.usage.total_tokens,
                    output_tokens=0,
                    metadata={"batch_size": len(texts)}
                )

            # Sort by index to maintain order
            sorted_data = sorted(response.data, key=lambda x: x.index)
            return [item.embedding for item in sorted_data]

        except Exception as e:
            print(f"Error generating batch embeddings: {e}")
            raise

    def prepare_content_for_embedding(
        self,
        title: str,
        summary: str = "",
        content: str = "",
        concepts: List[str] = None,
        entities: dict = None,
        metadata: dict = None,
        max_length: int = 8000
    ) -> str:
        """
        Prepare content text for embedding generation.
        Combines title, summary, concepts, entities, metadata and content.

        Args:
            title: Content title
            summary: Content summary
            content: Raw content (will be truncated)
            concepts: List of concepts/keywords
            entities: Dict with organizations, people, products, etc.
            metadata: Dict with channel, duration, etc. for videos
            max_length: Maximum character length

        Returns:
            Combined text ready for embedding
        """
        parts = []

        # Title is most important
        if title:
            parts.append(f"Titulo: {title}")

        # Summary captures main ideas
        if summary:
            parts.append(f"Resumen: {summary}")

        # Concepts as keywords
        if concepts:
            parts.append(f"Conceptos: {', '.join(concepts)}")

        # Entities (organizations, persons, products, places)
        if entities:
            # Helper to extract names from entity list (handles both str and dict)
            def extract_names(entity_list):
                names = []
                for item in entity_list or []:
                    if isinstance(item, dict):
                        name = item.get("name")
                        if name:
                            names.append(name)
                    elif isinstance(item, str):
                        names.append(item)
                return names

            entity_parts = []
            orgs = extract_names(entities.get("organizations"))
            if orgs:
                entity_parts.append(f"Organizaciones: {', '.join(orgs)}")
            # Support both "persons" (schema) and "people" (legacy)
            persons = extract_names(entities.get("persons") or entities.get("people"))
            if persons:
                entity_parts.append(f"Personas: {', '.join(persons)}")
            products = extract_names(entities.get("products"))
            if products:
                entity_parts.append(f"Productos: {', '.join(products)}")
            # Support both "places" (schema) and "locations" (legacy)
            places = extract_names(entities.get("places") or entities.get("locations"))
            if places:
                entity_parts.append(f"Lugares: {', '.join(places)}")
            # Technologies (if present)
            technologies = extract_names(entities.get("technologies"))
            if technologies:
                entity_parts.append(f"Tecnologias: {', '.join(technologies)}")
            if entity_parts:
                parts.append("Entidades: " + "; ".join(entity_parts))

        # Metadata (especially useful for videos)
        if metadata:
            meta_parts = []
            if metadata.get("channel"):
                meta_parts.append(f"Canal: {metadata['channel']}")
            if metadata.get("author"):
                meta_parts.append(f"Autor: {metadata['author']}")
            if meta_parts:
                parts.append("Metadata: " + ", ".join(meta_parts))

        # Add content if space allows
        current_length = sum(len(p) for p in parts)
        remaining = max_length - current_length - 100  # Buffer

        if content and remaining > 500:
            truncated_content = content[:remaining]
            parts.append(f"Contenido: {truncated_content}")

        return "\n\n".join(parts)


# Singleton instance
embeddings_service = EmbeddingsService()
