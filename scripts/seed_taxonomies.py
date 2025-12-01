#!/usr/bin/env python3
"""
Seed taxonomies (Schema.org types and IAB categories) to JSON files.
"""
import json
from pathlib import Path

# Schema.org types used in the project
SCHEMA_ORG_TYPES = {
    "Article": {
        "description": "Generic article",
        "subtypes": ["NewsArticle", "BlogPosting", "TechArticle", "ScholarlyArticle"]
    },
    "NewsArticle": {
        "description": "News article from media outlets",
        "parent": "Article"
    },
    "BlogPosting": {
        "description": "Blog post",
        "parent": "Article"
    },
    "TechArticle": {
        "description": "Technical article or documentation",
        "parent": "Article"
    },
    "ScholarlyArticle": {
        "description": "Academic or scientific article",
        "parent": "Article"
    },
    "VideoObject": {
        "description": "Video content",
        "subtypes": []
    },
    "AudioObject": {
        "description": "Audio content (podcasts, etc.)",
        "subtypes": []
    },
    "SocialMediaPosting": {
        "description": "Social media post",
        "subtypes": []
    },
    "HowTo": {
        "description": "Step-by-step tutorial",
        "subtypes": []
    },
    "Review": {
        "description": "Review of a product, service, etc.",
        "subtypes": []
    },
    "FAQPage": {
        "description": "FAQ content",
        "subtypes": []
    },
    "Course": {
        "description": "Educational course",
        "subtypes": []
    }
}

# IAB Content Taxonomy v3.0 - Tier 1 with some Tier 2
IAB_TAXONOMY = {
    "Arts & Entertainment": {
        "id": "1",
        "children": [
            "Books & Literature",
            "Celebrity News & Gossip",
            "Comics & Animation",
            "Fine Art",
            "Movies",
            "Music",
            "Television",
            "Visual Arts & Design"
        ]
    },
    "Automotive": {
        "id": "2",
        "children": [
            "Auto Buying & Selling",
            "Auto Insurance",
            "Auto Parts",
            "Auto Repair",
            "Auto Technology",
            "Motorcycles"
        ]
    },
    "Business": {
        "id": "3",
        "children": [
            "Business Banking & Finance",
            "Business I.T.",
            "Economy",
            "Executive Leadership",
            "Human Resources",
            "Marketing & Advertising",
            "Small Business",
            "Startups"
        ]
    },
    "Careers": {
        "id": "4",
        "children": [
            "Career Advice",
            "Job Search",
            "Remote Working",
            "Unemployment"
        ]
    },
    "Education": {
        "id": "5",
        "children": [
            "College Education",
            "Language Learning",
            "Online Education",
            "Primary Education",
            "Secondary Education"
        ]
    },
    "Family & Parenting": {
        "id": "6",
        "children": [
            "Adoption & Fostering",
            "Daycare & Pre-School",
            "Parenting",
            "Pregnancy"
        ]
    },
    "Food & Drink": {
        "id": "7",
        "children": [
            "Alcoholic Beverages",
            "Cooking",
            "Cuisines",
            "Dining Out",
            "Healthy Eating",
            "Vegetarian & Vegan"
        ]
    },
    "Health & Fitness": {
        "id": "8",
        "children": [
            "Diseases & Conditions",
            "Exercise & Fitness",
            "Men's Health",
            "Mental Health",
            "Nutrition",
            "Weight Loss",
            "Women's Health"
        ]
    },
    "Hobbies & Interests": {
        "id": "9",
        "children": [
            "Arts & Crafts",
            "Board Games & Puzzles",
            "Photography",
            "Reading",
            "Video Gaming"
        ]
    },
    "Home & Garden": {
        "id": "10",
        "children": [
            "Gardening",
            "Home Appliances",
            "Home Improvement",
            "Interior Decorating"
        ]
    },
    "Law, Government & Politics": {
        "id": "11",
        "children": [
            "Government",
            "Immigration",
            "Legal Issues",
            "Politics"
        ]
    },
    "News": {
        "id": "12",
        "children": [
            "International News",
            "Local News",
            "National News",
            "Weather"
        ]
    },
    "Personal Finance": {
        "id": "13",
        "children": [
            "Banking",
            "Credit Cards",
            "Financial Planning",
            "Insurance",
            "Investing",
            "Retirement Planning"
        ]
    },
    "Pets": {
        "id": "14",
        "children": [
            "Birds",
            "Cats",
            "Dogs",
            "Fish & Aquariums"
        ]
    },
    "Real Estate": {
        "id": "15",
        "children": [
            "Apartments",
            "Buying/Selling Homes",
            "Real Estate Investing"
        ]
    },
    "Religion & Spirituality": {
        "id": "16",
        "children": [
            "Astrology",
            "Buddhism",
            "Christianity",
            "Islam",
            "Judaism",
            "Spirituality"
        ]
    },
    "Science": {
        "id": "17",
        "children": [
            "Biological Sciences",
            "Chemistry",
            "Environment",
            "Geography",
            "Physics",
            "Space & Astronomy"
        ]
    },
    "Shopping": {
        "id": "18",
        "children": [
            "Coupons & Deals",
            "Gifts",
            "Sales & Promotions"
        ]
    },
    "Society": {
        "id": "19",
        "children": [
            "Crime",
            "Dating",
            "Marriage",
            "Social Issues"
        ]
    },
    "Sports": {
        "id": "20",
        "children": [
            "American Football",
            "Baseball",
            "Basketball",
            "Boxing",
            "Cycling",
            "Golf",
            "Hockey",
            "Motor Sports",
            "Soccer",
            "Tennis"
        ]
    },
    "Style & Fashion": {
        "id": "21",
        "children": [
            "Beauty",
            "Fashion Trends",
            "Men's Fashion",
            "Women's Fashion"
        ]
    },
    "Technology & Computing": {
        "id": "22",
        "children": [
            "Artificial Intelligence",
            "Computing",
            "Consumer Electronics",
            "Cybersecurity",
            "Data Storage",
            "Internet",
            "Robotics",
            "Virtual Reality"
        ]
    },
    "Travel": {
        "id": "23",
        "children": [
            "Adventure Travel",
            "Air Travel",
            "Budget Travel",
            "Business Travel",
            "Hotels & Accommodations"
        ]
    }
}


def main():
    output_dir = Path(__file__).parent.parent / "backend" / "app" / "schemas"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save Schema.org types
    schema_file = output_dir / "schema_org_types.json"
    with open(schema_file, "w", encoding="utf-8") as f:
        json.dump(SCHEMA_ORG_TYPES, f, indent=2, ensure_ascii=False)
    print(f"Saved Schema.org types to {schema_file}")

    # Save IAB Taxonomy
    iab_file = output_dir / "iab_taxonomy.json"
    with open(iab_file, "w", encoding="utf-8") as f:
        json.dump(IAB_TAXONOMY, f, indent=2, ensure_ascii=False)
    print(f"Saved IAB Taxonomy to {iab_file}")

    print("\nTaxonomies seeded successfully!")
    print(f"- {len(SCHEMA_ORG_TYPES)} Schema.org types")
    print(f"- {len(IAB_TAXONOMY)} IAB Tier 1 categories")


if __name__ == "__main__":
    main()
