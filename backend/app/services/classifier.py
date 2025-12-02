"""
Content classification service.
Uses Claude API to classify content according to Schema.org and IAB taxonomies.
"""
import json
from typing import Optional
from anthropic import Anthropic

from app.core.config import settings
from app.schemas.content import Classification, Entities
from app.services.usage_tracker import usage_tracker


# IAB Tier 1 categories
IAB_TIER1_CATEGORIES = [
    "Arts & Entertainment",
    "Automotive",
    "Business",
    "Careers",
    "Education",
    "Family & Parenting",
    "Food & Drink",
    "Health & Fitness",
    "Hobbies & Interests",
    "Home & Garden",
    "Law, Government & Politics",
    "News",
    "Personal Finance",
    "Pets",
    "Real Estate",
    "Religion & Spirituality",
    "Science",
    "Shopping",
    "Society",
    "Sports",
    "Style & Fashion",
    "Technology & Computing",
    "Travel"
]

# Schema.org types
SCHEMA_ORG_TYPES = [
    "Article",
    "NewsArticle",
    "BlogPosting",
    "TechArticle",
    "ScholarlyArticle",
    "VideoObject",
    "AudioObject",
    "SocialMediaPosting",
    "HowTo",
    "Review",
    "FAQPage",
    "Course"
]

CLASSIFICATION_PROMPT = """
Analiza el siguiente contenido y proporciona una clasificación estructurada.

## TAXONOMÍAS A USAR

### Schema.org Types (usar exactamente estos valores):
{schema_types}

### IAB Content Taxonomy Tier 1 (usar exactamente estos valores):
{iab_categories}

## FORMATO DE RESPUESTA

Responde ÚNICAMENTE con JSON válido (sin markdown, sin explicaciones, sin ```json):

{{
    "schema_type": "Article|VideoObject|...",
    "schema_subtype": "NewsArticle|TechArticle|null",
    "iab_tier1": "Technology & Computing|Business|...",
    "iab_tier2": "subcategoría específica o null",
    "iab_tier3": "subcategoría más específica o null",
    "concepts": ["concepto1", "concepto2", "concepto3"],
    "entities": {{
        "persons": [
            {{"name": "Nombre", "role": "rol o null", "organization": "org o null"}}
        ],
        "organizations": [
            {{"name": "Nombre", "type": "company|institution|..."}}
        ],
        "places": [
            {{"name": "Lugar", "type": "city|country|...", "country": "país o null"}}
        ],
        "products": [
            {{"name": "Producto", "type": "tipo", "company": "empresa o null"}}
        ]
    }},
    "language": "es|en|...",
    "sentiment": "positive|negative|neutral|mixed",
    "technical_level": "beginner|intermediate|advanced|expert",
    "content_format": "tutorial|news|opinion|analysis|review|guide|reference"
}}

## CONTENIDO A CLASIFICAR

Título: {title}

URL: {url}

Contenido (primeros 8000 caracteres):
{content}
"""


class ClassifierService:
    """
    Service for classifying content using Claude API.
    """

    def __init__(self):
        self.client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = "claude-3-5-haiku-20241022"

    async def classify(
        self,
        title: str,
        content: str,
        url: str = "",
        user_id: str = None
    ) -> Classification:
        """
        Classify content using Claude API.

        Args:
            title: Content title
            content: Content text
            url: Original URL
            user_id: Optional user ID for tracking

        Returns:
            Classification object with all taxonomies
        """
        try:
            # Prepare prompt
            prompt = CLASSIFICATION_PROMPT.format(
                schema_types=", ".join(SCHEMA_ORG_TYPES),
                iab_categories=", ".join(IAB_TIER1_CATEGORIES),
                title=title,
                url=url,
                content=content[:8000]  # Limit content to avoid token limits
            )

            # Call Claude API
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1500,
                temperature=0.3,  # Low temperature for consistency
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            # Track usage if user_id provided
            if user_id and response.usage:
                await usage_tracker.track_usage(
                    user_id=user_id,
                    provider="anthropic",
                    model=self.model,
                    operation="classification",
                    input_tokens=response.usage.input_tokens,
                    output_tokens=response.usage.output_tokens
                )

            # Parse response
            response_text = response.content[0].text.strip()

            # Try to parse JSON
            try:
                classification_data = json.loads(response_text)
            except json.JSONDecodeError:
                # Try to extract JSON from response
                import re
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    classification_data = json.loads(json_match.group())
                else:
                    raise ValueError("Could not parse classification response")

            # Validate and create Classification object
            validated = self._validate_classification(classification_data)

            return Classification(**validated)

        except Exception as e:
            # Return default classification on error
            return Classification(
                schema_type="Article",
                iab_tier1="News",
                concepts=[],
                entities=Entities(),
                language="es",
                sentiment="neutral",
                technical_level="intermediate",
                content_format="article"
            )

    def _validate_classification(self, data: dict) -> dict:
        """
        Validate classification data against taxonomies.
        Apply fallbacks for invalid values.
        """
        validated = data.copy()

        # Validate schema_type
        if validated.get("schema_type") not in SCHEMA_ORG_TYPES:
            validated["schema_type"] = "Article"

        # Validate iab_tier1
        if validated.get("iab_tier1") not in IAB_TIER1_CATEGORIES:
            validated["iab_tier1"] = "News"

        # Validate sentiment
        valid_sentiments = ["positive", "negative", "neutral", "mixed"]
        if validated.get("sentiment") not in valid_sentiments:
            validated["sentiment"] = "neutral"

        # Validate technical_level
        valid_levels = ["beginner", "intermediate", "advanced", "expert"]
        if validated.get("technical_level") not in valid_levels:
            validated["technical_level"] = "intermediate"

        # Validate content_format
        valid_formats = ["tutorial", "news", "opinion", "analysis", "review", "guide", "reference", "article"]
        if validated.get("content_format") not in valid_formats:
            validated["content_format"] = "article"

        # Validate language (basic check)
        if not validated.get("language") or len(validated["language"]) != 2:
            validated["language"] = "es"

        # Ensure concepts is a list
        if not isinstance(validated.get("concepts"), list):
            validated["concepts"] = []

        # Ensure entities has proper structure
        if not isinstance(validated.get("entities"), dict):
            validated["entities"] = {
                "persons": [],
                "organizations": [],
                "places": [],
                "products": []
            }

        return validated


# Singleton instance
classifier_service = ClassifierService()
