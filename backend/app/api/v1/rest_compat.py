"""
PostgREST-compatible generic REST endpoint.
Handles supabase.from('table').select().eq().execute() style queries
from the frontend compatibility wrapper.
"""
from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db

router = APIRouter()


@router.api_route("/{table}", methods=["GET", "POST", "PATCH", "DELETE"])
async def generic_table_query(
    table: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Generic PostgREST-compatible endpoint for legacy supabase.from() calls."""

    # Whitelist tables to prevent SQL injection
    ALLOWED_TABLES = {
        "contents", "folders", "projects", "objectives", "mental_models",
        "areas_of_responsibility", "sub_areas", "habits", "habit_logs",
        "daily_journal", "chat_sessions", "chat_messages", "taxonomy_tags",
        "standalone_notes", "system_notes", "inspirational_content",
        "processing_queue", "api_usage", "user_api_keys", "user_experts",
        "user_preferences", "saved_searches", "area_actions", "area_notes",
        "area_mental_models", "objective_actions", "objective_notes",
        "objective_contents", "objective_mental_models", "objective_projects",
        "project_actions", "project_mental_models", "mental_model_actions",
        "mental_model_notes", "content_mental_models",
    }

    if table not in ALLOWED_TABLES:
        raise HTTPException(status_code=404, detail=f"Table '{table}' not found")

    method = request.method
    params = dict(request.query_params)

    if method == "GET":
        # Build SELECT query
        select_cols = params.pop("select", "*")
        order = params.pop("order", None)
        limit = params.pop("limit", None)
        offset = params.pop("offset", None)

        # Build WHERE clauses from remaining params
        where_clauses = []
        bind_params = {}
        param_idx = 0

        for key, value in params.items():
            if key.startswith("or="):
                continue  # Skip complex OR filters for now

            if "=" not in value:
                continue

            op, val = value.split(".", 1) if "." in value else ("eq", value)

            if op == "eq":
                where_clauses.append(f'"{key}" = :p{param_idx}')
                bind_params[f"p{param_idx}"] = val
            elif op == "neq":
                where_clauses.append(f'"{key}" != :p{param_idx}')
                bind_params[f"p{param_idx}"] = val
            elif op == "gt":
                where_clauses.append(f'"{key}" > :p{param_idx}')
                bind_params[f"p{param_idx}"] = val
            elif op == "gte":
                where_clauses.append(f'"{key}" >= :p{param_idx}')
                bind_params[f"p{param_idx}"] = val
            elif op == "lt":
                where_clauses.append(f'"{key}" < :p{param_idx}')
                bind_params[f"p{param_idx}"] = val
            elif op == "lte":
                where_clauses.append(f'"{key}" <= :p{param_idx}')
                bind_params[f"p{param_idx}"] = val
            elif op == "is":
                if val.lower() == "null":
                    where_clauses.append(f'"{key}" IS NULL')
                elif val.lower() == "true":
                    where_clauses.append(f'"{key}" = true')
                elif val.lower() == "false":
                    where_clauses.append(f'"{key}" = false')
            elif op == "in":
                vals = val.strip("()").split(",")
                placeholders = ", ".join(f":p{param_idx}_{i}" for i in range(len(vals)))
                where_clauses.append(f'"{key}" IN ({placeholders})')
                for i, v in enumerate(vals):
                    bind_params[f"p{param_idx}_{i}"] = v.strip()
            elif op == "ilike":
                where_clauses.append(f'"{key}" ILIKE :p{param_idx}')
                bind_params[f"p{param_idx}"] = val
            elif op == "fts":
                where_clauses.append(f'"{key}"::text ILIKE :p{param_idx}')
                bind_params[f"p{param_idx}"] = f"%{val}%"

            param_idx += 1

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        order_sql = ""
        if order:
            parts = order.split(".")
            col = parts[0]
            direction = parts[1] if len(parts) > 1 else "asc"
            order_sql = f' ORDER BY "{col}" {direction}'

        limit_sql = f" LIMIT {int(limit)}" if limit else ""
        offset_sql = f" OFFSET {int(offset)}" if offset else ""

        sql = f'SELECT * FROM "{table}" WHERE {where_sql}{order_sql}{limit_sql}{offset_sql}'

        result = await db.execute(text(sql), bind_params)
        rows = [dict(row._mapping) for row in result.fetchall()]

        # Convert non-serializable types
        import json
        from datetime import datetime as dt
        from uuid import UUID

        def serialize(obj):
            if isinstance(obj, (dt,)):
                return obj.isoformat()
            if isinstance(obj, UUID):
                return str(obj)
            if isinstance(obj, bytes):
                return None
            return obj

        serialized = []
        for row in rows:
            serialized.append({k: serialize(v) for k, v in row.items()})

        return serialized

    elif method == "POST":
        body = await request.json()
        if isinstance(body, list):
            for item in body:
                cols = ", ".join(f'"{k}"' for k in item.keys())
                vals = ", ".join(f":{k}" for k in item.keys())
                sql = f'INSERT INTO "{table}" ({cols}) VALUES ({vals}) RETURNING *'
                await db.execute(text(sql), item)
            await db.commit()
            return body
        else:
            cols = ", ".join(f'"{k}"' for k in body.keys())
            vals = ", ".join(f":{k}" for k in body.keys())
            sql = f'INSERT INTO "{table}" ({cols}) VALUES ({vals}) RETURNING *'
            result = await db.execute(text(sql), body)
            await db.commit()
            row = result.fetchone()
            return dict(row._mapping) if row else body

    elif method == "PATCH":
        body = await request.json()
        set_clauses = ", ".join(f'"{k}" = :set_{k}' for k in body.keys())
        bind = {f"set_{k}": v for k, v in body.items()}

        where_clauses = []
        for key, value in params.items():
            if "=" in value:
                op, val = value.split(".", 1)
                if op == "eq":
                    where_clauses.append(f'"{key}" = :w_{key}')
                    bind[f"w_{key}"] = val

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        sql = f'UPDATE "{table}" SET {set_clauses} WHERE {where_sql} RETURNING *'
        result = await db.execute(text(sql), bind)
        await db.commit()
        rows = [dict(r._mapping) for r in result.fetchall()]
        return rows

    elif method == "DELETE":
        where_clauses = []
        bind = {}
        for key, value in params.items():
            if "=" in value:
                op, val = value.split(".", 1)
                if op == "eq":
                    where_clauses.append(f'"{key}" = :w_{key}')
                    bind[f"w_{key}"] = val

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=0"
        sql = f'DELETE FROM "{table}" WHERE {where_sql}'
        await db.execute(text(sql), bind)
        await db.commit()
        return {"status": "deleted"}


@router.post("/rpc/{function_name}")
async def generic_rpc(
    function_name: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Generic RPC endpoint for supabase.rpc() calls."""
    body = await request.json()

    if function_name == "match_contents":
        # Semantic search
        query_embedding = body.get("query_embedding", [])
        match_threshold = body.get("match_threshold", 0.5)
        match_count = body.get("match_count", 10)

        sql = text("""
            SELECT id, title, url, summary, source,
                   1 - (embedding <=> :embedding::vector) as similarity
            FROM contents
            WHERE embedding IS NOT NULL
              AND 1 - (embedding <=> :embedding::vector) > :threshold
            ORDER BY embedding <=> :embedding::vector
            LIMIT :count
        """)
        result = await db.execute(sql, {
            "embedding": str(query_embedding),
            "threshold": match_threshold,
            "count": match_count,
        })
        rows = [dict(r._mapping) for r in result.fetchall()]
        return rows

    elif function_name == "search_contents_semantic":
        return []  # Stub

    else:
        raise HTTPException(status_code=404, detail=f"RPC '{function_name}' not found")
