#!/usr/bin/env python3
"""
Test Claude API connection and basic functionality.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

if not ANTHROPIC_API_KEY:
    print("Error: ANTHROPIC_API_KEY not found in environment")
    print("Make sure you have a .env file in the backend directory")
    sys.exit(1)


def test_basic_call():
    """Test basic Claude API call."""
    from anthropic import Anthropic

    print("Testing Claude API connection...")

    client = Anthropic(api_key=ANTHROPIC_API_KEY)

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=100,
            messages=[
                {"role": "user", "content": "Say 'Hello from Claude!' in exactly those words."}
            ]
        )

        print(f"Response: {response.content[0].text}")
        print(f"Model: {response.model}")
        print(f"Tokens used: {response.usage.input_tokens} input, {response.usage.output_tokens} output")
        print("\nClaude API is working correctly!")
        return True

    except Exception as e:
        print(f"Error: {e}")
        return False


def test_classification():
    """Test content classification."""
    from anthropic import Anthropic

    print("\nTesting content classification...")

    client = Anthropic(api_key=ANTHROPIC_API_KEY)

    test_content = """
    Machine Learning is transforming healthcare.
    New AI models can detect diseases earlier than traditional methods.
    Researchers at Stanford have developed a system that can identify
    cancer from medical images with 95% accuracy.
    """

    prompt = """
    Classify this content and respond ONLY with JSON:
    {
        "schema_type": "Article or NewsArticle or TechArticle",
        "iab_tier1": "one of the main IAB categories",
        "concepts": ["list", "of", "keywords"]
    }

    Content:
    """ + test_content

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            temperature=0.3,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        print(f"Classification result:\n{response.content[0].text}")
        print("\nClassification test passed!")
        return True

    except Exception as e:
        print(f"Error: {e}")
        return False


def test_summarization():
    """Test content summarization."""
    from anthropic import Anthropic

    print("\nTesting summarization...")

    client = Anthropic(api_key=ANTHROPIC_API_KEY)

    test_content = """
    Artificial intelligence has made remarkable progress in recent years.
    Large language models like Claude can now understand and generate
    human-like text, assist with coding, analyze data, and much more.
    These advances are changing how we work and interact with technology.
    Companies across industries are exploring ways to integrate AI into
    their products and services to improve efficiency and user experience.
    """

    prompt = f"""
    Summarize the following content in 2-3 sentences:

    {test_content}

    Summary:
    """

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=150,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        print(f"Summary:\n{response.content[0].text}")
        print("\nSummarization test passed!")
        return True

    except Exception as e:
        print(f"Error: {e}")
        return False


def main():
    print("=" * 60)
    print("Claude API Test Suite")
    print("=" * 60 + "\n")

    results = []

    results.append(("Basic Call", test_basic_call()))
    results.append(("Classification", test_classification()))
    results.append(("Summarization", test_summarization()))

    print("\n" + "=" * 60)
    print("Test Results:")
    print("=" * 60)

    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"{name}: {status}")

    all_passed = all(r[1] for r in results)
    print("\n" + ("All tests passed!" if all_passed else "Some tests failed."))

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
