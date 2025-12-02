"""
Content summarization service.
Uses Claude API to generate summaries.
"""
from anthropic import Anthropic
from app.core.config import settings
from app.services.usage_tracker import usage_tracker


SUMMARY_PROMPT = """
Resume el siguiente contenido de forma clara y concisa.

## INSTRUCCIONES

1. Extrae los puntos principales (3-5 puntos clave)
2. Mantén la objetividad
3. No incluyas opiniones personales
4. El resumen debe ser comprensible sin leer el original
5. Máximo {max_words} palabras

## FORMATO

Escribe el resumen en un párrafo cohesivo. No uses listas ni bullets.
Responde SOLO con el resumen, sin explicaciones adicionales.

## CONTENIDO

Título: {title}

{content}
"""


class SummarizerService:
    """
    Service for generating summaries using Claude API.
    """

    def __init__(self):
        self.client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = "claude-3-5-haiku-20241022"

    async def summarize(
        self,
        title: str,
        content: str,
        max_words: int = 150,
        language: str = "es",
        user_id: str = None
    ) -> str:
        """
        Generate a summary of the content.

        Args:
            title: Content title
            content: Content text to summarize
            max_words: Maximum words in summary
            language: Language for the summary
            user_id: Optional user ID for tracking

        Returns:
            Summary string
        """
        try:
            # Prepare prompt
            prompt = SUMMARY_PROMPT.format(
                max_words=max_words,
                title=title,
                content=content[:10000]  # Limit content
            )

            # Add language instruction if not Spanish
            if language != "es":
                prompt += f"\n\nIMPORTANTE: Escribe el resumen en {language}."

            # Call Claude API
            response = self.client.messages.create(
                model=self.model,
                max_tokens=500,
                temperature=0.5,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            # Track usage if user_id provided
            if user_id and response.usage:
                await usage_tracker.track_usage(
                    user_id=user_id,
                    provider="anthropic",
                    model=self.model,
                    operation="summarization",
                    input_tokens=response.usage.input_tokens,
                    output_tokens=response.usage.output_tokens
                )

            summary = response.content[0].text.strip()

            return summary

        except Exception as e:
            # Return a basic summary on error
            return f"Error generating summary: {str(e)}"

    async def generate_title(self, content: str) -> str:
        """
        Generate a title for content that doesn't have one.

        Args:
            content: Content text

        Returns:
            Generated title
        """
        try:
            prompt = f"""
            Genera un título conciso y descriptivo para el siguiente contenido.
            El título debe tener máximo 10 palabras.
            Responde SOLO con el título, sin comillas ni explicaciones.

            Contenido:
            {content[:2000]}
            """

            response = self.client.messages.create(
                model=self.model,
                max_tokens=50,
                temperature=0.7,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            title = response.content[0].text.strip()

            # Remove quotes if present
            title = title.strip('"\'')

            return title

        except Exception as e:
            return "Untitled Content"

    async def extract_key_points(self, content: str, num_points: int = 5) -> list[str]:
        """
        Extract key points from content.

        Args:
            content: Content text
            num_points: Number of key points to extract

        Returns:
            List of key points
        """
        try:
            prompt = f"""
            Extrae los {num_points} puntos más importantes del siguiente contenido.
            Responde SOLO con los puntos, uno por línea, sin números ni bullets.

            Contenido:
            {content[:8000]}
            """

            response = self.client.messages.create(
                model=self.model,
                max_tokens=500,
                temperature=0.3,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            points_text = response.content[0].text.strip()
            points = [p.strip() for p in points_text.split("\n") if p.strip()]

            return points[:num_points]

        except Exception as e:
            return []


# Singleton instance
summarizer_service = SummarizerService()
