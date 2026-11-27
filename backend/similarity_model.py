from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Global model variable
_model = None


class _FastEmbedAdapter:
    """Wraps FastEmbed's ONNX TextEmbedding with a SentenceTransformer-like .encode() API."""

    def __init__(self):
        from fastembed import TextEmbedding

        self._embedder = TextEmbedding(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            threads=1,
        )

    def encode(self, texts, **kwargs):
        if isinstance(texts, str):
            texts = [texts]
            single = True
        else:
            texts = list(texts)
            single = False

        if not texts:
            return np.empty((0, 384), dtype=np.float32)

        vectors = np.asarray(list(self._embedder.embed(texts)), dtype=np.float32)
        return vectors[0] if single else vectors


def get_model():
    """Lazy loader for the embedding model (FastEmbed ONNX first, SBERT fallback)."""
    global _model
    if _model is None:
        try:
            print("📥 Loading FastEmbed ONNX model (sentence-transformers/all-MiniLM-L6-v2)...")
            _model = _FastEmbedAdapter()
        except ImportError:
            print("📥 Loading Sentence Transformer model (all-MiniLM-L6-v2)...")
            from sentence_transformers import SentenceTransformer

            _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model


def calculate_match_score(resume_text, job_description_text):
    """
    Calculates the similarity percentage between a resume and a job description,
    applying a curve to account for boilerplate text.
    """
    if not resume_text or not job_description_text:
        return 0.0

    # 1. Convert the texts into mathematical vectors (embeddings)
    model_instance = get_model()
    embeddings = model_instance.encode([resume_text, job_description_text])

    resume_vector = embeddings[0].reshape(1, -1)
    job_desc_vector = embeddings[1].reshape(1, -1)

    # 2. Calculate the raw cosine similarity between the two vectors
    similarity_matrix = cosine_similarity(resume_vector, job_desc_vector)
    raw_score = similarity_matrix[0][0]

    # 3. Apply the ATS Curve
    curved_score = min(float(raw_score) * 100 * 1.55, 100.0)

    # 4. Round to 2 decimal places for a clean UI
    final_score = round(curved_score, 2)

    # Ensure it doesn't drop below 0
    return max(0.0, final_score)


def get_similarity_score(text1, text2):
    """Returns a raw 0-1 similarity score between two short strings."""
    if not text1 or not text2:
        return 0.0
    model_instance = get_model()
    emb = model_instance.encode([text1, text2])
    return float(cosine_similarity(emb[0].reshape(1, -1), emb[1].reshape(1, -1))[0][0])


def get_bulk_similarity(target_skills, candidate_skills):
    """
    Compares a list of target skills against a list of candidate skills in a single batch.
    Returns the raw NxM cosine similarity matrix.
    """
    if not target_skills or not candidate_skills:
        return []

    model_instance = get_model()
    target_embs = model_instance.encode(target_skills)
    candidate_embs = model_instance.encode(candidate_skills)

    sim_matrix = cosine_similarity(target_embs, candidate_embs)
    return sim_matrix
