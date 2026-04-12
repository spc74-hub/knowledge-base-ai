"""
API Usage tracking service.
Tracks token consumption and costs for OpenAI and Anthropic APIs.
"""
from typing import Optional
from datetime import datetime, timezone

# Pricing per 1M tokens (as of 2024-2025)
PRICING = {
    "openai": {
        "text-embedding-3-small": {"input": 0.02, "output": 0.0},  # $0.02 per 1M tokens
        "text-embedding-3-large": {"input": 0.13, "output": 0.0},
    },
    "anthropic": {
        "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},  # $3/$15 per 1M tokens
        "claude-3-5-sonnet-20241022": {"input": 3.0, "output": 15.0},
        "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
        "claude-3-5-haiku-20241022": {"input": 1.0, "output": 5.0},  # $1/$5 per 1M tokens
    }
}


def calculate_cost(provider: str, model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost in USD based on token usage."""
    pricing = PRICING.get(provider, {}).get(model)
    if not pricing:
        # Default pricing if model not found
        if provider == "openai":
            pricing = {"input": 0.02, "output": 0.0}
        else:
            pricing = {"input": 3.0, "output": 15.0}

    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return input_cost + output_cost


class UsageTracker:
    """Service for tracking API usage and costs."""

    def __init__(self):
        self._db = None

    def set_db(self, db):
        """Set database client (CompatDB instance)."""
        self._db = db

    async def track_usage(
        self,
        user_id: str,
        provider: str,
        model: str,
        operation: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        metadata: dict = None
    ):
        """
        Track API usage.

        Args:
            user_id: User ID
            provider: 'openai' or 'anthropic'
            model: Model name
            operation: Operation type (embedding, classification, summarization, chat)
            input_tokens: Input tokens used
            output_tokens: Output tokens used
            metadata: Additional metadata
        """
        if not self._db:
            print("Warning: Usage tracker DB not set, skipping tracking")
            return

        try:
            total_tokens = input_tokens + output_tokens
            cost_usd = calculate_cost(provider, model, input_tokens, output_tokens)

            await self._db.table("api_usage").insert({
                "user_id": user_id,
                "provider": provider,
                "model": model,
                "operation": operation,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "cost_usd": cost_usd,
                "metadata": metadata or {}
            }).execute()  # noqa: await in insert
        except Exception as e:
            # Don't fail the main operation if tracking fails
            print(f"Error tracking API usage: {e}")

    async def get_usage_stats(self, user_id: str, db, days: int = 30) -> dict:
        """
        Get usage statistics for a user.

        Args:
            user_id: User ID
            db: Supabase client
            days: Number of days to look back

        Returns:
            Usage statistics
        """
        try:
            from datetime import timedelta
            cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

            # Get all usage records
            response = await db.table("api_usage").select("*").eq(
                "user_id", user_id
            ).gte("created_at", cutoff_date).execute()

            records = response.data or []

            # Aggregate stats
            stats = {
                "total_tokens": 0,
                "total_cost_usd": 0.0,
                "by_provider": {},
                "by_operation": {},
                "by_model": {},
                "daily_usage": {},
                "record_count": len(records)
            }

            for record in records:
                tokens = record.get("total_tokens", 0)
                cost = float(record.get("cost_usd", 0))
                provider = record.get("provider", "unknown")
                operation = record.get("operation", "unknown")
                model = record.get("model", "unknown")
                date = record.get("created_at", "")[:10]  # YYYY-MM-DD

                stats["total_tokens"] += tokens
                stats["total_cost_usd"] += cost

                # By provider
                if provider not in stats["by_provider"]:
                    stats["by_provider"][provider] = {"tokens": 0, "cost_usd": 0.0, "calls": 0}
                stats["by_provider"][provider]["tokens"] += tokens
                stats["by_provider"][provider]["cost_usd"] += cost
                stats["by_provider"][provider]["calls"] += 1

                # By operation
                if operation not in stats["by_operation"]:
                    stats["by_operation"][operation] = {"tokens": 0, "cost_usd": 0.0, "calls": 0}
                stats["by_operation"][operation]["tokens"] += tokens
                stats["by_operation"][operation]["cost_usd"] += cost
                stats["by_operation"][operation]["calls"] += 1

                # By model
                if model not in stats["by_model"]:
                    stats["by_model"][model] = {"tokens": 0, "cost_usd": 0.0, "calls": 0}
                stats["by_model"][model]["tokens"] += tokens
                stats["by_model"][model]["cost_usd"] += cost
                stats["by_model"][model]["calls"] += 1

                # Daily
                if date not in stats["daily_usage"]:
                    stats["daily_usage"][date] = {"tokens": 0, "cost_usd": 0.0, "calls": 0}
                stats["daily_usage"][date]["tokens"] += tokens
                stats["daily_usage"][date]["cost_usd"] += cost
                stats["daily_usage"][date]["calls"] += 1

            # Round costs
            stats["total_cost_usd"] = round(stats["total_cost_usd"], 6)
            for provider_stats in stats["by_provider"].values():
                provider_stats["cost_usd"] = round(provider_stats["cost_usd"], 6)
            for op_stats in stats["by_operation"].values():
                op_stats["cost_usd"] = round(op_stats["cost_usd"], 6)
            for model_stats in stats["by_model"].values():
                model_stats["cost_usd"] = round(model_stats["cost_usd"], 6)
            for daily_stats in stats["daily_usage"].values():
                daily_stats["cost_usd"] = round(daily_stats["cost_usd"], 6)

            return stats

        except Exception as e:
            print(f"Error getting usage stats: {e}")
            return {
                "total_tokens": 0,
                "total_cost_usd": 0.0,
                "by_provider": {},
                "by_operation": {},
                "by_model": {},
                "daily_usage": {},
                "record_count": 0,
                "error": str(e)
            }


# Singleton instance
usage_tracker = UsageTracker()
