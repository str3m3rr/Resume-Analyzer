import spacy
import pandas as pd
import os
import re

# Load the spaCy English language model
nlp = spacy.load("en_core_web_sm")

# Load skills database ONCE at module level (not per-call)
_skills_db_cache = None

def load_skills_database():
    """Loads the skills from our CSV file into a Python Set for fast searching."""
    global _skills_db_cache
    if _skills_db_cache is not None:
        return _skills_db_cache
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "..", "datasets", "skills_database.csv")
    
    try:
        df = pd.read_csv(csv_path)
        _skills_db_cache = set(df['skill'].dropna().str.lower().str.strip().tolist())
    except Exception as e:
        print(f"Warning: Could not load skills CSV. {e}")
        _skills_db_cache = {"python", "sql", "java", "react", "machine learning", "docker", "aws"}
    
    return _skills_db_cache

def extract_skills(text):
    """
    Extracts recognized skills from text using database matching.
    Prioritizes the curated skills database for accurate, clean results.
    Only uses NLP discovery for well-known technical patterns (C++, .NET, CamelCase).
    """
    skills_db = load_skills_database()
    text_lower = text.lower()
    extracted_skills = set()
    
    # --- 1. Primary: Database Matching (accurate, curated) ---
    for skill in skills_db:
        # Use word boundaries to avoid partial matches (e.g., "java" in "javascript")
        if re.search(rf'\b{re.escape(skill)}\b', text_lower):
            extracted_skills.add(skill.title())
    
    # --- 2. Secondary: Catch obvious technical patterns missed by database ---
    # Only specific well-known patterns, NOT generic acronyms
    tech_patterns = [
        r'\b\w+\+\+\b',            # C++ style
        r'\b\.\w{2,}\b',           # .NET, .js style (min 2 chars after dot)
        r'\b[A-Z][a-z]+[A-Z]\w+',  # CamelCase like JavaScript, GitHub, TypeScript
    ]
    
    for pattern in tech_patterns:
        matches = re.finditer(pattern, text)
        for match in matches:
            val = match.group().strip()
            # Only add if it's reasonably short (skill-like)
            if 2 <= len(val) <= 20:
                extracted_skills.add(val)

    # --- 3. Cleanup ---
    # Common noise words that slip through
    noise_words = {
        "The", "This", "That", "And", "With", "For", "From", "Our", "Your",
        "Will", "Can", "Has", "Have", "Are", "Was", "Were", "Been", "Being",
        "Must", "Should", "Would", "Could", "May", "Shall", "Its", "Inc",
        "Ltd", "Llc", "Co", "Corp", "New", "All", "Any", "Not", "But",
        "Also", "More", "Most", "Very", "Such", "Than", "Then", "Each",
        "Both", "Few", "Own", "Same", "Other", "Some", "Many", "Well",
        "Just", "Use", "Using", "Used", "Work", "Working", "Worked",
        "Team", "Role", "Job", "Position", "Company", "Experience",
        "Years", "Year", "Required", "Preferred", "Strong", "Ability",
        "Skills", "Knowledge", "Understanding", "Looking", "Seeking",
        "Responsible", "Responsibilities", "Qualifications", "Requirements",
        "Including", "Etc", "Pro", "Plus", "Senior", "Junior", "Lead",
        "Manager", "Engineer", "Developer", "Analyst", "Specialist",
        "Associate", "Intern", "Full", "Part", "Time", "Day", "Based",
        "University", "Degree", "Bachelor", "Master", "Phd", "Education",
    }
    
    final_skills = [
        s for s in extracted_skills 
        if len(s) > 1 and s not in noise_words and not s.isnumeric()
    ]
    
    return sorted(set(final_skills))