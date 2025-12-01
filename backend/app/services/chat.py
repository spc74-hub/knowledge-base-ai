"""
Chat RAG service.
Retrieval-Augmented Generation for chatting with your knowledge base.
"""
from typing import List, Optional
from anthropic import Anthropic
from pydantic import BaseModel

from app.core.config import settings
from app.services.embeddings import embeddings_service
from app.services.usage_tracker import usage_tracker


class ChatSource(BaseModel):
    """A source used to answer a question."""
    id: str
    title: str
    url: str
    type: str
    relevance: float


class ChatResponse(BaseModel):
    """Response from the chat service."""
    message: str
    sources: List[ChatSource]


SYSTEM_PROMPT = """Eres un asistente de conocimiento personal. Tu trabajo es ayudar al usuario a encontrar y entender información de su base de conocimiento personal.

INSTRUCCIONES:
1. Responde SIEMPRE en español a menos que el usuario escriba en otro idioma
2. Basa tus respuestas ÚNICAMENTE en el contexto proporcionado
3. Si la información no está en el contexto, dilo claramente: "No tengo información sobre eso en tu base de conocimiento"
4. Cita las fuentes cuando sea relevante (menciona el título del contenido)
5. Sé conciso pero informativo
6. Si el usuario hace una pregunta general sobre su base de conocimiento (ej: "¿qué tengo sobre X?"), lista los contenidos relevantes

CONTEXTO DEL USUARIO (contenidos de su knowledge base):
{context}
"""

USER_QUERY_PROMPT = """Pregunta del usuario: {query}

Responde basándote únicamente en el contexto proporcionado arriba. Si no hay información relevante, indícalo."""


class ChatService:
    """
    Service for RAG-based chat with the knowledge base.
    """

    def __init__(self):
        self.client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = "claude-sonnet-4-20250514"

    async def search_similar(
        self,
        query: str,
        user_id: str,
        db,
        limit: int = 5,
        threshold: float = 0.5
    ) -> List[dict]:
        """
        Search for similar content using semantic search.

        Args:
            query: User's search query
            user_id: User ID for filtering
            db: Supabase client
            limit: Max results to return
            threshold: Minimum similarity threshold

        Returns:
            List of matching content items with similarity scores
        """
        try:
            # Generate embedding for the query
            query_embedding = await embeddings_service.generate_embedding(query)

            # Call the match_contents function in Supabase
            response = db.rpc(
                'match_contents',
                {
                    'query_embedding': query_embedding,
                    'match_threshold': threshold,
                    'match_count': limit,
                    'p_user_id': user_id
                }
            ).execute()

            return response.data or []
        except Exception as e:
            print(f"Semantic search failed: {e}")
            # Fallback: return recent contents without semantic search
            try:
                fallback = db.table("contents").select(
                    "id, title, summary, url, type, iab_tier1, concepts"
                ).eq("user_id", user_id).limit(limit).execute()

                # Add a fake similarity score
                return [
                    {**item, "similarity": 0.5}
                    for item in (fallback.data or [])
                ]
            except Exception:
                return []

    async def chat(
        self,
        query: str,
        user_id: str,
        db,
        conversation_history: List[dict] = None,
        max_sources: int = 5
    ) -> ChatResponse:
        """
        Chat with the knowledge base using RAG.

        Args:
            query: User's message/question
            user_id: User ID
            db: Supabase client
            conversation_history: Previous messages in the conversation
            max_sources: Maximum number of sources to include

        Returns:
            ChatResponse with message and sources
        """
        # Step 1: Search for relevant content
        similar_contents = await self.search_similar(
            query=query,
            user_id=user_id,
            db=db,
            limit=max_sources,
            threshold=0.4  # Lower threshold to get more context
        )

        # Step 2: Build context from retrieved content
        context_parts = []
        sources = []

        for i, content in enumerate(similar_contents, 1):
            context_parts.append(f"""
--- Fuente {i}: {content['title']} ---
URL: {content['url']}
Tipo: {content['type']}
Categoría: {content.get('iab_tier1', 'N/A')}
Resumen: {content.get('summary', 'Sin resumen')}
Conceptos: {', '.join(content.get('concepts', []))}
""")
            sources.append(ChatSource(
                id=content['id'],
                title=content['title'],
                url=content['url'],
                type=content['type'],
                relevance=content.get('similarity', 0)
            ))

        context = "\n".join(context_parts) if context_parts else "No se encontró contenido relevante en la base de conocimiento."

        # Step 3: Build messages for Claude
        messages = []

        # Add conversation history if exists
        if conversation_history:
            for msg in conversation_history[-10:]:  # Last 10 messages
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })

        # Add current query
        messages.append({
            "role": "user",
            "content": USER_QUERY_PROMPT.format(query=query)
        })

        # Step 4: Call Claude
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1500,
            system=SYSTEM_PROMPT.format(context=context),
            messages=messages
        )

        # Track usage
        if response.usage:
            await usage_tracker.track_usage(
                user_id=user_id,
                provider="anthropic",
                model=self.model,
                operation="chat",
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                metadata={"sources_count": len(sources)}
            )

        assistant_message = response.content[0].text

        return ChatResponse(
            message=assistant_message,
            sources=sources
        )

    async def generate_session_title(self, first_message: str) -> str:
        """
        Generate a title for a chat session based on the first message.

        Args:
            first_message: The first user message

        Returns:
            A short title for the session
        """
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=50,
                messages=[{
                    "role": "user",
                    "content": f"Genera un título muy corto (máximo 5 palabras) para una conversación que empieza con: '{first_message}'. Responde SOLO con el título, sin comillas ni explicaciones."
                }]
            )
            return response.content[0].text.strip()[:50]
        except Exception:
            return first_message[:50]


# Singleton instance
chat_service = ChatService()
