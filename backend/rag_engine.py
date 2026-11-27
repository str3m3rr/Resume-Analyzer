"""Lightweight in-memory RAG engine using the shared Sentence-BERT model.

Replaces ChromaDB's separate ONNX runtime so the backend stays within
Render's 512 MB free-tier memory limit while keeping identical behavior.
"""
import os
from typing import List, Optional
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

_memories: List[str] = []
_memory_embeddings: Optional[np.ndarray] = None


def initialize_memory():
    """Reads master_experience.txt and embeds each paragraph once using SBERT."""
    global _memories, _memory_embeddings
    if _memory_embeddings is not None and _memories:
        return

    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "master_experience.txt")
    if not os.path.exists(file_path):
        file_path = "master_experience.txt"
    if not os.path.exists(file_path):
        print("Warning: master_experience.txt not found!")
        return

    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()

    memories = [m.strip() for m in content.split("\n") if m.strip()]
    if not memories:
        return

    from similarity_model import get_model

    model_instance = get_model()
    _memories = memories
    _memory_embeddings = model_instance.encode(memories)
    print(f"Successfully loaded {len(_memories)} memories into in-memory RAG!")


def retrieve_relevant_memory(target_skill: str) -> str:
    """Searches memory embeddings for the closest matching experience."""
    if _memory_embeddings is None or not _memories:
        initialize_memory()

    if _memory_embeddings is None or not _memories:
        return "No extended background context available."

    from similarity_model import get_model

    model_instance = get_model()
    query_emb = model_instance.encode([target_skill])
    sims = cosine_similarity(query_emb, _memory_embeddings)[0]
    best_idx = int(np.argmax(sims))
    return _memories[best_idx]
