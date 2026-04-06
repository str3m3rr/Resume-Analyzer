import spacy
import re
import subprocess
import sys

# Global NLP variable
_nlp = None

def get_nlp():
    """Lazy loader for the spaCy model to save memory and speed up startup."""
    global _nlp
    if _nlp is None:
        print("📥 Loading spaCy English model (en_core_web_sm)...")
        import spacy
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            print("Downloading spaCy English model for the first time...")
            import subprocess
            import sys
            subprocess.run([sys.executable, "-m", "spacy", "download", "en_core_web_sm"])
            _nlp = spacy.load("en_core_web_sm")
    return _nlp

def extract_personal_info(text):
    """Scans the document to find contact information."""
    # Regex for Email and Phone
    email = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', text)
    phone = re.search(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{1,3}[-.\s]?\d{10}', text)
    
    # NLP for finding names (just scanning the first 1000 characters for speed)
    nlp_instance = get_nlp()
    doc = nlp_instance(text[:1000])
    names = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
    
    return {
        "name": names[0] if names else "Candidate",
        "email": email.group(0) if email else "Not Found",
        "phone": phone.group(0) if phone else "Not Found"
    }

def analyze_action_verbs(text):
    """Scores how strong the bullet points are based on 'power verbs'."""
    nlp_instance = get_nlp()
    doc = nlp_instance(text)
    # Find all verbs in the document
    verbs = [token.lemma_.lower() for token in doc if token.pos_ == "VERB"]
    
    # A dictionary of strong engineering/leadership verbs
    power_verbs = {"developed", "engineered", "optimized", "managed", "led", "designed", "implemented", "created", "architected", "spearheaded", "integrated"}
    
    # Find the overlap
    found_power_verbs = list(set(verbs).intersection(power_verbs))
    
    # Give them a score out of 100 based on how many power verbs they used
    score = min(len(found_power_verbs) * 15, 100) 
    
    return {
        "power_verbs_used": found_power_verbs,
        "verb_impact_score": score
    }

def apply_anti_bias(text):
    """Redacts Names, Universities, and Locations to prevent AI bias."""
    nlp_instance = get_nlp()
    doc = nlp_instance(text)
    redacted_text = text
    # Loop backward so replacing text doesn't mess up the string indexes
    for ent in reversed(doc.ents):
        if ent.label_ in ["PERSON", "ORG", "GPE"]: 
            redacted_text = redacted_text[:ent.start_char] + f"[{ent.label_} REDACTED]" + redacted_text[ent.end_char:]
    
    # Scrub out emails and phones too
    redacted_text = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '[EMAIL REDACTED]', redacted_text)
    redacted_text = re.sub(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{1,3}[-.\s]?\d{10}', '[PHONE REDACTED]', redacted_text)
    
    return redacted_text

def calculate_skill_proximity(detected_skills, missing_skills):
    """
    Creates a REAL semantic skill network using Sentence-BERT embeddings.
    
    Instead of hardcoded edges, we:
    1. Embed every skill using the same model as the similarity engine
    2. Compute pairwise cosine similarity between ALL skills
    3. Only draw edges where similarity > threshold (real connections)
    4. Edge thickness = similarity strength
    """
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    
    all_skills = list(detected_skills) + list(missing_skills)
    
    if len(all_skills) < 2:
        return {"nodes": [{"id": s, "group": "have"} for s in detected_skills] + 
                         [{"id": s, "group": "need"} for s in missing_skills], 
                "links": []}
    
    # Load the model (cached after first call via the global getter)
    from similarity_model import get_model
    model_instance = get_model()
    
    # Embed all skill names into vectors
    embeddings = model_instance.encode(all_skills)
    
    # Compute pairwise similarity matrix
    sim_matrix = cosine_similarity(embeddings)
    
    # Build nodes with similarity-based sizing
    nodes = []
    for i, skill in enumerate(all_skills):
        group = "have" if skill in detected_skills else "need"
        # Node size = average similarity to other skills (more connected = bigger)
        avg_sim = float(np.mean(sim_matrix[i]))
        nodes.append({
            "id": skill, 
            "group": group,
            "connectivity": round(avg_sim * 10, 2)  # Scale for the graph
        })
    
    # Build edges — only where similarity exceeds threshold
    links = []
    THRESHOLD = 0.25  # Only draw edges for meaningful connections
    
    for i in range(len(all_skills)):
        for j in range(i + 1, len(all_skills)):
            sim = float(sim_matrix[i][j])
            if sim > THRESHOLD:
                links.append({
                    "source": all_skills[i],
                    "target": all_skills[j],
                    "value": round(sim, 3)  # Real similarity score for edge thickness
                })
    
    return {"nodes": nodes, "links": links}