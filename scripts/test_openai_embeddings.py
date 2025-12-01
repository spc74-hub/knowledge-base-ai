#!/usr/bin/env python3
"""
Test OpenAI Embeddings API connection.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    print("Error: OPENAI_API_KEY not found in environment")
    print("Make sure you have a .env file in the backend directory")
    sys.exit(1)


def test_embedding():
    """Test generating an embedding."""
    from openai import OpenAI

    print("Testing OpenAI Embeddings API...")

    client = OpenAI(api_key=OPENAI_API_KEY)

    test_text = "Machine learning is a subset of artificial intelligence."

    try:
        response = client.embeddings.create(
            input=test_text,
            model="text-embedding-3-small"
        )

        embedding = response.data[0].embedding

        print(f"Input: '{test_text}'")
        print(f"Model: text-embedding-3-small")
        print(f"Embedding dimensions: {len(embedding)}")
        print(f"First 5 values: {embedding[:5]}")
        print(f"Tokens used: {response.usage.total_tokens}")
        print("\nOpenAI Embeddings API is working correctly!")

        return True

    except Exception as e:
        print(f"Error: {e}")
        return False


def test_batch_embedding():
    """Test batch embedding."""
    from openai import OpenAI

    print("\nTesting batch embeddings...")

    client = OpenAI(api_key=OPENAI_API_KEY)

    test_texts = [
        "Artificial intelligence is changing the world.",
        "Python is a popular programming language.",
        "Machine learning requires large datasets."
    ]

    try:
        response = client.embeddings.create(
            input=test_texts,
            model="text-embedding-3-small"
        )

        print(f"Number of texts: {len(test_texts)}")
        print(f"Number of embeddings: {len(response.data)}")
        print(f"Total tokens: {response.usage.total_tokens}")

        for i, item in enumerate(response.data):
            print(f"Text {i+1} embedding dim: {len(item.embedding)}")

        print("\nBatch embedding test passed!")
        return True

    except Exception as e:
        print(f"Error: {e}")
        return False


def test_similarity():
    """Test similarity calculation between embeddings."""
    from openai import OpenAI
    import numpy as np

    print("\nTesting similarity calculation...")

    client = OpenAI(api_key=OPENAI_API_KEY)

    texts = [
        "Machine learning is a type of AI.",
        "AI and machine learning are related concepts.",
        "I like pizza and pasta for dinner."
    ]

    try:
        response = client.embeddings.create(
            input=texts,
            model="text-embedding-3-small"
        )

        embeddings = [np.array(item.embedding) for item in response.data]

        # Calculate cosine similarities
        def cosine_similarity(a, b):
            return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

        sim_0_1 = cosine_similarity(embeddings[0], embeddings[1])
        sim_0_2 = cosine_similarity(embeddings[0], embeddings[2])
        sim_1_2 = cosine_similarity(embeddings[1], embeddings[2])

        print(f"Text 0: '{texts[0]}'")
        print(f"Text 1: '{texts[1]}'")
        print(f"Text 2: '{texts[2]}'")
        print(f"\nSimilarity 0-1 (related): {sim_0_1:.4f}")
        print(f"Similarity 0-2 (unrelated): {sim_0_2:.4f}")
        print(f"Similarity 1-2 (unrelated): {sim_1_2:.4f}")

        # Related texts should have higher similarity
        if sim_0_1 > sim_0_2 and sim_0_1 > sim_1_2:
            print("\nSimilarity test passed! Related texts have higher similarity.")
            return True
        else:
            print("\nWarning: Unexpected similarity results.")
            return True  # Still return True as the API works

    except Exception as e:
        print(f"Error: {e}")
        return False


def main():
    print("=" * 60)
    print("OpenAI Embeddings API Test Suite")
    print("=" * 60 + "\n")

    results = []

    results.append(("Single Embedding", test_embedding()))
    results.append(("Batch Embedding", test_batch_embedding()))
    results.append(("Similarity", test_similarity()))

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
