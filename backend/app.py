from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import io

# Import your core ML modules
from resume_parser import extract_text_from_pdf
from skill_extractor import extract_skills
from similarity_model import calculate_match_score
from recommendation_engine import generate_recommendations

# Import the new advanced NLP features!
from nlp_analyzer import extract_personal_info, analyze_action_verbs, apply_anti_bias, calculate_skill_proximity

# Import research-grade XAI and Bias Auditing engines
from explainability import build_cross_attention_matrix
from bias_auditor import audit_job_description, run_adversarial_fairness_test

app = FastAPI(title="AI Resume Analyzer API")

# Update CORS for production
# In production, Replace "*" with your actual frontend domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.5.0"}

@app.post("/api/analyze")
async def analyze_resume(
    resume: UploadFile = File(...),
    job_description: str = Form(...),
    anti_bias_mode: bool = Form(False),
    strictness: int = Form(50)
):
    if resume.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    try:
        # 1. Read the PDF file safely from memory
        pdf_bytes = await resume.read()
        pdf_file = io.BytesIO(pdf_bytes)
        raw_text = extract_text_from_pdf(pdf_file)
        
        # 2. Apply Anti-Bias Masking if enabled
        processing_text = apply_anti_bias(raw_text) if anti_bias_mode else raw_text
        
        # 3. Extract Data
        detected_skills = extract_skills(processing_text)
        personal_info = extract_personal_info(raw_text) 
        verb_analysis = analyze_action_verbs(processing_text)
        
        # 4. XAI: Build the cross-attention explainability matrix (Dynamic Coverage)
        # We do this FIRST now to identify uncovered sentences
        explainability_data = build_cross_attention_matrix(processing_text, job_description, strictness)
        uncovered_sentences = [
            item["sentence"] for item in explainability_data["jd_coverage"] if not item["covered"]
        ]
        
        # 5. Calculate Match Score FIRST (needed for dynamic advice)
        match_score = calculate_match_score(processing_text, job_description)
        
        # Apply Strictness Modifier (0=Lenient, 50=Standard, 100=Brutal)
        score_modifier = (strictness - 50) / 50.0
        
        if score_modifier > 0:
            match_score = max(0, int(match_score * (1.0 - (0.2 * score_modifier))))
        else:
            match_score = min(100, int(match_score * (1.0 - (0.3 * score_modifier))))
        
        # 6. Generate Recommendations & Missing Skills (Dynamic Advice Engine)
        coverage_percent = explainability_data["summary"]["jd_coverage_percent"]
        analysis = generate_recommendations(
            detected_skills, job_description, strictness, uncovered_sentences,
            match_score=match_score,
            verb_analysis=verb_analysis,
            coverage_percent=coverage_percent,
        )
        missing_skills = analysis["missing_skills"]

        # 6b. SYNC: Connect gaps back to JD coverage
        missing_lower = [s.lower() for s in missing_skills]
        recalc_relevant = 0
        recalc_covered = 0
        for item in explainability_data["jd_coverage"]:
            if item.get("is_relevant"):
                sentence_lower = item["sentence"].lower()
                has_gap = any(ms in sentence_lower for ms in missing_lower)
                if has_gap:
                    item["covered"] = False
                    item["strength"] = "gap"
                recalc_relevant += 1
                if item["covered"]:
                    recalc_covered += 1
        
        if recalc_relevant > 0:
            explainability_data["summary"]["jd_coverage_percent"] = round(
                (recalc_covered / recalc_relevant) * 100, 1
            )
            explainability_data["summary"]["weak_areas_count"] = recalc_relevant - recalc_covered
        
        # 7. Generate the Proximity Graph data
        proximity_graph = calculate_skill_proximity(detected_skills, analysis["missing_skills"])
            
        return {
            "status": "success",
            "is_blind_screened": anti_bias_mode,
            "match_score": match_score,
            "detected_skills": detected_skills,
            "missing_skills": analysis["missing_skills"],
            "recommendations": analysis["recommendations"],
            "personal_info": personal_info,  
            "verb_analysis": verb_analysis,
            "proximity_graph": proximity_graph,
            "extracted_text": processing_text,
            "explainability": explainability_data
        }
    except Exception as e:
        print(f"BACKEND ERROR: {str(e)}") # This will print exact errors to your terminal
        raise HTTPException(status_code=500, detail=str(e))
from pydantic import BaseModel
from llm_rewriter import rewrite_bullet_point
from rag_engine import initialize_memory, retrieve_relevant_memory # <-- IMPORT ADDED HERE
import os

# Boot up the Vector DB when the app starts
initialize_memory()

# Create a data model for the incoming React request
class RewriteRequest(BaseModel):
    original_bullet: str
    target_skill: str
    job_role: str

@app.post("/api/rewrite")
async def rewrite_resume_bullet(request: RewriteRequest):
    # Security check: Make sure we have the API key!
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Groq API key is missing from the server.")
        
    try:
        # 1. Search the Vector DB for the missing skill
        print(f"Searching memory for: {request.target_skill}")
        memory = retrieve_relevant_memory(request.target_skill)
        print(f"Retrieved Memory: {memory}")

        # 2. Pass the original text, the skill, AND the memory to Groq
        new_bullet = rewrite_bullet_point(
            request.original_bullet, 
            request.target_skill, 
            request.job_role,
            api_key,
            memory # <-- INJECTING THE RAG CONTEXT HERE!
        )
        return {"status": "success", "rewritten_text": new_bullet}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from tasks import hunt_jobs
from celery.result import AsyncResult

@app.post("/api/hunt")
async def start_hunt(request: dict):
    # This triggers the task in the background and returns immediately
    task = hunt_jobs.delay(request['resume_text'])
    return {"status": "Hunting started", "task_id": task.id}

@app.get("/api/hunt-results/{task_id}")
async def get_hunt_results(task_id: str):
    """Poll for hunt mode results by task ID."""
    result = AsyncResult(task_id, app=hunt_jobs.app)
    
    if result.state == "PENDING":
        return {"status": "pending", "message": "Still hunting..."}
    elif result.state == "STARTED":
        return {"status": "running", "message": "Scraping job boards..."}
    elif result.state == "SUCCESS":
        return {"status": "complete", "data": result.result}
    elif result.state == "FAILURE":
        return {"status": "failed", "message": str(result.info)}


# ============================================================================
# BIAS AUDITING ENDPOINT (Research-Grade Fairness Analysis)
# ============================================================================

class BiasAuditRequest(BaseModel):
    job_description: str
    resume_text: str = None  # Optional: needed for adversarial model testing

@app.post("/api/bias-audit")
async def bias_audit(request: BiasAuditRequest):
    """
    Performs a comprehensive bias audit on the job description.
    If resume_text is provided, also runs adversarial fairness testing
    on the ML model to check for demographic scoring bias.
    """
    try:
        # 1. Audit the JD for linguistic bias
        jd_report = audit_job_description(request.job_description)
        
        # 2. If resume text is provided, run the adversarial model test
        model_fairness = None
        if request.resume_text:
            model_fairness = run_adversarial_fairness_test(
                request.resume_text, request.job_description
            )
        
        return {
            "status": "success",
            "jd_bias_report": jd_report,
            "model_fairness": model_fairness,
        }
    except Exception as e:
        print(f"BIAS AUDIT ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))