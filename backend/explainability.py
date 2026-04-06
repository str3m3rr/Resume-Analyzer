"""
Explainability Engine (XAI) for Resume Analyzer
================================================
Uses cross-attention matrices between resume and JD sentences
to explain WHY the match score is what it is.

Improved: JD coverage now filters out non-skill sentences
(like "we offer competitive benefits") so the percentage
reflects actual technical requirement coverage.
"""

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import spacy
import re

# Reuse the same model that similarity_model.py uses
model = SentenceTransformer('all-MiniLM-L6-v2')

# Load spaCy for sentence segmentation
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    import subprocess, sys
    subprocess.run([sys.executable, "-m", "spacy", "download", "en_core_web_sm"])
    nlp = spacy.load("en_core_web_sm")

# Import skill extractor to identify skill-bearing sentences
from skill_extractor import extract_skills


def split_into_sentences(text):
    """
    Splits text into clean sentences using spaCy's sentence segmenter.
    Falls back to regex if spaCy produces too few splits.
    """
    doc = nlp(text)
    sentences = [sent.text.strip() for sent in doc.sents if len(sent.text.strip()) > 15]
    
    # Fallback: if spaCy gives us too few sentences, use regex
    if len(sentences) < 3:
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 15]
    
    return sentences


def _is_skill_relevant_sentence(sentence):
    """
    Determines if a JD sentence contains actual skills/requirements
    vs. fluff like 'we are an equal opportunity employer' or 'benefits include...'
    """
    # Check if the sentence contains any recognized skills
    skills = extract_skills(sentence)
    if skills:
        return True
    
    # Also check for requirement-indicator keywords
    requirement_keywords = [
        r'\bexperience\b', r'\bproficien', r'\bknowledge\b', r'\bfamiliar',
        r'\bunderstanding\b', r'\bability\b', r'\bskill', r'\bexpertise\b',
        r'\bcertif', r'\bdegree\b', r'\bbackground\b', r'\brequire',
        r'\bqualif', r'\bmust have\b', r'\bnice to have\b', r'\bpreferred\b',
        r'\byears?\b.*\bexperience\b', r'\bhands-on\b', r'\bworking knowledge\b',
    ]
    
    sentence_lower = sentence.lower()
    for pattern in requirement_keywords:
        if re.search(pattern, sentence_lower):
            return True
    
    return False


def build_cross_attention_matrix(resume_text, jd_text, strictness=50):
    """
    Builds the full cross-attention matrix between resume and JD sentences.
    
    Key improvement: JD coverage only considers skill-relevant sentences,
    so "we offer great benefits" doesn't tank your coverage percentage.
    """
    # Step 1: Sentence segmentation
    resume_sentences = split_into_sentences(resume_text)
    jd_sentences = split_into_sentences(jd_text)
    
    if not resume_sentences or not jd_sentences:
        return _empty_result()
    
    # Step 2: Encode all sentences into embedding vectors
    resume_embeddings = model.encode(resume_sentences)
    jd_embeddings = model.encode(jd_sentences)
    
    # Step 3: Build the NxM attention matrix
    attention_matrix = cosine_similarity(resume_embeddings, jd_embeddings)
    
    # Step 4: Extract insights
    
    # --- Top-K Matches ---
    top_matches = _extract_top_matches(
        attention_matrix, resume_sentences, jd_sentences, k=10
    )
    
    # --- Per-resume-sentence contribution score ---
    resume_contributions = []
    for i, sentence in enumerate(resume_sentences):
        max_sim = float(np.max(attention_matrix[i]))
        avg_sim = float(np.mean(attention_matrix[i]))
        best_jd_idx = int(np.argmax(attention_matrix[i]))
        
        resume_contributions.append({
            "sentence": sentence,
            "max_score": round(max_sim * 100, 1),
            "avg_score": round(avg_sim * 100, 1),
            "best_match_jd": jd_sentences[best_jd_idx],
            "strength": _classify_strength(max_sim)
        })
    
    resume_contributions.sort(key=lambda x: x["max_score"], reverse=True)
    for rank, item in enumerate(resume_contributions, 1):
        item["rank"] = rank
    
    # --- JD Coverage (filtered to skill-relevant sentences only) ---
    # Compressed range for gradual slider effect:
    # Lenient (0): 0.35, Standard (50): 0.40, Brutal (100): 0.45
    coverage_threshold = 0.35 + (strictness / 100.0 * 0.10)
    
    print(f"\n{'='*60}")
    print(f"DEBUG: Strictness={strictness}, Coverage Threshold={coverage_threshold:.3f}")
    print(f"DEBUG: JD sentences count={len(jd_sentences)}")
    print(f"{'='*60}")
    
    jd_coverage = []
    jd_coverage_relevant_count = 0
    jd_coverage_covered_count = 0
    
    for j, sentence in enumerate(jd_sentences):
        best_resume_score = float(np.max(attention_matrix[:, j]))
        best_resume_idx = int(np.argmax(attention_matrix[:, j]))
        is_relevant = _is_skill_relevant_sentence(sentence)
        is_covered = best_resume_score >= coverage_threshold
        
        # Debug: print each JD sentence's score
        print(f"  JD[{j}] score={best_resume_score:.3f} relevant={is_relevant} covered={is_covered} | {sentence[:60]}...")
        
        entry = {
            "sentence": sentence,
            "best_match_score": round(best_resume_score * 100, 1),
            "best_match_resume": resume_sentences[best_resume_idx],
            "covered": is_covered,
            "is_relevant": is_relevant,
            "strength": _classify_strength(best_resume_score)
        }
        jd_coverage.append(entry)
        
        # Only count relevant sentences toward coverage %
        if is_relevant:
            jd_coverage_relevant_count += 1
            if is_covered:
                jd_coverage_covered_count += 1
    
    print(f"\nDEBUG: Relevant={jd_coverage_relevant_count}, Covered={jd_coverage_covered_count}")
    
    # Sort: uncovered relevant items first
    jd_coverage.sort(key=lambda x: (x["is_relevant"], x["best_match_score"]))
    
    # --- Summary Statistics (based on relevant sentences only) ---
    if jd_coverage_relevant_count > 0:
        overall_coverage = (jd_coverage_covered_count / jd_coverage_relevant_count) * 100
    else:
        overall_coverage = 100.0  # No relevant JD sentences = nothing to cover
    
    print(f"DEBUG: Final coverage = {overall_coverage:.1f}%")
    print(f"{'='*60}\n")
    
    strong_matches = sum(1 for m in top_matches if m["similarity"] > 50)
    
    return {
        "top_matches": top_matches,
        "resume_contributions": resume_contributions,
        "jd_coverage": jd_coverage,
        "summary": {
            "total_resume_sentences": len(resume_sentences),
            "total_jd_sentences": len(jd_sentences),
            "relevant_jd_sentences": jd_coverage_relevant_count,
            "jd_coverage_percent": round(overall_coverage, 1),
            "strong_match_count": strong_matches,
            "weak_areas_count": sum(1 for item in jd_coverage if item["is_relevant"] and not item["covered"])
        }
    }


def _extract_top_matches(matrix, resume_sentences, jd_sentences, k=10):
    """
    Extracts the top-k highest scoring (resume, JD) sentence pairs.
    """
    rows, cols = matrix.shape
    flat_scores = []
    for i in range(rows):
        for j in range(cols):
            flat_scores.append((float(matrix[i][j]), i, j))
    
    flat_scores.sort(key=lambda x: x[0], reverse=True)
    
    top_matches = []
    seen_pairs = set()
    
    for score, r_idx, j_idx in flat_scores:
        if len(top_matches) >= k:
            break
        if r_idx in seen_pairs:
            continue
        seen_pairs.add(r_idx)
        
        top_matches.append({
            "resume_sentence": resume_sentences[r_idx],
            "jd_sentence": jd_sentences[j_idx],
            "similarity": round(score * 100, 1),
            "strength": _classify_strength(score)
        })
    
    return top_matches


def _classify_strength(score):
    """Classifies a similarity score into a human-readable strength label."""
    if score >= 0.55:
        return "strong"
    elif score >= 0.38:
        return "moderate"
    elif score >= 0.25:
        return "weak"
    else:
        return "gap"


def _empty_result():
    """Returns an empty result structure when text is too short to analyze."""
    return {
        "top_matches": [],
        "resume_contributions": [],
        "jd_coverage": [],
        "summary": {
            "total_resume_sentences": 0,
            "total_jd_sentences": 0,
            "relevant_jd_sentences": 0,
            "jd_coverage_percent": 0,
            "strong_match_count": 0,
            "weak_areas_count": 0
        }
    }
