"""
URL normalization service.
Cleans and normalizes URLs to prevent duplicates from tracking parameters and URL variations.
"""
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
import re


# Common tracking parameters to remove
TRACKING_PARAMS = {
    # UTM parameters
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    # Facebook
    'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
    # Google
    'gclid', 'gclsrc', 'dclid',
    # TikTok
    'is_copy_url', 'is_from_webapp', '_r', 'checksum', 'sec_uid', 'share_app_id',
    'share_author_id', 'share_link_id', 'social_sharing', 'tt_from', 'u_code',
    # Twitter/X
    't', 's', 'ref_src', 'ref_url',
    # YouTube
    'si', 'feature', 'pp', 'ab_channel',
    # Instagram
    'igshid', 'igsh',
    # LinkedIn
    'trk', 'lipi', 'lici',
    # General
    'ref', 'source', 'share', 'shared', 'mc_cid', 'mc_eid',
    '_ga', '_gid', '_gl',
}

# Domain aliases - map alternative domains to canonical ones
DOMAIN_ALIASES = {
    'tiktokv.com': 'tiktok.com',
    'vm.tiktok.com': 'tiktok.com',
    'vt.tiktok.com': 'tiktok.com',
    'm.tiktok.com': 'tiktok.com',
    'mobile.twitter.com': 'twitter.com',
    'm.youtube.com': 'youtube.com',
}

# Platform-specific normalization rules
PLATFORM_RULES = {
    'tiktok.com': {
        'remove_query': True,
        'preserve_path': True,  # Keep @user/video/ID intact for navigation
    },
    'youtube.com': {
        'essential_params': {'v', 'list', 't'},  # Keep video ID, playlist, timestamp
    },
    'youtu.be': {
        'essential_params': {'t'},  # Keep timestamp only
    },
    'twitter.com': {
        'keep_path_pattern': r'^/\w+/status/\d+',
    },
    'x.com': {
        'keep_path_pattern': r'^/\w+/status/\d+',
    },
    'instagram.com': {
        'keep_path_pattern': r'^/(p|reel|tv)/[\w-]+',
    },
}


def normalize_url(url: str) -> str:
    """
    Normalize a URL by removing tracking parameters and standardizing format.

    Args:
        url: The URL to normalize

    Returns:
        Normalized URL string
    """
    if not url:
        return url

    try:
        # Parse the URL
        parsed = urlparse(url)

        # Get the domain without www
        domain = parsed.netloc.lower()
        if domain.startswith('www.'):
            domain = domain[4:]

        # Apply domain aliases (e.g., tiktokv.com -> tiktok.com)
        domain = DOMAIN_ALIASES.get(domain, domain)

        # Reconstruct netloc with canonical domain
        netloc = domain

        # Get platform-specific rules
        platform_key = None
        for key in PLATFORM_RULES:
            if key in domain:
                platform_key = key
                break

        # Clean the path
        path = parsed.path.rstrip('/')  # Remove trailing slash

        # Handle query parameters
        query_params = parse_qs(parsed.query, keep_blank_values=False)

        if platform_key:
            rules = PLATFORM_RULES[platform_key]

            # Check if we should remove all query params
            if rules.get('remove_query'):
                query_params = {}
            elif 'essential_params' in rules:
                # Keep only essential params
                essential = rules['essential_params']
                query_params = {k: v for k, v in query_params.items() if k in essential}

            # Clean path if pattern specified (but not if preserve_path is set)
            if not rules.get('preserve_path') and 'keep_path_pattern' in rules:
                pattern = rules['keep_path_pattern']
                match = re.match(pattern, path)
                if match:
                    path = match.group()
        else:
            # Generic cleaning: remove tracking parameters
            query_params = {
                k: v for k, v in query_params.items()
                if k.lower() not in TRACKING_PARAMS
            }

        # Rebuild query string (sorted for consistency)
        if query_params:
            # Flatten single-value lists
            flat_params = {k: v[0] if len(v) == 1 else v for k, v in query_params.items()}
            query_string = urlencode(flat_params, doseq=True)
        else:
            query_string = ''

        # Rebuild the URL
        normalized = urlunparse((
            'https',  # Always use https
            netloc,
            path,
            '',  # params (rarely used)
            query_string,
            ''  # fragment (remove anchors)
        ))

        return normalized

    except Exception:
        # If parsing fails, return original URL
        return url


def extract_content_id(url: str) -> dict:
    """
    Extract platform-specific content IDs from a URL.
    Useful for additional duplicate detection.

    Args:
        url: The URL to extract IDs from

    Returns:
        Dict with platform and content_id if found
    """
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower().replace('www.', '')
        path = parsed.path
        query = parse_qs(parsed.query)

        # TikTok (including tiktokv.com, vm.tiktok.com, etc.)
        if 'tiktok' in domain:
            # Match both /video/ID and /share/video/ID
            match = re.search(r'/(?:share/)?video/(\d+)', path)
            if match:
                return {'platform': 'tiktok', 'content_id': match.group(1)}

        # YouTube
        if 'youtube.com' in domain:
            if 'v' in query:
                return {'platform': 'youtube', 'content_id': query['v'][0]}
            # Handle /shorts/ URLs
            match = re.search(r'/shorts/([\w-]+)', path)
            if match:
                return {'platform': 'youtube', 'content_id': match.group(1)}

        if 'youtu.be' in domain:
            video_id = path.strip('/')
            if video_id:
                return {'platform': 'youtube', 'content_id': video_id}

        # Twitter/X
        if 'twitter.com' in domain or 'x.com' in domain:
            match = re.search(r'/status/(\d+)', path)
            if match:
                return {'platform': 'twitter', 'content_id': match.group(1)}

        # Instagram
        if 'instagram.com' in domain:
            match = re.search(r'/(p|reel|tv)/([\w-]+)', path)
            if match:
                return {'platform': 'instagram', 'content_id': match.group(2)}

        return {'platform': None, 'content_id': None}

    except Exception:
        return {'platform': None, 'content_id': None}


def urls_are_same_content(url1: str, url2: str) -> bool:
    """
    Check if two URLs point to the same content.

    Args:
        url1: First URL
        url2: Second URL

    Returns:
        True if URLs point to same content
    """
    # First try normalized comparison
    if normalize_url(url1) == normalize_url(url2):
        return True

    # Then try content ID comparison
    id1 = extract_content_id(url1)
    id2 = extract_content_id(url2)

    if id1['platform'] and id1['platform'] == id2['platform']:
        if id1['content_id'] and id1['content_id'] == id2['content_id']:
            return True

    return False


# Singleton instance for easy import
url_normalizer = type('URLNormalizer', (), {
    'normalize': staticmethod(normalize_url),
    'extract_id': staticmethod(extract_content_id),
    'same_content': staticmethod(urls_are_same_content),
})()
