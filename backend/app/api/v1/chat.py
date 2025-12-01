"""
Chat/RAG endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import Database, CurrentUser
from app.services.chat import chat_service
from app.services.usage_tracker import usage_tracker

router = APIRouter()


class ChatSessionCreate(BaseModel):
    title: Optional[str] = None


class ChatSessionResponse(BaseModel):
    id: str
    title: Optional[str] = None
    message_count: int = 0
    last_message_at: Optional[str] = None
    created_at: str


class ChatMessageCreate(BaseModel):
    content: str
    settings: Optional[dict] = None


class ChatSource(BaseModel):
    content_id: str
    title: str
    relevance_score: float
    snippet: Optional[str] = None


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    sources: Optional[List[ChatSource]] = None
    tokens_used: Optional[int] = None
    created_at: str


@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_sessions(current_user: CurrentUser, db: Database):
    """
    List user's chat sessions.
    """
    try:
        response = db.table("chat_sessions").select("*").eq("user_id", current_user["id"]).order("updated_at", desc=True).execute()

        sessions = []
        for session in response.data:
            # Get message count
            messages = db.table("chat_messages").select("id", count="exact").eq("session_id", session["id"]).execute()

            sessions.append({
                **session,
                "message_count": messages.count or 0
            })

        return sessions

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: ChatSessionCreate,
    current_user: CurrentUser,
    db: Database
):
    """
    Create a new chat session.
    """
    try:
        session_data = {
            "user_id": current_user["id"],
            "title": data.title or "New conversation"
        }

        response = db.table("chat_sessions").insert(session_data).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create session"
            )

        return {
            **response.data[0],
            "message_count": 0
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_session(session_id: str, current_user: CurrentUser, db: Database):
    """
    Get a specific chat session.
    """
    try:
        response = db.table("chat_sessions").select("*").eq("id", session_id).eq("user_id", current_user["id"]).single().execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Get message count
        messages = db.table("chat_messages").select("id", count="exact").eq("session_id", session_id).execute()

        return {
            **response.data,
            "message_count": messages.count or 0
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user: CurrentUser, db: Database):
    """
    Delete a chat session.
    """
    try:
        # Check ownership
        existing = db.table("chat_sessions").select("id").eq("id", session_id).eq("user_id", current_user["id"]).execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Messages will be deleted automatically via CASCADE
        db.table("chat_sessions").delete().eq("id", session_id).execute()

        return {"message": "Session deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def list_messages(session_id: str, current_user: CurrentUser, db: Database):
    """
    Get messages from a chat session.
    """
    try:
        # Verify session ownership
        session = db.table("chat_sessions").select("id").eq("id", session_id).eq("user_id", current_user["id"]).execute()

        if not session.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        response = db.table("chat_messages").select("*").eq("session_id", session_id).order("created_at").execute()

        return response.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/sessions/{session_id}/messages", response_model=ChatMessageResponse)
async def send_message(
    session_id: str,
    data: ChatMessageCreate,
    current_user: CurrentUser,
    db: Database
):
    """
    Send a message and get RAG response.
    """
    try:
        # Verify session ownership
        session = db.table("chat_sessions").select("id, title").eq("id", session_id).eq("user_id", current_user["id"]).execute()

        if not session.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Save user message
        user_message = {
            "session_id": session_id,
            "role": "user",
            "content": data.content
        }

        db.table("chat_messages").insert(user_message).execute()

        # Get conversation history
        history_response = db.table("chat_messages").select("role, content").eq("session_id", session_id).order("created_at").limit(20).execute()

        conversation_history = history_response.data or []

        # Set up usage tracker with database
        usage_tracker.set_db(db)

        # Call RAG chat service
        chat_response = await chat_service.chat(
            query=data.content,
            user_id=current_user["id"],
            db=db,
            conversation_history=conversation_history[:-1],  # Exclude current message
            max_sources=5
        )

        # Format sources for storage
        sources_data = [
            {
                "content_id": s.id,
                "title": s.title,
                "relevance_score": s.relevance
            }
            for s in chat_response.sources
        ]

        # Save assistant response
        assistant_response = {
            "session_id": session_id,
            "role": "assistant",
            "content": chat_response.message,
            "sources": sources_data
        }

        response = db.table("chat_messages").insert(assistant_response).execute()

        # Update session title if it's the first message
        if session.data[0].get("title") == "New conversation":
            new_title = await chat_service.generate_session_title(data.content)
            db.table("chat_sessions").update({"title": new_title, "updated_at": "now()"}).eq("id", session_id).execute()
        else:
            # Just update timestamp
            db.table("chat_sessions").update({"updated_at": "now()"}).eq("id", session_id).execute()

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
