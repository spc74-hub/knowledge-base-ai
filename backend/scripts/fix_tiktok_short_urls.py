#!/usr/bin/env python3
"""
Migration script to fix TikTok short URLs in existing content.
Resolves short URLs like tiktok.com/ZNR2ux1GR to full URLs like tiktok.com/@user/video/123456
"""
import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import get_supabase_admin_client
from app.services.url_normalizer import is_tiktok_short_url, resolve_tiktok_short_url, normalize_url


async def fix_tiktok_urls(dry_run: bool = True):
    """
    Find and fix all TikTok short URLs in the database.

    Args:
        dry_run: If True, only show what would be changed without making changes.
    """
    db = get_supabase_admin_client()

    # Get all content with TikTok URLs
    print("Fetching content with TikTok URLs...")
    result = db.table("contents").select("id, url, title").ilike("url", "%tiktok%").execute()

    if not result.data:
        print("No TikTok content found.")
        return

    print(f"Found {len(result.data)} TikTok entries.\n")

    short_urls = []
    for content in result.data:
        url = content["url"]
        if is_tiktok_short_url(url):
            short_urls.append(content)

    if not short_urls:
        print("No short URLs found. All TikTok URLs are already in full format.")
        return

    print(f"Found {len(short_urls)} short URLs that need resolution:\n")

    fixed_count = 0
    failed_count = 0

    for content in short_urls:
        content_id = content["id"]
        original_url = content["url"]
        title = content["title"][:50] if content["title"] else "No title"

        print(f"  [{content_id[:8]}...] {title}")
        print(f"    Original: {original_url}")

        # Resolve the short URL
        resolved_url = await resolve_tiktok_short_url(original_url)
        normalized_url = normalize_url(resolved_url)

        if resolved_url == original_url or is_tiktok_short_url(resolved_url):
            print(f"    ❌ Could not resolve (URL may be expired or deleted)")
            failed_count += 1
            continue

        print(f"    Resolved: {resolved_url}")
        print(f"    Normalized: {normalized_url}")

        if not dry_run:
            # Update the URL in the database
            try:
                db.table("contents").update({"url": normalized_url}).eq("id", content_id).execute()
                print(f"    ✅ Updated!")
                fixed_count += 1
            except Exception as e:
                print(f"    ❌ Failed to update: {e}")
                failed_count += 1
        else:
            print(f"    (dry run - no changes made)")
            fixed_count += 1

        print()

    print("\n" + "="*50)
    print(f"Summary:")
    print(f"  Total short URLs found: {len(short_urls)}")
    print(f"  Successfully {'would fix' if dry_run else 'fixed'}: {fixed_count}")
    print(f"  Failed to resolve: {failed_count}")

    if dry_run:
        print(f"\nThis was a dry run. Run with --apply to make changes.")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fix TikTok short URLs in existing content")
    parser.add_argument("--apply", action="store_true", help="Actually apply changes (default is dry run)")
    args = parser.parse_args()

    dry_run = not args.apply

    if dry_run:
        print("🔍 DRY RUN MODE - No changes will be made\n")
    else:
        print("⚠️  APPLY MODE - Changes will be saved to database\n")
        confirm = input("Are you sure you want to continue? (yes/no): ")
        if confirm.lower() != "yes":
            print("Aborted.")
            return

    asyncio.run(fix_tiktok_urls(dry_run=dry_run))


if __name__ == "__main__":
    main()
