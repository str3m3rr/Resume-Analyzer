from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Load a lightweight, fast, and highly accurate pre-trained model
print("Loading Sentence Transformer model... (this might take a moment on the first run)")
model = SentenceTransformer('all-MiniLM-L6-v2')

def calculate_match_score(resume_text, job_description_text):
    """
    Calculates the similarity percentage between a resume and a job description,
    applying a curve to account for boilerplate text.
    """
    if not resume_text or not job_description_text:
        return 0.0

    # 1. Convert the texts into mathematical vectors (embeddings)
    embeddings = model.encode([resume_text, job_description_text])
    
    resume_vector = embeddings[0].reshape(1, -1)
    job_desc_vector = embeddings[1].reshape(1, -1)
    
    # 2. Calculate the raw cosine similarity between the two vectors
    similarity_matrix = cosine_similarity(resume_vector, job_desc_vector)
    raw_score = similarity_matrix[0][0]
    
    # 3. Apply the ATS Curve
    # Use a more lenient 1.4 multiplier to reward strong semantic alignment
    curved_score = min(float(raw_score) * 100 * 1.55, 100.0)
    
    # 4. Round to 2 decimal places for a clean UI
    final_score = round(curved_score, 2)
    
    # Ensure it doesn't drop below 0
    return max(0.0, final_score)

def get_similarity_score(text1, text2):
    """Returns a raw 0-1 similarity score between two short strings."""
    if not text1 or not text2: return 0.0
    emb = model.encode([text1, text2])
    return float(cosine_similarity(emb[0].reshape(1, -1), emb[1].reshape(1, -1))[0][0])

def get_bulk_similarity(target_skills, candidate_skills):
    """
    Compares a list of target skills against a list of candidate skills in a single batch.
    Returns a set of target skills that have a match > threshold in the candidate list.
    """
    if not target_skills or not candidate_skills:
        return []

    # 1. Batch encode both lists (High efficiency)
    target_embs = model.encode(target_skills)
    candidate_embs = model.encode(candidate_skills)
    
    # 2. Compute the full similarity matrix (NxM)
    # Result[i][j] = similarity between target[i] and candidate[j]
    sim_matrix = cosine_similarity(target_embs, candidate_embs)
    
    # Return the raw matrix so the caller can apply their own thresholds
    return sim_matrix