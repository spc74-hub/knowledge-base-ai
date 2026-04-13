"""
Supabase-compatible query builder on top of SQLAlchemy async sessions.

This module provides a thin compatibility layer that mimics the Supabase Python
client's fluent query API (db.table("x").select(...).eq(...).execute()) but
routes everything through SQLAlchemy + asyncpg.

The goal is to minimise changes in the ~30 endpoint files while still running
against a self-hosted PostgreSQL instance.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text, select, insert, update, delete, func, and_, or_, not_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY

# ---------------------------------------------------------------------------
# Table registry – maps table name strings to SQLAlchemy model classes
# ---------------------------------------------------------------------------
_TABLE_MAP: Dict[str, Any] = {}


def _ensure_registry():
    """Lazily populate _TABLE_MAP from the models package."""
    if _TABLE_MAP:
        return
    from app.models import (
        Content, ChatSession, ChatMessage, Folder,
        Project, ProjectAction, ProjectMentalModel, ObjectiveProject,
        Objective, ObjectiveAction, ObjectiveContent, ObjectiveMentalModel, ObjectiveNote,
        MentalModel, ContentMentalModel, MentalModelAction, MentalModelNote,
        TaxonomyTag, SystemNote, StandaloneNote,
        AreaOfResponsibility, SubArea, AreaMentalModel, AreaAction, AreaNote,
        Habit, HabitLog,
        DailyJournal, InspirationalContent,
        ApiUsage, UserApiKey, UserExpert, User,
    )
    mapping = {
        "users": User,
        "contents": Content,
        "chat_sessions": ChatSession,
        "chat_messages": ChatMessage,
        "folders": Folder,
        "projects": Project,
        "project_actions": ProjectAction,
        "project_mental_models": ProjectMentalModel,
        "objective_projects": ObjectiveProject,
        "objectives": Objective,
        "objective_actions": ObjectiveAction,
        "objective_contents": ObjectiveContent,
        "objective_mental_models": ObjectiveMentalModel,
        "objective_notes": ObjectiveNote,
        "mental_models": MentalModel,
        "content_mental_models": ContentMentalModel,
        "mental_model_actions": MentalModelAction,
        "mental_model_notes": MentalModelNote,
        "taxonomy_tags": TaxonomyTag,
        "system_notes": SystemNote,
        "standalone_notes": StandaloneNote,
        "areas_of_responsibility": AreaOfResponsibility,
        "sub_areas": SubArea,
        "area_mental_models": AreaMentalModel,
        "area_actions": AreaAction,
        "area_notes": AreaNote,
        "habits": Habit,
        "habit_logs": HabitLog,
        "daily_journal": DailyJournal,
        "inspirational_content": InspirationalContent,
        "api_usage": ApiUsage,
        "user_api_keys": UserApiKey,
        "user_experts": UserExpert,
    }
    _TABLE_MAP.update(mapping)


# ---------------------------------------------------------------------------
# Result wrapper – mimics postgrest-py response objects
# ---------------------------------------------------------------------------
class QueryResult:
    """Mimics the Supabase execute() response."""
    def __init__(self, data: List[dict] | None = None, count: int | None = None):
        self.data = data or []
        self.count = count


# ---------------------------------------------------------------------------
# QueryBuilder – fluent interface
# ---------------------------------------------------------------------------
class QueryBuilder:
    """
    Supabase-style fluent query builder backed by SQLAlchemy.
    Supports: select, insert, update, delete, eq, neq, gt, gte, lt, lte,
              in_, is_, contains, ilike, or_, order, limit, range, single,
              filter, not_, count="exact".
    """

    def __init__(self, session: AsyncSession, table_name: str):
        _ensure_registry()
        self._session = session
        self._table_name = table_name
        self._model = _TABLE_MAP.get(table_name)
        if self._model is None:
            raise ValueError(f"Unknown table: {table_name}")

        # Operation
        self._op: str = "select"  # select | insert | update | delete
        self._select_columns: str = "*"
        self._insert_data: dict | None = None
        self._update_data: dict | None = None
        self._count_mode: str | None = None  # "exact" if counting

        # Filters
        self._filters: list = []
        self._or_filters: list = []
        self._order_clauses: list = []
        self._limit_val: int | None = None
        self._offset_val: int | None = None
        self._single: bool = False
        self._range_start: int | None = None
        self._range_end: int | None = None

        # Join tables requested via select("*, child_table(...)")
        self._joins: Dict[str, list] = {}

    # ---- Operation setters ------------------------------------------------

    def select(self, columns: str = "*", count: str | None = None) -> "QueryBuilder":
        self._op = "select"
        self._select_columns = columns
        self._count_mode = count
        # Parse join syntax: "*, child_table(col1, col2, ...)"
        self._parse_joins(columns)
        return self

    def insert(self, data: dict) -> "QueryBuilder":
        self._op = "insert"
        self._insert_data = data
        return self

    def update(self, data: dict) -> "QueryBuilder":
        self._op = "update"
        self._update_data = data
        return self

    def delete(self) -> "QueryBuilder":
        self._op = "delete"
        return self

    # ---- Filter methods ---------------------------------------------------

    def eq(self, column: str, value: Any) -> "QueryBuilder":
        self._filters.append(("eq", column, value))
        return self

    def neq(self, column: str, value: Any) -> "QueryBuilder":
        self._filters.append(("neq", column, value))
        return self

    def gt(self, column: str, value: Any) -> "QueryBuilder":
        self._filters.append(("gt", column, value))
        return self

    def gte(self, column: str, value: Any) -> "QueryBuilder":
        self._filters.append(("gte", column, value))
        return self

    def lt(self, column: str, value: Any) -> "QueryBuilder":
        self._filters.append(("lt", column, value))
        return self

    def lte(self, column: str, value: Any) -> "QueryBuilder":
        self._filters.append(("lte", column, value))
        return self

    def in_(self, column: str, values: list) -> "QueryBuilder":
        self._filters.append(("in_", column, values))
        return self

    def is_(self, column: str, value: Any) -> "QueryBuilder":
        self._filters.append(("is_", column, value))
        return self

    def not_(self) -> "QueryBuilder":
        """Placeholder for .not_.is_() chaining. Returns self for fluent API."""
        # This is a simplification - the next filter will be negated
        self._filters.append(("not_next", None, None))
        return self

    def contains(self, column: str, value: Any) -> "QueryBuilder":
        self._filters.append(("contains", column, value))
        return self

    def ilike(self, column: str, pattern: str) -> "QueryBuilder":
        self._filters.append(("ilike", column, pattern))
        return self

    def or_(self, expr: str) -> "QueryBuilder":
        """Parse Supabase-style or_ expressions like 'title.ilike.%q%,summary.ilike.%q%'"""
        self._or_filters.append(expr)
        return self

    def filter(self, column: str, operator: str, value: Any) -> "QueryBuilder":
        """Generic filter: filter("metadata->>source", "eq", "apple_notes")"""
        self._filters.append(("filter", column, (operator, value)))
        return self

    # ---- Ordering, pagination, etc. ---------------------------------------

    def order(self, column: str, desc: bool = False) -> "QueryBuilder":
        self._order_clauses.append((column, desc))
        return self

    def limit(self, n: int) -> "QueryBuilder":
        self._limit_val = n
        return self

    def range(self, start: int, end: int) -> "QueryBuilder":
        self._range_start = start
        self._range_end = end
        return self

    def single(self) -> "QueryBuilder":
        self._single = True
        return self

    # ---- Parse joins from select string -----------------------------------

    def _parse_joins(self, columns: str):
        """Parse 'table(col1, col2)' patterns from select columns."""
        import re
        # Find patterns like: child_table(col1, col2, col3)
        pattern = r'(\w+)\(([^)]+)\)'
        for match in re.finditer(pattern, columns):
            join_table = match.group(1)
            join_cols = [c.strip() for c in match.group(2).split(',')]
            self._joins[join_table] = join_cols

    # ---- Column resolution ------------------------------------------------

    def _get_column(self, col_name: str):
        """Get SQLAlchemy column from model by name, handling JSON paths."""
        # Handle jsonb path operators like "metadata->>source"
        if "->>" in col_name:
            parts = col_name.split("->>")
            base_col = self._resolve_column(parts[0].strip())
            if base_col is not None:
                return base_col[parts[1].strip()].astext
            return None
        if "->" in col_name:
            parts = col_name.split("->")
            base_col = self._resolve_column(parts[0].strip())
            if base_col is not None:
                return base_col[parts[1].strip()]
            return None
        return self._resolve_column(col_name)

    def _resolve_column(self, col_name: str):
        """Resolve a column name to a SQLAlchemy column attribute."""
        from sqlalchemy import inspect as sa_inspect
        # Use mapper to find the correct Python attribute for a DB column name
        mapper = sa_inspect(self._model)
        for prop in mapper.column_attrs:
            if prop.columns[0].name == col_name or prop.key == col_name:
                return getattr(self._model, prop.key, None)
        return None

    def _build_where(self):
        """Build WHERE clause from accumulated filters."""
        conditions = []
        negate_next = False

        for f in self._filters:
            op, col_name, value = f

            if op == "not_next":
                negate_next = True
                continue

            col = self._get_column(col_name) if col_name else None

            if col is None and op != "filter":
                negate_next = False
                continue

            cond = None
            if op == "eq":
                cond = col == value
            elif op == "neq":
                cond = col != value
            elif op == "gt":
                cond = col > value
            elif op == "gte":
                cond = col >= value
            elif op == "lt":
                cond = col < value
            elif op == "lte":
                cond = col <= value
            elif op == "in_":
                cond = col.in_(value)
            elif op == "is_":
                if value == "null" or value is None:
                    cond = col.is_(None)
                else:
                    cond = col == value
            elif op == "contains":
                # For ARRAY columns: @> operator
                # For JSONB columns: @> operator
                if isinstance(value, list):
                    cond = col.contains(value)
                elif isinstance(value, dict):
                    cond = col.contains(value)
                else:
                    cond = col.contains(value)
            elif op == "ilike":
                cond = col.ilike(value)
            elif op == "filter":
                # Generic filter with operator
                filter_op, filter_val = value
                filter_col = self._get_column(col_name)
                if filter_col is not None:
                    if filter_op == "eq":
                        cond = filter_col == filter_val
                    elif filter_op == "neq":
                        cond = filter_col != filter_val
                    elif filter_op == "cs":
                        cond = filter_col.contains(filter_val)

            if cond is not None:
                if negate_next:
                    cond = not_(cond)
                    negate_next = False
                conditions.append(cond)
            else:
                negate_next = False

        # Handle or_ expressions
        for or_expr in self._or_filters:
            or_conds = self._parse_or_expression(or_expr)
            if or_conds:
                conditions.append(or_(*or_conds))

        return and_(*conditions) if conditions else None

    def _parse_or_expression(self, expr: str) -> list:
        """Parse 'title.ilike.%q%,summary.ilike.%q%' into SQLAlchemy conditions."""
        parts = expr.split(",")
        conditions = []
        for part in parts:
            segments = part.strip().split(".", 2)
            if len(segments) >= 3:
                col_name = segments[0]
                operator = segments[1]
                value = segments[2]
                col = self._get_column(col_name)
                if col is not None:
                    if operator == "ilike":
                        conditions.append(col.ilike(value))
                    elif operator == "eq":
                        conditions.append(col == value)
                    elif operator == "neq":
                        conditions.append(col != value)
        return conditions

    # ---- Row serialisation ------------------------------------------------

    def _row_to_dict(self, row) -> dict:
        """Convert a SQLAlchemy model instance to dict."""
        from sqlalchemy import inspect as sa_inspect
        # Build a map from DB column name to Python attribute name
        mapper = sa_inspect(type(row))
        col_to_attr = {}
        for prop in mapper.column_attrs:
            col = prop.columns[0]
            col_to_attr[col.name] = prop.key

        d = {}
        for c in row.__table__.columns:
            attr_name = col_to_attr.get(c.name, c.name)
            val = getattr(row, attr_name, None)
            if isinstance(val, uuid.UUID):
                val = str(val)
            elif isinstance(val, datetime):
                val = val.isoformat()
            elif hasattr(val, 'isoformat'):
                val = val.isoformat()
            d[c.name] = val
        return d

    # ---- Execute ----------------------------------------------------------

    async def execute(self) -> QueryResult:
        """Execute the query and return results."""
        if self._op == "select":
            return await self._exec_select()
        elif self._op == "insert":
            return await self._exec_insert()
        elif self._op == "update":
            return await self._exec_update()
        elif self._op == "delete":
            return await self._exec_delete()
        return QueryResult()

    async def _exec_select(self) -> QueryResult:
        model = self._model
        stmt = select(model)

        where = self._build_where()
        if where is not None:
            stmt = stmt.where(where)

        # Count mode
        count_val = None
        if self._count_mode == "exact":
            count_stmt = select(func.count()).select_from(model)
            if where is not None:
                count_stmt = count_stmt.where(where)
            result = await self._session.execute(count_stmt)
            count_val = result.scalar()

            # If only counting (select "id" with count), still get data
            # but the caller mainly cares about .count

        # Ordering
        for col_name, desc in self._order_clauses:
            col = self._get_column(col_name)
            if col is not None:
                stmt = stmt.order_by(col.desc() if desc else col.asc())

        # Pagination
        if self._range_start is not None and self._range_end is not None:
            stmt = stmt.offset(self._range_start).limit(self._range_end - self._range_start + 1)
        elif self._limit_val is not None:
            stmt = stmt.limit(self._limit_val)

        result = await self._session.execute(stmt)
        rows = result.scalars().all()
        data = [self._row_to_dict(r) for r in rows]

        # Handle joins (fetch child table data)
        if self._joins and data:
            data = await self._resolve_joins(data)

        if self._single:
            if not data:
                return QueryResult(data=None, count=count_val)
            return QueryResult(data=data[0], count=count_val)

        return QueryResult(data=data, count=count_val if count_val is not None else len(data))

    async def _resolve_joins(self, data: List[dict]) -> List[dict]:
        """Resolve join tables referenced in select(). Simple FK-based resolution."""
        _ensure_registry()
        for join_table, join_cols in self._joins.items():
            join_model = _TABLE_MAP.get(join_table)
            if join_model is None:
                continue

            # Determine the FK column - convention: parent_table.id = child_table.<parent>_id
            parent_id_col_name = self._table_name.rstrip("s") + "_id"
            # Try alternative names
            fk_col = getattr(join_model, parent_id_col_name, None)
            if fk_col is None:
                # Try with full table name
                fk_col = getattr(join_model, self._table_name + "_id", None)
            if fk_col is None:
                # Try the reverse: child references parent via the parent's primary key name
                for parent_row in data:
                    parent_row[join_table] = []
                continue

            # Collect parent IDs
            parent_ids = [row["id"] for row in data if row.get("id")]
            if not parent_ids:
                continue

            # Query child table
            stmt = select(join_model).where(fk_col.in_(parent_ids))
            result = await self._session.execute(stmt)
            child_rows = result.scalars().all()

            # Group by parent FK
            children_by_parent = {}
            child_col_to_attr = {}
            if child_rows:
                from sqlalchemy import inspect as sa_inspect
                child_mapper = sa_inspect(type(child_rows[0]))
                for prop in child_mapper.column_attrs:
                    child_col_to_attr[prop.columns[0].name] = prop.key
            for child in child_rows:
                child_dict = {}
                for c in child.__table__.columns:
                    attr_name = child_col_to_attr.get(c.name, c.name)
                    val = getattr(child, attr_name, None)
                    if isinstance(val, uuid.UUID):
                        val = str(val)
                    elif isinstance(val, datetime):
                        val = val.isoformat()
                    elif hasattr(val, 'isoformat'):
                        val = val.isoformat()
                    child_dict[c.name] = val
                parent_key = str(getattr(child, parent_id_col_name, ""))
                if parent_key not in children_by_parent:
                    children_by_parent[parent_key] = []
                children_by_parent[parent_key].append(child_dict)

            # Attach to parent rows
            for row in data:
                row[join_table] = children_by_parent.get(row["id"], [])

        return data

    async def _exec_insert(self) -> QueryResult:
        model = self._model
        data = dict(self._insert_data) if self._insert_data else {}

        # Generate id if not provided
        if "id" not in data:
            data["id"] = uuid.uuid4()

        # Set timestamps if not provided
        now = datetime.now(timezone.utc)
        if hasattr(model, "created_at") and "created_at" not in data:
            data["created_at"] = now
        if hasattr(model, "updated_at") and "updated_at" not in data:
            data["updated_at"] = now

        # Filter to only valid columns
        valid_cols = {c.name for c in model.__table__.columns}
        filtered_data = {k: v for k, v in data.items() if k in valid_cols}

        # Convert string UUIDs to uuid objects for UUID columns
        for col in model.__table__.columns:
            col_name = col.name
            if col_name in filtered_data and filtered_data[col_name] is not None:
                from sqlalchemy.dialects.postgresql import UUID as PG_UUID
                if hasattr(col.type, 'impl') or str(col.type) == 'UUID':
                    val = filtered_data[col_name]
                    if isinstance(val, str):
                        try:
                            filtered_data[col_name] = uuid.UUID(val)
                        except (ValueError, AttributeError):
                            pass

        obj = model(**filtered_data)
        self._session.add(obj)
        await self._session.commit()
        await self._session.refresh(obj)

        return QueryResult(data=[self._row_to_dict(obj)])

    async def _exec_update(self) -> QueryResult:
        model = self._model
        update_data = dict(self._update_data) if self._update_data else {}

        # Set updated_at
        if hasattr(model, "updated_at") and "updated_at" not in update_data:
            update_data["updated_at"] = datetime.now(timezone.utc)

        # Handle "now()" string values
        for k, v in list(update_data.items()):
            if v == "now()":
                update_data[k] = datetime.now(timezone.utc)

        # Filter to valid columns
        valid_cols = {c.name for c in model.__table__.columns}
        filtered_data = {k: v for k, v in update_data.items() if k in valid_cols}

        where = self._build_where()

        # First select the rows to return
        stmt_select = select(model)
        if where is not None:
            stmt_select = stmt_select.where(where)
        result = await self._session.execute(stmt_select)
        rows = result.scalars().all()

        if not rows:
            return QueryResult(data=[])

        # Update the rows
        for row in rows:
            for k, v in filtered_data.items():
                setattr(row, k, v)

        await self._session.commit()

        # Refresh and return
        updated = []
        for row in rows:
            await self._session.refresh(row)
            updated.append(self._row_to_dict(row))

        return QueryResult(data=updated)

    async def _exec_delete(self) -> QueryResult:
        model = self._model
        where = self._build_where()

        # First get the rows to return
        stmt_select = select(model)
        if where is not None:
            stmt_select = stmt_select.where(where)
        result = await self._session.execute(stmt_select)
        rows = result.scalars().all()

        data = [self._row_to_dict(r) for r in rows]

        # Delete
        for row in rows:
            await self._session.delete(row)

        await self._session.commit()

        return QueryResult(data=data)


# ---------------------------------------------------------------------------
# RPC handler
# ---------------------------------------------------------------------------
class RPCResult:
    def __init__(self, data: list):
        self.data = data


class RPCBuilder:
    """Handles db.rpc('function_name', params) calls."""
    def __init__(self, session: AsyncSession, func_name: str, params: dict):
        self._session = session
        self._func_name = func_name
        self._params = params

    async def execute(self) -> RPCResult:
        """Execute the RPC as a raw SQL function call or Python implementation."""
        if self._func_name == "match_contents":
            return await self._match_contents()
        elif self._func_name == "get_category_counts":
            return await self._get_category_counts()
        elif self._func_name == "get_content_type_counts":
            return await self._get_content_type_counts()
        else:
            # Try calling as a PostgreSQL function
            return await self._call_pg_function()

    async def _match_contents(self) -> RPCResult:
        """Vector similarity search - replaces the Supabase RPC."""
        from pgvector.sqlalchemy import Vector
        query_embedding = self._params.get("query_embedding")
        threshold = self._params.get("match_threshold", 0.7)
        match_count = self._params.get("match_count", 10)
        p_user_id = self._params.get("p_user_id")

        _ensure_registry()
        Content = _TABLE_MAP["contents"]

        # Build the cosine similarity query
        embedding_col = Content.embedding
        similarity = (1 - embedding_col.cosine_distance(query_embedding)).label("similarity")

        stmt = select(
            Content.id,
            Content.title,
            Content.summary,
            Content.url,
            Content.type,
            Content.iab_tier1,
            Content.concepts,
            Content.entities,
            similarity,
        ).where(
            Content.embedding.isnot(None)
        )

        if p_user_id:
            stmt = stmt.where(Content.user_id == p_user_id)

        stmt = stmt.where(
            (1 - embedding_col.cosine_distance(query_embedding)) > threshold
        ).order_by(
            embedding_col.cosine_distance(query_embedding)
        ).limit(match_count)

        result = await self._session.execute(stmt)
        rows = result.all()

        data = []
        for row in rows:
            item = {
                "id": str(row.id),
                "title": row.title,
                "summary": row.summary,
                "url": row.url,
                "type": row.type,
                "iab_tier1": row.iab_tier1,
                "concepts": row.concepts or [],
                "entities": row.entities or {},
                "similarity": float(row.similarity),
            }
            data.append(item)

        return RPCResult(data=data)

    async def _get_category_counts(self) -> RPCResult:
        """Category aggregation."""
        _ensure_registry()
        Content = _TABLE_MAP["contents"]
        p_user_id = self._params.get("p_user_id")

        stmt = select(
            Content.iab_tier1.label("category"),
            func.count().label("count"),
        ).where(
            Content.user_id == p_user_id,
            Content.is_archived == False,
        ).group_by(Content.iab_tier1)

        result = await self._session.execute(stmt)
        rows = result.all()
        data = [{"category": row.category, "count": row.count} for row in rows]
        return RPCResult(data=data)

    async def _get_content_type_counts(self) -> RPCResult:
        """Content type aggregation."""
        _ensure_registry()
        Content = _TABLE_MAP["contents"]
        p_user_id = self._params.get("p_user_id")

        stmt = select(
            Content.type.label("type_value"),
            func.count().label("count"),
        ).where(
            Content.user_id == p_user_id,
            Content.is_archived == False,
        ).group_by(Content.type)

        result = await self._session.execute(stmt)
        rows = result.all()
        data = [{"type_value": row.type_value, "count": row.count} for row in rows]
        return RPCResult(data=data)

    async def _call_pg_function(self) -> RPCResult:
        """Generic PostgreSQL function call."""
        params_str = ", ".join(f":{k}" for k in self._params)
        sql = text(f"SELECT * FROM {self._func_name}({params_str})")
        result = await self._session.execute(sql, self._params)
        rows = result.mappings().all()
        return RPCResult(data=[dict(r) for r in rows])


# ---------------------------------------------------------------------------
# CompatDB – the main wrapper injected as the "Database" dependency
# ---------------------------------------------------------------------------
class CompatDB:
    """
    Drop-in replacement for the Supabase Client.
    Usage in endpoints stays the same:
        db.table("contents").select("*").eq("user_id", uid).execute()
        db.rpc("match_contents", {...}).execute()
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    def table(self, name: str) -> QueryBuilder:
        return QueryBuilder(self._session, name)

    def rpc(self, func_name: str, params: dict = None) -> RPCBuilder:
        return RPCBuilder(self._session, func_name, params or {})
