from skill_extractor import extract_skills
from similarity_model import get_bulk_similarity
import random

def generate_recommendations(resume_skills, job_description_text, strictness=50, uncovered_sentences=None, match_score=None, verb_analysis=None, coverage_percent=None):
    """
    Dynamic Advice Engine:
    - Extracts actual skills from the JD
    - Compares them against resume skills using semantic similarity
    - Generates context-aware, personalized advice based on the full analysis
    """
    if not uncovered_sentences:
        uncovered_sentences = []

    # --- Step 1: Extract skills from the full JD ---
    jd_skills = extract_skills(job_description_text)
    
    # Also extract skills from specifically uncovered sentences
    uncovered_skills = set()
    for sentence in uncovered_sentences:
        for sk in extract_skills(sentence):
            uncovered_skills.add(sk)
    
    all_jd_skills = list(set(jd_skills))
    
    if not all_jd_skills:
        return {
            "required_skills": [],
            "missing_skills": [],
            "recommendations": ["The job description doesn't contain recognizable technical skills. Try pasting a more detailed JD."]
        }
    
    # --- Step 2: Normalize skill names for comparison ---
    resume_skills_lower = [s.lower().strip() for s in resume_skills]
    
    # --- Step 3: Find truly missing skills ---
    final_missing = []
    
    # Similarity threshold based on strictness
    # Lenient (0): 0.45, Standard (50): 0.57, Brutal (100): 0.70
    threshold = 0.45 + (strictness / 100.0 * 0.25)
    
    # First pass: exact match check (fast)
    remaining_jd_skills = []
    matched_skills = []
    for skill in all_jd_skills:
        skill_lower = skill.lower().strip()
        if skill_lower in resume_skills_lower:
            matched_skills.append(skill)
            continue
        if any(skill_lower in rs or rs in skill_lower for rs in resume_skills_lower):
            matched_skills.append(skill)
            continue
        remaining_jd_skills.append(skill)
    
    # Second pass: semantic similarity for remaining skills
    if remaining_jd_skills and resume_skills:
        sim_matrix = get_bulk_similarity(remaining_jd_skills, resume_skills)
        
        for i, skill in enumerate(remaining_jd_skills):
            max_similarity = max(sim_matrix[i]) if len(sim_matrix[i]) > 0 else 0.0
            if max_similarity < threshold:
                final_missing.append(skill)
            else:
                matched_skills.append(skill)
    elif remaining_jd_skills and not resume_skills:
        final_missing = remaining_jd_skills
    
    # Deduplicate while preserving order
    seen = set()
    deduped_missing = []
    for skill in final_missing:
        key = skill.lower().strip()
        if key not in seen:
            seen.add(key)
            deduped_missing.append(skill)
    
    final_missing = deduped_missing
    
    # --- Step 4: Generate DYNAMIC recommendations ---
    recommendations = _generate_dynamic_advice(
        resume_skills=resume_skills,
        matched_skills=matched_skills,
        missing_skills=final_missing,
        all_jd_skills=all_jd_skills,
        match_score=match_score,
        verb_analysis=verb_analysis,
        coverage_percent=coverage_percent,
        strictness=strictness,
    )
    
    return {
        "required_skills": all_jd_skills,
        "missing_skills": final_missing,
        "recommendations": recommendations
    }


def _generate_dynamic_advice(resume_skills, matched_skills, missing_skills, all_jd_skills, match_score, verb_analysis, coverage_percent, strictness):
    """
    Generates personalized, context-aware advice based on the full analysis.
    No two analyses will produce the same generic advice.
    """
    advice = []
    
    # Calculate stats
    total_jd = len(all_jd_skills)
    total_matched = len(matched_skills)
    total_missing = len(missing_skills)
    match_ratio = total_matched / max(total_jd, 1)
    score = match_score or 0
    coverage = coverage_percent or 0
    
    # Verb analysis stats
    strong_verbs = []
    weak_verbs = []
    if verb_analysis:
        strong_verbs = verb_analysis.get("strong_verbs", [])
        weak_verbs = verb_analysis.get("weak_verbs", [])
    
    # ─── 1. SCORE-BASED ADVICE ───
    if score >= 85:
        advice.append({
            "type": "success",
            "title": "Excellent Match",
            "text": f"Your {score}% match score puts you in the top tier of candidates. Focus on tailoring your cover letter to stand out. Highlight 2-3 specific achievements that directly mirror the JD's priorities."
        })
    elif score >= 65:
        advice.append({
            "type": "info",
            "title": "Strong Foundation",
            "text": f"At {score}%, you have a solid base. To break into the 80%+ range, add concrete project examples for these key gaps: {', '.join(missing_skills[:3])}." if missing_skills else f"At {score}%, you're competitive. Try quantifying your achievements with numbers (revenue, users, percentage improvements) to push the score higher."
        })
    elif score >= 40:
        advice.append({
            "type": "warning",
            "title": "Moderate Alignment",
            "text": f"Your {score}% score suggests partial overlap. The JD emphasizes {total_jd} skills — you match {total_matched} of them. Consider a 'Skills' section at the top of your resume listing: {', '.join(missing_skills[:4])}." if missing_skills else f"Your {score}% score suggests room for improvement. Try restructuring your bullet points to directly mirror the JD's language."
        })
    else:
        advice.append({
            "type": "critical",
            "title": "Significant Gaps",
            "text": f"At {score}%, this role may require skills outside your current profile. You're missing {total_missing} of {total_jd} required skills. Consider gaining experience in {', '.join(missing_skills[:3])} through projects, courses, or certifications before applying."
        })
    
    # ─── 2. GAP-SPECIFIC ADVICE ───
    if total_missing > 0:
        if total_missing <= 2:
            advice.append({
                "type": "tip",
                "title": "Almost There",
                "text": f"You're only missing {total_missing} skill{'s' if total_missing > 1 else ''}: {', '.join(missing_skills)}. Even adding a personal project or online course mentioning {'these' if total_missing > 1 else 'this'} to your resume could close the gap."
            })
        elif total_missing <= 5:
            # Group missing skills into categories for actionable advice
            advice.append({
                "type": "action",
                "title": "Targeted Skill Building",
                "text": f"Focus on bridging these {total_missing} gaps: {', '.join(missing_skills)}. Prioritize the first 2-3 — even portfolio projects demonstrating these skills can significantly boost your match."
            })
        else:
            advice.append({
                "type": "action",
                "title": "Strategic Upskilling",
                "text": f"You're missing {total_missing} skills. Rather than trying to learn all of them, focus on the top 3 most impactful: {', '.join(missing_skills[:3])}. These appear most prominently in the JD's core requirements."
            })
    
    # ─── 3. COVERAGE-BASED ADVICE ───
    if coverage is not None:
        if coverage >= 80:
            advice.append({
                "type": "success",
                "title": "Strong JD Coverage",
                "text": f"Your resume addresses {coverage:.0f}% of the JD's requirements. Focus on making your existing matches more impactful — use the STAR method (Situation, Task, Action, Result) for your top bullet points."
            })
        elif coverage >= 50:
            advice.append({
                "type": "info",
                "title": "Partial JD Coverage",
                "text": f"You're covering {coverage:.0f}% of the JD. Look at the uncovered requirements in the XAI panel below — try mirroring the JD's exact phrasing in your resume. ATS systems reward keyword alignment."
            })
        elif coverage > 0:
            advice.append({
                "type": "warning",
                "title": "Low Requirement Coverage",
                "text": f"Only {coverage:.0f}% of the JD's requirements are addressed in your resume. Consider restructuring your experience section to directly address more of the listed requirements, even if indirectly."
            })
    
    # ─── 4. VERB ANALYSIS ADVICE ───
    if verb_analysis:
        strong_count = len(strong_verbs)
        weak_count = len(weak_verbs)
        
        if strong_count >= 5:
            advice.append({
                "type": "success",
                "title": "Powerful Language",
                "text": f"Great use of action verbs — you're using {strong_count} power verbs like '{', '.join(strong_verbs[:3])}'. This signals leadership and impact to recruiters."
            })
        elif weak_count > strong_count:
            weak_examples = weak_verbs[:3] if weak_verbs else ["worked", "helped", "did"]
            strong_suggestions = ["Spearheaded", "Architected", "Optimized", "Streamlined", "Orchestrated"]
            advice.append({
                "type": "tip",
                "title": "Upgrade Your Verbs",
                "text": f"Replace weak verbs like '{', '.join(weak_examples)}' with impact words: {', '.join(random.sample(strong_suggestions, min(3, len(strong_suggestions))))}. Strong verbs make your contributions sound decisive."
            })
    
    # ─── 5. SKILL COUNT ADVICE ───
    if len(resume_skills) < 5:
        advice.append({
            "type": "warning",
            "title": "Limited Skill Visibility",
            "text": f"Only {len(resume_skills)} skills detected in your resume. Add a dedicated 'Technical Skills' section near the top listing all relevant technologies, frameworks, and tools you've worked with."
        })
    elif len(resume_skills) > 20:
        advice.append({
            "type": "tip",
            "title": "Skill Prioritization",
            "text": f"Your resume lists {len(resume_skills)} skills — impressive but consider prioritizing. Place the {min(total_jd, 10)} skills from this JD first in your skills section for maximum ATS impact."
        })
    
    # ─── 6. MATCH RATIO INSIGHT ───
    if match_ratio >= 0.8 and total_missing > 0:
        advice.append({
            "type": "tip",
            "title": "Final Touch",
            "text": f"You match {total_matched}/{total_jd} required skills ({match_ratio*100:.0f}%). You're just {'1 skill' if total_missing == 1 else f'{total_missing} skills'} away from full alignment. This is worth applying for and mentioning your willingness to learn the remaining {'skill' if total_missing == 1 else 'skills'} in your cover letter."
        })
    
    # Ensure we always have at least 2 pieces of advice
    if len(advice) < 2:
        advice.append({
            "type": "tip",
            "title": "Pro Tip",
            "text": "Tailor your resume for each application. Mirror the JD's exact terminology — if they say 'CI/CD pipelines', don't just write 'deployment automation'. ATS systems match on exact phrases."
        })
    
    return advice