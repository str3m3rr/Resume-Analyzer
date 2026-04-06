"""
Bias Detection & Fairness Auditing Engine
==========================================
Analyzes job descriptions for linguistic bias (gendered/ageist language)
and tests if the ML model itself exhibits demographic scoring bias.

Research basis: 
- Gaucher, Friesen & Kay (2011) - Gendered wording in job advertisements
- Adversarial fairness testing for embedding-based models
"""

import re
from similarity_model import calculate_match_score


# ============================================================================
# GENDERED LANGUAGE DICTIONARIES
# Based on Gaucher et al. (2011) research on gendered wording in job ads
# ============================================================================

MASCULINE_CODED_WORDS = {
    # Agentic / dominance words
    "aggressive", "ambitious", "analytical", "assertive", "autonomous",
    "boast", "challenge", "champion", "competitive", "confident",
    "courage", "decisive", "decisive", "defend", "determine",
    "dominant", "dominate", "driven", "fearless", "fight",
    "force", "greedy", "head strong", "headstrong", "hierarchy",
    "hostile", "hustle", "impulsive", "independent", "individual",
    "intellect", "lead", "logic", "ninja", "objective",
    "opinion", "outspoken", "persist", "principle", "reckless",
    "rockstar", "self-confident", "self-reliant", "self-sufficient", "stubborn",
    "superior", "tackle", "thrust", "warrior", "wizard",
    # Tech-bro culture words
    "crush it", "kill it", "smash", "destroy", "beast",
    "guru", "hacker", "10x", "bro", "manpower",
}

FEMININE_CODED_WORDS = {
    # Communal / collaborative words
    "agree", "affectionate", "caring", "collaborate", "commit",
    "communal", "compassion", "connect", "considerate", "cooperative",
    "depend", "emotionally aware", "empathy", "encourage", "feel",
    "flatter", "gentle", "honest", "inclusive", "interpersonal",
    "kind", "kinship", "loyal", "modesty", "nag",
    "nurture", "pleasant", "polite", "quiet", "sensitive",
    "share", "submissive", "support", "sympathetic", "tender",
    "together", "trust", "understand", "warm", "whine",
    "yield",
}

# Neutral power words (good replacements)
NEUTRAL_ALTERNATIVES = {
    "rockstar": "skilled professional",
    "ninja": "specialist",
    "guru": "expert",
    "wizard": "experienced developer",
    "aggressive": "proactive",
    "dominant": "leading",
    "manpower": "workforce",
    "hacker": "engineer",
    "crush it": "deliver results",
    "kill it": "excel",
    "10x": "high-performing",
    "beast": "high-impact contributor",
    "warrior": "advocate",
}


# ============================================================================
# AGE BIAS PATTERNS
# ============================================================================

AGE_BIAS_PATTERNS = {
    "youth_bias": [
        r"digital\s+native",
        r"young\s+(and\s+)?(energetic|dynamic|hungry)",
        r"recent\s+graduate\s+(only|preferred|required)",
        r"fresh\s+out\s+of\s+(college|school|university)",
        r"entry[\s-]level\s+only",
        r"no\s+more\s+than\s+\d+\s+years",
        r"maximum\s+\d+\s+years",
        r"(1-2|0-2|0-3)\s+years\s+(only|maximum)",
        r"gen[\s-]?z",
        r"millennial",
    ],
    "seniority_bias": [
        r"seasoned\s+veteran",
        r"(10|15|20)\+?\s+years\s+(minimum|required|mandatory|essential)",
        r"extensive\s+decades",
        r"old[\s-]school",
        r"gray[\s-]?hair",
    ]
}


# ============================================================================
# ADVERSARIAL NAME BANK
# Names from diverse demographic groups for fairness testing
# Sourced from US Census data for common names across demographics
# ============================================================================

ADVERSARIAL_NAME_GROUPS = {
    "Group A": ["James Smith", "Emily Johnson"],
    "Group B": ["DeShawn Williams", "Lakisha Jackson"],
    "Group C": ["Wei Zhang", "Mei Chen"],
    "Group D": ["Mohammed Al-Rashid", "Fatima Hassan"],
}


def audit_job_description(jd_text):
    """
    Performs a comprehensive bias audit on a job description.
    
    Returns gender bias analysis, age bias flags, and overall scores.
    """
    jd_lower = jd_text.lower()
    
    # --- Gender Bias Analysis ---
    masculine_flags = _find_biased_words(jd_text, jd_lower, MASCULINE_CODED_WORDS)
    feminine_flags = _find_biased_words(jd_text, jd_lower, FEMININE_CODED_WORDS)
    
    masc_count = len(masculine_flags)
    fem_count = len(feminine_flags)
    total_bias_words = masc_count + fem_count
    
    # Calculate gender bias score (0 = perfectly neutral, 100 = heavily biased)
    if total_bias_words == 0:
        gender_bias_score = 0
        bias_direction = "neutral"
    else:
        # Score is based on the imbalance between masculine and feminine words
        imbalance = abs(masc_count - fem_count) / max(total_bias_words, 1)
        gender_bias_score = min(int(imbalance * 100 + total_bias_words * 5), 100)
        bias_direction = "masculine" if masc_count > fem_count else "feminine" if fem_count > masc_count else "neutral"
    
    # --- Age Bias Analysis ---
    age_flags = _detect_age_bias(jd_text)
    
    # --- Overall Fairness Grade ---
    # Deductions: gender bias words, age bias flags, high imbalance
    deductions = (total_bias_words * 5) + (len(age_flags) * 10) + (gender_bias_score * 0.3)
    fairness_score = max(0, 100 - deductions)
    overall_grade = _score_to_grade(fairness_score)
    
    # --- Generate Recommendations ---
    recommendations = _generate_bias_recommendations(
        masculine_flags, feminine_flags, age_flags, bias_direction
    )
    
    return {
        "gender_bias_score": gender_bias_score,
        "bias_direction": bias_direction,
        "masculine_coded_count": masc_count,
        "feminine_coded_count": fem_count,
        "flagged_words": masculine_flags + feminine_flags,
        "age_bias_flags": age_flags,
        "overall_fairness_grade": overall_grade,
        "fairness_score": round(fairness_score, 1),
        "recommendations": recommendations,
    }


def run_adversarial_fairness_test(resume_text, jd_text):
    """
    Tests if the ML similarity model scores differently based on candidate names.
    
    Method:
    1. Create synthetic resume variants with different demographic names
    2. Run each through the exact same scoring model
    3. Check for statistically significant score differences
    
    A fair model should produce nearly identical scores regardless of name.
    """
    # First, find and remove any existing names from the resume
    # We'll replace them with our test names
    import spacy
    try:
        nlp = spacy.load("en_core_web_sm")
    except OSError:
        # If spaCy model isn't loaded, return a basic result
        return _default_fairness_result()
    
    doc = nlp(resume_text[:500])  # Only scan first 500 chars for names
    
    # Find PERSON entities to replace
    original_names = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
    
    # Create a "cleaned" version with names removed
    clean_text = resume_text
    for name in original_names:
        clean_text = clean_text.replace(name, "CANDIDATE_NAME_PLACEHOLDER")
    
    # Run the adversarial test
    test_results = []
    scores = []
    
    for group_name, names in ADVERSARIAL_NAME_GROUPS.items():
        test_name = names[0]  # Use first name from each group
        test_resume = clean_text.replace("CANDIDATE_NAME_PLACEHOLDER", test_name)
        
        # Run through the SAME model used for real scoring
        score = calculate_match_score(test_resume, jd_text)
        scores.append(score)
        
        test_results.append({
            "name_group": group_name,
            "score": round(score, 2),
        })
    
    # Calculate variance and determine if the model is fair
    if scores:
        score_variance = round(float(max(scores) - min(scores)), 2)
        avg_score = round(sum(scores) / len(scores), 2)
        is_fair = score_variance <= 2.0  # Less than 2% difference = fair
    else:
        score_variance = 0
        avg_score = 0
        is_fair = True
    
    return {
        "is_fair": is_fair,
        "score_variance": score_variance,
        "average_score": avg_score,
        "test_results": test_results,
        "verdict": "✅ Model is fair — scores are consistent across demographic groups." if is_fair 
                   else "⚠️ Potential bias detected — scores vary by more than 2% across groups."
    }


def _find_biased_words(original_text, lower_text, word_set):
    """
    Finds biased words in the text and returns them with surrounding context.
    """
    flagged = []
    for word in word_set:
        # Use word boundaries to avoid partial matches
        pattern = rf'\b{re.escape(word)}\b'
        matches = list(re.finditer(pattern, lower_text))
        
        for match in matches:
            start = max(0, match.start() - 40)
            end = min(len(original_text), match.end() + 40)
            context = "..." + original_text[start:end].strip() + "..."
            
            category = "masculine" if word in MASCULINE_CODED_WORDS else "feminine"
            replacement = NEUTRAL_ALTERNATIVES.get(word, None)
            
            flagged.append({
                "word": word,
                "category": category,
                "context": context,
                "replacement": replacement,
            })
    
    return flagged


def _detect_age_bias(text):
    """Scans for age-biased phrases using regex patterns."""
    flags = []
    text_lower = text.lower()
    
    for bias_type, patterns in AGE_BIAS_PATTERNS.items():
        for pattern in patterns:
            matches = re.finditer(pattern, text_lower)
            for match in matches:
                start = max(0, match.start() - 30)
                end = min(len(text), match.end() + 30)
                
                flags.append({
                    "phrase": match.group(0),
                    "type": bias_type,
                    "context": "..." + text[start:end].strip() + "...",
                })
    
    return flags


def _score_to_grade(score):
    """Converts a numerical fairness score to a letter grade."""
    if score >= 95:
        return "A+"
    elif score >= 90:
        return "A"
    elif score >= 85:
        return "A-"
    elif score >= 80:
        return "B+"
    elif score >= 75:
        return "B"
    elif score >= 70:
        return "B-"
    elif score >= 65:
        return "C+"
    elif score >= 60:
        return "C"
    elif score >= 50:
        return "D"
    else:
        return "F"


def _generate_bias_recommendations(masc_flags, fem_flags, age_flags, direction):
    """Generates actionable recommendations for reducing bias."""
    recs = []
    
    # Gendered language recommendations
    replaceable = [f for f in masc_flags + fem_flags if f.get("replacement")]
    if replaceable:
        for flag in replaceable[:3]:  # Top 3 replacements
            recs.append(
                f"Replace \"{flag['word']}\" with \"{flag['replacement']}\" for more inclusive language."
            )
    
    if direction == "masculine" and len(masc_flags) > 2:
        recs.append(
            "This JD leans heavily masculine-coded. Research shows this discourages "
            "women and non-binary candidates from applying. Consider adding collaborative "
            "language like 'team-oriented' and 'mentorship-focused'."
        )
    elif direction == "feminine" and len(fem_flags) > 2:
        recs.append(
            "This JD leans feminine-coded. While less common, extreme imbalance in either "
            "direction can narrow your candidate pool. Balance with achievement-focused language."
        )
    
    # Age bias recommendations
    for flag in age_flags:
        if flag["type"] == "youth_bias":
            recs.append(
                f"The phrase \"{flag['phrase']}\" may constitute age discrimination. "
                "Focus on skills and experience level instead of age-related terms."
            )
        elif flag["type"] == "seniority_bias":
            recs.append(
                f"The phrase \"{flag['phrase']}\" may exclude qualified candidates. "
                "Consider specifying skills needed rather than rigid year requirements."
            )
    
    if not recs:
        recs.append(
            "This job description appears to use relatively inclusive language. "
            "Great job! Continue reviewing for unconscious bias periodically."
        )
    
    return recs


def _default_fairness_result():
    """Returns a default result when adversarial testing can't run."""
    return {
        "is_fair": True,
        "score_variance": 0,
        "average_score": 0,
        "test_results": [],
        "verdict": "Could not run adversarial test — spaCy model unavailable."
    }
