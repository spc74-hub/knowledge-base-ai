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
        Search for similar content using hybrid search (semantic + entity matching).

        Args:
            query: User's search query
            user_id: User ID for filtering
            db: Supabase client
            limit: Max results to return
            threshold: Minimum similarity threshold

        Returns:
            List of matching content items with similarity scores
        """
        results = {}  # Use dict to dedupe by ID

        # 1. Semantic search
        try:
            query_embedding = await embeddings_service.generate_embedding(query)
            response = db.rpc(
                'match_contents',
                {
                    'query_embedding': query_embedding,
                    'match_threshold': threshold,
                    'match_count': limit,
                    'p_user_id': user_id
                }
            ).execute()

            for item in response.data or []:
                results[item['id']] = {**item, 'match_type': 'semantic'}
        except Exception as e:
            print(f"Semantic search failed: {e}")

        # 2. Entity search - search in organizations, products, persons
        try:
            query_lower = query.lower()
            print(f"[Entity Search] Looking for '{query_lower}' in entities...")

            # Fetch all user contents with entities
            entity_response = db.table("contents").select(
                "id, title, summary, url, type, iab_tier1, concepts, entities"
            ).eq("user_id", user_id).execute()

            print(f"[Entity Search] Found {len(entity_response.data or [])} contents to search")

            # Search in entity names
            entity_fields = ['organizations', 'products', 'persons']
            for item in entity_response.data or []:
                if item['id'] in results:
                    continue  # Already found via semantic

                entities = item.get('entities') or {}

                for field in entity_fields:
                    entity_list = entities.get(field) or []

                    for entity in entity_list:
                        name = entity.get('name') if isinstance(entity, dict) else entity
                        # Check if entity name appears in the query (not the other way around)
                        if name and name.lower() in query_lower:
                            print(f"[Entity Search] MATCH! Found '{name}' in {field} for '{item['title']}'")
                            results[item['id']] = {
                                **item,
                                'similarity': 0.75,  # Good relevance for entity match
                                'match_type': f'entity_{field}'
                            }
                            break
                    if item['id'] in results:
                        break

        except Exception as e:
            import traceback
            print(f"Entity search failed: {e}")
            print(traceback.format_exc())

        # 3. Text search in title/summary as fallback
        try:
            text_response = db.table("contents").select(
                "id, title, summary, url, type, iab_tier1, concepts, entities"
            ).eq("user_id", user_id).or_(
                f"title.ilike.%{query}%,summary.ilike.%{query}%"
            ).limit(limit).execute()

            for item in text_response.data or []:
                if item['id'] not in results:
                    results[item['id']] = {
                        **item,
                        'similarity': 0.6,  # Medium relevance for text match
                        'match_type': 'text'
                    }
        except Exception as e:
            print(f"Text search failed: {e}")

        # Sort by similarity and return top results
        sorted_results = sorted(
            results.values(),
            key=lambda x: x.get('similarity', 0),
            reverse=True
        )[:limit]

        return sorted_results

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

        def extract_entity_names(entity_list):
            """Extract names from entity list (handles both str and dict)."""
            names = []
            for item in entity_list or []:
                if isinstance(item, dict):
                    name = item.get("name")
                    if name:
                        names.append(name)
                elif isinstance(item, str):
                    names.append(item)
            return names

        for i, content in enumerate(similar_contents, 1):
            # Build entities string
            entities = content.get('entities') or {}
            entities_parts = []
            orgs = extract_entity_names(entities.get('organizations'))
            if orgs:
                entities_parts.append(f"Organizaciones: {', '.join(orgs)}")
            persons = extract_entity_names(entities.get('persons'))
            if persons:
                entities_parts.append(f"Personas: {', '.join(persons)}")
            products = extract_entity_names(entities.get('products'))
            if products:
                entities_parts.append(f"Productos: {', '.join(products)}")
            entities_str = "; ".join(entities_parts) if entities_parts else "N/A"

            context_parts.append(f"""
--- Fuente {i}: {content['title']} ---
URL: {content['url']}
Tipo: {content['type']}
Categoría: {content.get('iab_tier1', 'N/A')}
Resumen: {content.get('summary', 'Sin resumen')}
Conceptos: {', '.join(content.get('concepts', []))}
Entidades: {entities_str}
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
