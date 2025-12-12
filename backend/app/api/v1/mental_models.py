"""
Mental Models API endpoints.
Manages mental models and their association with content.
"""
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.api.deps import Database, CurrentUser

router = APIRouter()


# Predefined mental models catalog
PREDEFINED_MODELS = [
    {
        "slug": "first-principles",
        "name": "First Principles",
        "description": "Descomponer problemas en sus componentes fundamentales",
        "icon": "🔬"
    },
    {
        "slug": "inversion",
        "name": "Inversion",
        "description": "Pensar al reves - que evitar para lograr el objetivo",
        "icon": "🔄"
    },
    {
        "slug": "second-order-thinking",
        "name": "Second-Order Thinking",
        "description": "Considerar las consecuencias de las consecuencias",
        "icon": "🎯"
    },
    {
        "slug": "circle-of-competence",
        "name": "Circle of Competence",
        "description": "Conocer los limites de tu conocimiento",
        "icon": "⭕"
    },
    {
        "slug": "occams-razor",
        "name": "Occam's Razor",
        "description": "La explicacion mas simple suele ser la correcta",
        "icon": "✂️"
    },
    {
        "slug": "hanlons-razor",
        "name": "Hanlon's Razor",
        "description": "No atribuir a malicia lo que puede explicarse por incompetencia",
        "icon": "🤷"
    },
    {
        "slug": "pareto-principle",
        "name": "Pareto Principle",
        "description": "El 80% de resultados viene del 20% de esfuerzos",
        "icon": "📊"
    },
    {
        "slug": "compounding",
        "name": "Compounding",
        "description": "Pequenas ganancias acumuladas generan grandes resultados",
        "icon": "📈"
    },
    {
        "slug": "opportunity-cost",
        "name": "Opportunity Cost",
        "description": "El coste de lo que renuncias al elegir algo",
        "icon": "⚖️"
    },
    {
        "slug": "survivorship-bias",
        "name": "Survivorship Bias",
        "description": "Solo vemos los que sobrevivieron, no los que fallaron",
        "icon": "👻"
    },
    {
        "slug": "confirmation-bias",
        "name": "Confirmation Bias",
        "description": "Tendemos a buscar informacion que confirma lo que ya creemos",
        "icon": "🔍"
    },
    {
        "slug": "mental-accounting",
        "name": "Mental Accounting",
        "description": "Tratamos el dinero diferente segun su origen o destino",
        "icon": "💰"
    },
    {
        "slug": "sunk-cost-fallacy",
        "name": "Sunk Cost Fallacy",
        "description": "Seguir invirtiendo en algo solo porque ya invertimos mucho",
        "icon": "🕳️"
    },
    {
        "slug": "map-territory",
        "name": "Map is Not the Territory",
        "description": "El modelo no es la realidad, siempre hay simplificaciones",
        "icon": "🗺️"
    },
    {
        "slug": "thought-experiment",
        "name": "Thought Experiment",
        "description": "Explorar ideas a traves de escenarios hipoteticos",
        "icon": "💭"
    },
]


class MentalModelCreate(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    notes: Optional[str] = ""
    color: Optional[str] = "#8b5cf6"
    icon: Optional[str] = "🧠"


class MentalModelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class MentalModelResponse(BaseModel):
    id: str
    slug: str
    name: str
    description: Optional[str]
    notes: str
    is_active: bool
    color: str
    icon: str
    content_count: int
    last_used_at: Optional[str]
    created_at: str
    updated_at: str


class ContentMentalModelCreate(BaseModel):
    content_id: str
    mental_model_id: str
    application_notes: Optional[str] = None


class ActionCreate(BaseModel):
    title: str


class ActionUpdate(BaseModel):
    title: Optional[str] = None
    is_completed: Optional[bool] = None


@router.get("/catalog")
async def get_models_catalog():
    """Get the catalog of predefined mental models."""
    return {"models": PREDEFINED_MODELS}


@router.get("/")
async def list_mental_models(
    current_user: CurrentUser,
    db: Database,
    include_inactive: bool = False,
):
    """List all mental models for the current user."""
    query = db.table("mental_models").select("*").eq("user_id", current_user["id"])

    if not include_inactive:
        query = query.eq("is_active", True)

    result = query.order("name").execute()

    return {
        "models": result.data or [],
        "total": len(result.data or [])
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_mental_model(
    data: MentalModelCreate,
    current_user: CurrentUser,
    db: Database,
):
    """Create or activate a mental model."""
    # Check if model already exists for user
    existing = db.table("mental_models").select("*").eq(
        "user_id", current_user["id"]
    ).eq("slug", data.slug).execute()

    if existing.data:
        # Reactivate if inactive
        model = existing.data[0]
        if not model["is_active"]:
            result = db.table("mental_models").update({
                "is_active": True
            }).eq("id", model["id"]).execute()
            return result.data[0]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este modelo mental ya existe"
        )

    # Create new model
    result = db.table("mental_models").insert({
        "user_id": current_user["id"],
        "slug": data.slug,
        "name": data.name,
        "description": data.description,
        "notes": data.notes or "",
        "color": data.color or "#8b5cf6",
        "icon": data.icon or "🧠",
        "is_active": True,
        "content_count": 0,
    }).execute()

    return result.data[0]


@router.get("/{model_id}")
async def get_mental_model(
    model_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Get a specific mental model with all related data."""
    # Get the model with actions
    model_result = db.table("mental_models").select(
        "*, mental_model_actions(id, title, is_completed, position, created_at)"
    ).eq("id", model_id).eq("user_id", current_user["id"]).execute()

    if not model_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modelo mental no encontrado"
        )

    model = dict(model_result.data[0])

    # Get associated contents
    associations = db.table("content_mental_models").select(
        "content_id, application_notes, created_at"
    ).eq("mental_model_id", model_id).execute()

    content_ids = [a["content_id"] for a in (associations.data or [])]

    contents = []
    if content_ids:
        contents_result = db.table("contents").select(
            "id, title, url, type, summary, iab_tier1, created_at, is_favorite"
        ).in_("id", content_ids).execute()
        contents = contents_result.data or []

        # Add application_notes to each content
        notes_map = {a["content_id"]: a["application_notes"] for a in associations.data}
        for content in contents:
            content["application_notes"] = notes_map.get(content["id"])

    model["contents"] = contents
    model["content_count"] = len(contents)

    # Get linked notes
    try:
        notes_result = db.table("mental_model_notes").select(
            "note_id, standalone_notes(id, title, content, note_type, tags, is_pinned, created_at)"
        ).eq("mental_model_id", model_id).execute()
        model["notes"] = [r["standalone_notes"] for r in notes_result.data if r.get("standalone_notes")]
    except Exception as e:
        print(f"Error fetching notes for mental model: {e}")
        model["notes"] = []

    # Get linked projects (via project_mental_models)
    try:
        projects_result = db.table("project_mental_models").select(
            "project_id, projects(id, name, description, status, icon, color)"
        ).eq("mental_model_id", model_id).execute()
        model["projects"] = [r["projects"] for r in projects_result.data if r.get("projects")]
    except Exception as e:
        print(f"Error fetching projects for mental model: {e}")
        model["projects"] = []

    # Get linked objectives (via objective_mental_models)
    try:
        objectives_result = db.table("objective_mental_models").select(
            "objective_id, objectives(id, title, status, progress, icon, color, horizon)"
        ).eq("mental_model_id", model_id).execute()
        model["objectives"] = [r["objectives"] for r in objectives_result.data if r.get("objectives")]
    except Exception as e:
        print(f"Error fetching objectives for mental model: {e}")
        model["objectives"] = []

    # Get linked areas (via area_mental_models)
    try:
        areas_result = db.table("area_mental_models").select(
            "area_id, areas_of_responsibility(id, name, icon, color)"
        ).eq("mental_model_id", model_id).execute()
        model["areas"] = [r["areas_of_responsibility"] for r in areas_result.data if r.get("areas_of_responsibility")]
    except Exception as e:
        print(f"Error fetching areas for mental model: {e}")
        model["areas"] = []

    return model


@router.put("/{model_id}")
async def update_mental_model(
    model_id: str,
    data: MentalModelUpdate,
    current_user: CurrentUser,
    db: Database,
):
    """Update a mental model."""
    # Check ownership
    existing = db.table("mental_models").select("id").eq(
        "id", model_id
    ).eq("user_id", current_user["id"]).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modelo mental no encontrado"
        )

    # Build update data
    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.notes is not None:
        update_data["notes"] = data.notes
    if data.color is not None:
        update_data["color"] = data.color
    if data.icon is not None:
        update_data["icon"] = data.icon
    if data.is_active is not None:
        update_data["is_active"] = data.is_active

    if not update_data:
        return existing.data[0]

    result = db.table("mental_models").update(update_data).eq("id", model_id).execute()
    return result.data[0]


@router.post("/{model_id}/favorite")
async def toggle_mental_model_favorite(
    model_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Toggle favorite status for a mental model."""
    existing = db.table("mental_models").select("id, is_favorite").eq(
        "id", model_id
    ).eq("user_id", current_user["id"]).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modelo mental no encontrado"
        )

    current_favorite = existing.data[0].get("is_favorite", False)
    new_favorite = not current_favorite

    db.table("mental_models").update({"is_favorite": new_favorite}).eq("id", model_id).execute()

    return {"success": True, "is_favorite": new_favorite}


@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mental_model(
    model_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Delete (or deactivate) a mental model."""
    # Check ownership
    existing = db.table("mental_models").select("id").eq(
        "id", model_id
    ).eq("user_id", current_user["id"]).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modelo mental no encontrado"
        )

    # Soft delete - just deactivate
    db.table("mental_models").update({"is_active": False}).eq("id", model_id).execute()


# ===== Content associations =====

@router.post("/contents/", status_code=status.HTTP_201_CREATED)
async def assign_model_to_content(
    data: ContentMentalModelCreate,
    current_user: CurrentUser,
    db: Database,
):
    """Assign a mental model to a content."""
    # Verify content ownership
    content = db.table("contents").select("id").eq(
        "id", data.content_id
    ).eq("user_id", current_user["id"]).execute()

    if not content.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contenido no encontrado"
        )

    # Verify model ownership
    model = db.table("mental_models").select("id").eq(
        "id", data.mental_model_id
    ).eq("user_id", current_user["id"]).execute()

    if not model.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modelo mental no encontrado"
        )

    # Check if already assigned
    existing = db.table("content_mental_models").select("id").eq(
        "content_id", data.content_id
    ).eq("mental_model_id", data.mental_model_id).execute()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este contenido ya tiene este modelo mental asignado"
        )

    # Create association
    result = db.table("content_mental_models").insert({
        "content_id": data.content_id,
        "mental_model_id": data.mental_model_id,
        "user_id": current_user["id"],
        "application_notes": data.application_notes,
    }).execute()

    return result.data[0]


@router.delete("/contents/{content_id}/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_model_from_content(
    content_id: str,
    model_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Remove a mental model assignment from a content."""
    # Check ownership via user_id on association
    existing = db.table("content_mental_models").select("id").eq(
        "content_id", content_id
    ).eq("mental_model_id", model_id).eq("user_id", current_user["id"]).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignacion no encontrada"
        )

    db.table("content_mental_models").delete().eq("id", existing.data[0]["id"]).execute()


@router.get("/contents/{content_id}")
async def get_models_for_content(
    content_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Get all mental models assigned to a content."""
    # Verify content ownership
    content = db.table("contents").select("id").eq(
        "id", content_id
    ).eq("user_id", current_user["id"]).execute()

    if not content.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contenido no encontrado"
        )

    # Get associations
    associations = db.table("content_mental_models").select(
        "mental_model_id, application_notes, created_at"
    ).eq("content_id", content_id).execute()

    if not associations.data:
        return {"models": []}

    model_ids = [a["mental_model_id"] for a in associations.data]

    # Get model details
    models = db.table("mental_models").select(
        "id, slug, name, description, color, icon"
    ).in_("id", model_ids).execute()

    # Add application_notes to each model
    notes_map = {a["mental_model_id"]: a["application_notes"] for a in associations.data}
    for model in (models.data or []):
        model["application_notes"] = notes_map.get(model["id"])

    return {"models": models.data or []}


# =====================================================
# Actions CRUD
# =====================================================

@router.post("/{model_id}/actions")
async def create_action(
    model_id: str,
    data: ActionCreate,
    current_user: CurrentUser,
    db: Database,
):
    """Add an action to a mental model."""
    user_id = current_user["id"]

    # Verify model exists and belongs to user
    model_check = db.table("mental_models").select("id").eq(
        "id", model_id
    ).eq("user_id", user_id).execute()

    if not model_check.data:
        raise HTTPException(status_code=404, detail="Mental model not found")

    # Get next position
    pos_result = db.table("mental_model_actions").select("position").eq(
        "mental_model_id", model_id
    ).order("position", desc=True).limit(1).execute()

    next_pos = (pos_result.data[0]["position"] + 1) if pos_result.data else 0

    result = db.table("mental_model_actions").insert({
        "mental_model_id": model_id,
        "user_id": user_id,
        "title": data.title,
        "position": next_pos,
    }).execute()

    return result.data[0]


@router.put("/{model_id}/actions/{action_id}")
async def update_action(
    model_id: str,
    action_id: str,
    data: ActionUpdate,
    current_user: CurrentUser,
    db: Database,
):
    """Update an action."""
    user_id = current_user["id"]
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    if "is_completed" in update_data and update_data["is_completed"]:
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    result = db.table("mental_model_actions").update(update_data).eq(
        "id", action_id
    ).eq("mental_model_id", model_id).eq("user_id", user_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Action not found")

    return result.data[0]


@router.delete("/{model_id}/actions/{action_id}")
async def delete_action(
    model_id: str,
    action_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Delete an action."""
    user_id = current_user["id"]

    result = db.table("mental_model_actions").delete().eq(
        "id", action_id
    ).eq("mental_model_id", model_id).eq("user_id", user_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Action not found")

    return {"success": True}


# =====================================================
# Notes Linking
# =====================================================

@router.post("/{model_id}/link-notes")
async def link_notes_to_mental_model(
    model_id: str,
    note_ids: List[str],
    current_user: CurrentUser,
    db: Database,
):
    """Link multiple notes to a mental model."""
    user_id = current_user["id"]

    # Verify model belongs to user
    model_check = db.table("mental_models").select("id").eq(
        "id", model_id
    ).eq("user_id", user_id).execute()

    if not model_check.data:
        raise HTTPException(status_code=404, detail="Mental model not found")

    linked = 0
    for note_id in note_ids:
        try:
            db.table("mental_model_notes").insert({
                "mental_model_id": model_id,
                "note_id": note_id,
                "user_id": user_id,
            }).execute()
            linked += 1
        except Exception as e:
            if "duplicate" not in str(e).lower():
                print(f"Error linking note {note_id}: {e}")

    return {"success": True, "linked": linked}


@router.delete("/{model_id}/unlink-note/{note_id}")
async def unlink_note_from_mental_model(
    model_id: str,
    note_id: str,
    current_user: CurrentUser,
    db: Database,
):
    """Unlink a note from a mental model."""
    user_id = current_user["id"]

    db.table("mental_model_notes").delete().eq(
        "mental_model_id", model_id
    ).eq("note_id", note_id).eq("user_id", user_id).execute()

    return {"success": True}
