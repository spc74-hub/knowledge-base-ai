"""
Content fetching service.
Handles fetching content from different sources (web, YouTube, TikTok, Twitter).
"""
import re
import httpx
from bs4 import BeautifulSoup
from typing import Optional
from pydantic import BaseModel
from abc import ABC, abstractmethod


class FetchResult(BaseModel):
    """Result of fetching content from a URL."""
    type: str  # web, youtube, tiktok, twitter
    title: str
    content: str
    metadata: dict = {}
    success: bool = True
    error: Optional[str] = None


class FetchStrategy(ABC):
    """Base class for content fetching strategies."""

    @abstractmethod
    async def fetch(self, url: str) -> FetchResult:
        pass


class WebFetchStrategy(FetchStrategy):
    """Strategy for fetching web articles."""

    async def fetch(self, url: str) -> FetchResult:
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers, follow_redirects=True)
                response.raise_for_status()

            soup = BeautifulSoup(response.text, "lxml")

            # Extract title
            title = self._extract_title(soup)

            # Extract metadata
            metadata = self._extract_metadata(soup, url)

            # Extract main content
            content = self._extract_content(soup)

            return FetchResult(
                type="web",
                title=title,
                content=content,
                metadata=metadata
            )

        except Exception as e:
            return FetchResult(
                type="web",
                title=url,
                content="",
                success=False,
                error=str(e)
            )

    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract title from various sources."""
        # Try Open Graph title
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            return og_title["content"]

        # Try Twitter card title
        twitter_title = soup.find("meta", attrs={"name": "twitter:title"})
        if twitter_title and twitter_title.get("content"):
            return twitter_title["content"]

        # Try regular title tag
        if soup.title and soup.title.string:
            return soup.title.string.strip()

        # Try h1
        h1 = soup.find("h1")
        if h1:
            return h1.get_text(strip=True)

        return "Untitled"

    def _extract_metadata(self, soup: BeautifulSoup, url: str) -> dict:
        """Extract metadata from HTML."""
        metadata = {"url": url}

        # Description
        og_desc = soup.find("meta", property="og:description")
        if og_desc:
            metadata["description"] = og_desc.get("content")
        else:
            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc:
                metadata["description"] = meta_desc.get("content")

        # Image
        og_image = soup.find("meta", property="og:image")
        if og_image:
            metadata["image_url"] = og_image.get("content")

        # Author
        author = soup.find("meta", attrs={"name": "author"})
        if author:
            metadata["author"] = author.get("content")

        # Published date
        pub_date = soup.find("meta", property="article:published_time")
        if pub_date:
            metadata["published_date"] = pub_date.get("content")

        return metadata

    def _extract_content(self, soup: BeautifulSoup) -> str:
        """Extract main content from HTML."""
        # Remove unwanted elements
        for element in soup.find_all(["script", "style", "nav", "header", "footer", "aside", "advertisement"]):
            element.decompose()

        # Try to find article content
        article = soup.find("article")
        if article:
            return article.get_text(separator="\n", strip=True)

        # Try main content area
        main = soup.find("main")
        if main:
            return main.get_text(separator="\n", strip=True)

        # Try common content class names
        for class_name in ["content", "post-content", "article-content", "entry-content"]:
            content_div = soup.find(class_=class_name)
            if content_div:
                return content_div.get_text(separator="\n", strip=True)

        # Fallback to body
        body = soup.find("body")
        if body:
            return body.get_text(separator="\n", strip=True)[:10000]

        return ""


class YouTubeFetchStrategy(FetchStrategy):
    """Strategy for fetching YouTube videos using yt-dlp."""

    async def fetch(self, url: str) -> FetchResult:
        import asyncio
        import yt_dlp

        try:
            video_id = self._extract_video_id(url)
            if not video_id:
                return FetchResult(
                    type="youtube",
                    title="",
                    content="",
                    success=False,
                    error="Could not extract video ID"
                )

            # Run yt-dlp in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._fetch_with_ytdlp, url)
            return result

        except Exception as e:
            return FetchResult(
                type="youtube",
                title="",
                content="",
                success=False,
                error=str(e)
            )

    def _fetch_with_ytdlp(self, url: str) -> FetchResult:
        """Fetch YouTube video info and subtitles using yt-dlp."""
        import yt_dlp

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['es', 'en'],
            'skip_download': True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)

            title = info.get('title', 'YouTube Video')
            description = info.get('description', '')
            duration = info.get('duration', 0)
            channel = info.get('channel', info.get('uploader', ''))
            view_count = info.get('view_count', 0)
            upload_date = info.get('upload_date', '')
            thumbnail = info.get('thumbnail', '')

            # Try to get subtitles/transcript
            transcript = self._extract_transcript(info)

            # Build content from transcript or description
            if transcript:
                content = f"Transcript:\n{transcript}"
            else:
                content = f"Descripción del video:\n{description}"

            # Format duration
            duration_str = f"{duration // 60}:{duration % 60:02d}" if duration else "N/A"

            metadata = {
                "video_id": info.get('id', ''),
                "url": url,
                "channel": channel,
                "duration": duration,
                "duration_formatted": duration_str,
                "view_count": view_count,
                "upload_date": upload_date,
                "thumbnail": thumbnail,
                "has_transcript": bool(transcript),
            }

            return FetchResult(
                type="youtube",
                title=title,
                content=content,
                metadata=metadata
            )

        except Exception as e:
            return FetchResult(
                type="youtube",
                title="",
                content="",
                success=False,
                error=f"yt-dlp error: {str(e)}"
            )

    def _extract_transcript(self, info: dict) -> str:
        """Extract transcript from subtitles if available."""
        import yt_dlp

        # Check for subtitles in video info
        subtitles = info.get('subtitles', {})
        automatic_captions = info.get('automatic_captions', {})

        # Prefer manual subtitles, then automatic
        subs_to_use = None
        for lang in ['es', 'en']:
            if lang in subtitles:
                subs_to_use = subtitles[lang]
                break
            if lang in automatic_captions:
                subs_to_use = automatic_captions[lang]
                break

        if not subs_to_use:
            return ""

        # Try to get transcript text
        # yt-dlp provides subtitle URLs, we need to fetch and parse them
        try:
            # Find a text-based format (vtt, srv1, etc.)
            for sub_info in subs_to_use:
                if sub_info.get('ext') in ['vtt', 'srv1', 'srv2', 'srv3', 'ttml', 'json3']:
                    sub_url = sub_info.get('url')
                    if sub_url:
                        import httpx
                        response = httpx.get(sub_url, timeout=10.0)
                        if response.status_code == 200:
                            return self._parse_subtitles(response.text, sub_info.get('ext', 'vtt'))
        except Exception:
            pass

        return ""

    def _parse_subtitles(self, content: str, format: str) -> str:
        """Parse subtitles and extract plain text."""
        lines = []

        if format == 'vtt':
            # Parse WebVTT format
            for line in content.split('\n'):
                line = line.strip()
                # Skip timestamps, headers, and empty lines
                if not line or '-->' in line or line.startswith('WEBVTT') or line.startswith('Kind:') or line.startswith('Language:'):
                    continue
                # Skip numeric cue identifiers
                if line.isdigit():
                    continue
                # Remove HTML tags
                clean_line = re.sub(r'<[^>]+>', '', line)
                if clean_line and clean_line not in lines:
                    lines.append(clean_line)
        else:
            # For other formats, try basic text extraction
            for line in content.split('\n'):
                line = line.strip()
                if line and not '-->' in line and not line.isdigit():
                    clean_line = re.sub(r'<[^>]+>', '', line)
                    if clean_line and clean_line not in lines:
                        lines.append(clean_line)

        return ' '.join(lines)

    def _extract_video_id(self, url: str) -> Optional[str]:
        """Extract video ID from YouTube URL."""
        patterns = [
            r"(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})",
            r"youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})"
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)

        return None


class TikTokFetchStrategy(FetchStrategy):
    """Strategy for fetching TikTok videos using yt-dlp."""

    async def fetch(self, url: str) -> FetchResult:
        import asyncio

        try:
            # Run yt-dlp in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self._fetch_with_ytdlp, url)
            return result

        except Exception as e:
            return FetchResult(
                type="tiktok",
                title="",
                content="",
                success=False,
                error=str(e)
            )

    def _fetch_with_ytdlp(self, url: str) -> FetchResult:
        """Fetch TikTok video info using yt-dlp."""
        import yt_dlp

        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True,
            # Follow redirects (tiktokv.com -> tiktok.com)
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)

            # Extract video information
            title = info.get('title', info.get('description', 'TikTok Video')[:100])
            description = info.get('description', '')
            duration = info.get('duration', 0)
            creator = info.get('creator', info.get('uploader', info.get('channel', '')))
            uploader_id = info.get('uploader_id', info.get('channel_id', ''))
            view_count = info.get('view_count', 0)
            like_count = info.get('like_count', 0)
            comment_count = info.get('comment_count', 0)
            upload_date = info.get('upload_date', '')
            thumbnail = info.get('thumbnail', '')

            # Build content from description and metadata
            content_parts = []
            if description:
                content_parts.append(f"Descripción: {description}")
            if creator:
                content_parts.append(f"Creador: {creator}")

            # Extract hashtags from description if present
            hashtags = []
            if description:
                import re
                hashtags = re.findall(r'#\w+', description)
                if hashtags:
                    content_parts.append(f"Hashtags: {', '.join(hashtags)}")

            content = "\n\n".join(content_parts) if content_parts else f"Video de TikTok de {creator}"

            # Format duration
            duration_str = f"{duration // 60}:{duration % 60:02d}" if duration else "N/A"

            # Format upload date
            formatted_date = ""
            if upload_date and len(upload_date) == 8:
                formatted_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"

            # Get final URL (after redirects)
            final_url = info.get('webpage_url', url)

            metadata = {
                "video_id": info.get('id', ''),
                "url": final_url,
                "original_url": url,
                "creator": creator,
                "uploader_id": uploader_id,
                "duration": duration,
                "duration_formatted": duration_str,
                "view_count": view_count,
                "like_count": like_count,
                "comment_count": comment_count,
                "upload_date": formatted_date or upload_date,
                "thumbnail": thumbnail,
                "hashtags": hashtags,
            }

            # Use description as title if no title available (common for TikTok)
            if not title or title == 'TikTok Video':
                if description:
                    # Use first line or first 100 chars of description as title
                    title = description.split('\n')[0][:100]
                    if len(description.split('\n')[0]) > 100:
                        title += "..."
                elif creator:
                    title = f"Video de {creator}"

            return FetchResult(
                type="tiktok",
                title=title,
                content=content,
                metadata=metadata
            )

        except Exception as e:
            return FetchResult(
                type="tiktok",
                title="",
                content="",
                success=False,
                error=f"yt-dlp error: {str(e)}"
            )


class TwitterFetchStrategy(FetchStrategy):
    """Strategy for fetching Twitter/X posts."""

    async def fetch(self, url: str) -> FetchResult:
        try:
            # TODO: Use API or Playwright for Twitter
            # Twitter/X requires authentication for API

            return FetchResult(
                type="twitter",
                title="Twitter Post",
                content="[Twitter content will be fetched using API/Playwright]",
                metadata={"url": url}
            )

        except Exception as e:
            return FetchResult(
                type="twitter",
                title="",
                content="",
                success=False,
                error=str(e)
            )


class FetcherService:
    """
    Service for fetching content from URLs.
    Uses strategy pattern to handle different content types.
    """

    def __init__(self):
        self.strategies = {
            "web": WebFetchStrategy(),
            "youtube": YouTubeFetchStrategy(),
            "tiktok": TikTokFetchStrategy(),
            "twitter": TwitterFetchStrategy()
        }

    def detect_type(self, url: str) -> str:
        """Detect content type from URL."""
        url_lower = url.lower()

        if "youtube.com" in url_lower or "youtu.be" in url_lower:
            return "youtube"
        elif "tiktok.com" in url_lower or "tiktokv.com" in url_lower:
            return "tiktok"
        elif "twitter.com" in url_lower or "x.com" in url_lower:
            return "twitter"
        else:
            return "web"

    async def fetch(self, url: str) -> FetchResult:
        """
        Fetch content from URL.

        Args:
            url: URL to fetch

        Returns:
            FetchResult with content and metadata
        """
        content_type = self.detect_type(url)
        strategy = self.strategies.get(content_type, self.strategies["web"])
        return await strategy.fetch(url)


# Singleton instance
fetcher_service = FetcherService()
