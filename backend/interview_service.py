"""Free/open interview generation and scoring service.

Groq is optional. When GROQ_API_KEY is absent, the deterministic evaluator keeps
the feature usable in local/offline development.
"""
import json
import os
import uuid
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field, model_validator


class InterviewStartRequest(BaseModel):
    resume: Optional[str] = ""
    jd: Optional[str] = ""
    job_description: Optional[str] = None
    jobDescription: Optional[str] = None
    difficulty: Optional[str] = "medium"
    question_count: Optional[int] = 5
    questions: Optional[List[Dict[str, Any]]] = None
    preloaded_questions: Optional[List[Dict[str, Any]]] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            jd_val = data.get("jd") or data.get("job_description") or data.get("jobDescription") or ""
            resume_val = data.get("resume") or data.get("extracted_text") or data.get("resume_text") or ""
            diff = data.get("difficulty") or "medium"
            qc = data.get("question_count") or data.get("questionCount") or 5
            qs = data.get("questions") or data.get("preloaded_questions")
            return {
                **data,
                "jd": str(jd_val) if jd_val is not None else "",
                "resume": str(resume_val) if resume_val is not None else "",
                "difficulty": str(diff).lower() if diff else "medium",
                "question_count": int(qc) if qc else 5,
                "questions": qs if isinstance(qs, list) else None,
            }
        return data


class InterviewTurnRequest(BaseModel):
    session_id: Optional[str] = None
    resume: Optional[str] = ""
    jd: Optional[str] = ""
    agenda: Optional[List[Dict[str, Any]]] = None
    current_index: Optional[int] = 0
    history: Optional[List[Dict[str, Any]]] = None
    candidate_answer: Optional[str] = ""

    @model_validator(mode="before")
    @classmethod
    def normalize_turn(cls, data: Any) -> Any:
        if isinstance(data, dict):
            agenda = data.get("agenda")
            history = data.get("history")
            return {
                **data,
                "session_id": str(data.get("session_id") or uuid.uuid4()),
                "resume": str(data.get("resume") or ""),
                "jd": str(data.get("jd") or "General Software Role"),
                "agenda": agenda if isinstance(agenda, list) else [],
                "current_index": int(data.get("current_index") or 0),
                "history": history if isinstance(history, list) else [],
                "candidate_answer": str(data.get("candidate_answer") or ""),
            }
        return data


def _fallback_multi_tier_pool(
    resume: str,
    jd: str,
    detected_skills: List[str] = None,
    missing_skills: List[str] = None,
) -> Dict[str, List[Dict[str, Any]]]:
    detected = detected_skills or []
    missing = missing_skills or []
    s1 = detected[0] if len(detected) > 0 else "Python"
    s2 = detected[1] if len(detected) > 1 else "REST APIs"
    s3 = detected[2] if len(detected) > 2 else "Databases"
    m1 = missing[0] if len(missing) > 0 else "System Optimization"
    m2 = missing[1] if len(missing) > 1 else "Cloud Deployment"
    focus_jd = jd.replace("\n", " ").strip()[:90]

    return {
        "easy": [
            {"type": "conceptual", "text": f"Walk me through your hands-on experience using {s1} and what you consider its greatest strengths.", "focus": s1, "difficulty": "easy"},
            {"type": "resume_check", "text": f"Can you highlight a recent project on your resume where you implemented {s2}? What was your exact contribution?", "focus": s2, "difficulty": "easy"},
            {"type": "fundamentals", "text": f"How do you approach testing, code reviews, and maintaining code quality when working with {s3}?", "focus": s3, "difficulty": "easy"},
            {"type": "role_fit", "text": f"Based on this role ({focus_jd}), how do your core technical skills align with the day-to-day work?", "focus": "Role Fit", "difficulty": "easy"},
            {"type": "collaboration", "text": "Describe a time you onboarded onto an existing codebase. How did you navigate the architecture and start contributing?", "focus": "Collaboration", "difficulty": "easy"},
        ],
        "medium": [
            {"type": "practical_scenario", "text": f"The job requirements emphasize {m1}. How would you bridge your experience in {s1} to deliver solutions in this area?", "focus": m1, "difficulty": "medium"},
            {"type": "technical_tradeoff", "text": f"When designing APIs or services with {s1}, what trade-offs do you make between development speed, readability, and performance?", "focus": s1, "difficulty": "medium"},
            {"type": "problem_solving", "text": f"Suppose your application suddenly encounters high latency when interacting with {s3}. Walk me step-by-step through how you isolate the bottleneck.", "focus": s3, "difficulty": "medium"},
            {"type": "integration", "text": f"How have you handled asynchronous tasks or background job queues when integrating {s2} with third-party services or {m2}?", "focus": m2, "difficulty": "medium"},
            {"type": "behavioral", "text": "Tell me about a technical decision you championed that met with pushback from other engineers or stakeholders. How did you resolve it?", "focus": "Stakeholder Management", "difficulty": "medium"},
        ],
        "hard": [
            {"type": "system_design", "text": f"Design a distributed, highly available architecture using {s1} capable of handling 50,000 requests/sec with 99.99% uptime. How do you handle cache invalidation, database sharding, and failover?", "focus": f"{s1} Distributed Architecture", "difficulty": "hard"},
            {"type": "production_incident", "text": "Describe the most challenging production outage or data integrity incident you investigated. What were the compounding factors, how did you stop the bleeding, and what post-mortem safeguards were built?", "focus": "Critical Incident Response", "difficulty": "hard"},
            {"type": "architecture_tradeoffs", "text": f"If tasked with migrating a legacy service to adopt {m1} and {m2}, what zero-downtime migration strategy and rollback plan would you architect?", "focus": f"{m1} & {m2} Zero-Downtime Migration", "difficulty": "hard"},
            {"type": "scalability", "text": "How do you mitigate concurrency race conditions, distributed deadlocks, and cascading microservice failures in a high-throughput event-driven pipeline?", "focus": "Concurrency & Resilience", "difficulty": "hard"},
            {"type": "engineering_leadership", "text": "You inherit a mission-critical system with immense technical debt and conflicting product deadlines. How do you quantify risk, negotiate scope with executives, and execute refactoring without halting feature delivery?", "focus": "Technical Strategy", "difficulty": "hard"},
        ],
    }


def _fallback_agenda(jd: str) -> List[Dict[str, str]]:
    focus = jd.replace("\n", " ").strip()[:110]
    return [
        {"type": "experience", "text": f"Walk me through the experience on your resume that best prepares you for this role: {focus}", "focus": "Experience", "difficulty": "medium"},
        {"type": "technical", "text": "Choose one technical skill from the job description. How have you used it in production, and what trade-offs did you make?", "focus": "Technical Depth", "difficulty": "medium"},
        {"type": "scenario", "text": "Tell me how you would investigate a production incident where response times suddenly doubled.", "focus": "Incident Investigation", "difficulty": "medium"},
        {"type": "behavioral", "text": "Describe a time you disagreed with a teammate or stakeholder. How did you reach a good outcome?", "focus": "Communication", "difficulty": "medium"},
        {"type": "depth", "text": "What would you improve in your first 30 days in this role, based on the requirements you read?", "focus": "Roadmap", "difficulty": "medium"},
    ]


def _groq_json(system: str, prompt: str) -> Dict[str, Any] | None:
    key = os.getenv("GROQ_API_KEY")
    if not key or key in {"your_key_here", "your_groq_api_key_here"}:
        return None
    try:
        from groq import Groq
        models_to_try = [
            os.getenv("INTERVIEW_GROQ_MODEL", "qwen/qwen3.8-27b"),
            "openai/gpt-oss-20b",
            "openai/gpt-oss-120b",
        ]
        client = Groq(api_key=key)
        for model in models_to_try:
            try:
                response = client.chat.completions.create(
                    model=model,
                    temperature=0.3,
                    max_tokens=650,
                    response_format={"type": "json_object"},
                    messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
                )
                return json.loads(response.choices[0].message.content)
            except Exception as model_err:
                print(f"Groq model {model} attempt failed: {model_err}")
                continue
        return None
    except (ImportError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        print(f"Interview LLM response invalid, using fallback scoring: {exc}")
        return None
    except Exception as exc:
        print(f"Interview LLM request failed ({type(exc).__name__}), using fallback scoring.")
        return None


def generate_interview_pool(
    resume: str,
    jd: str,
    detected_skills: List[str] = None,
    missing_skills: List[str] = None,
) -> Dict[str, List[Dict[str, Any]]]:
    detected = detected_skills or []
    missing = missing_skills or []

    prompt = f"""Analyze the candidate's background against the target job requirements.
Candidate Detected Skills: {", ".join(detected[:12]) if detected else "General technical skills"}
Target Missing Skills / Requirements: {", ".join(missing[:12]) if missing else "General domain requirements"}
Job Description Snippet: {jd[:2500]}
Resume Content Snippet: {resume[:2500]}

Generate exactly 5 questions for EACH of the three difficulty levels:
1. 'easy': Foundational concepts, direct project verification, and syntax/tools from resume.
2. 'medium': Applied scenarios, debugging, architectural comparisons, and bridging the missing skills.
3. 'hard': High-concurrency scalability, critical incident response, distributed system architecture, and difficult trade-offs.

Return ONLY a JSON object with keys 'easy', 'medium', 'hard'.
Each key must be a list of 5 objects with:
- "type": string (e.g., "conceptual", "practical", "scenario", "system_design", "incident")
- "text": string (the exact interview question)
- "focus": string (the specific skill, gap, or concept being evaluated)
"""

    result = _groq_json(
        "You are a principal technical interviewer at a top tech company. Return ONLY valid JSON with keys easy, medium, hard.",
        prompt,
    )

    if result and isinstance(result, dict) and all(k in result for k in ("easy", "medium", "hard")):
        pool = {}
        for level in ("easy", "medium", "hard"):
            items = result.get(level)
            if isinstance(items, list) and len(items) >= 3:
                pool[level] = [
                    {
                        "type": str(item.get("type", "technical")),
                        "text": str(item.get("text", "")),
                        "focus": str(item.get("focus", level.capitalize())),
                        "difficulty": level,
                    }
                    for item in items if item.get("text")
                ]
        if len(pool) == 3 and all(len(pool[k]) >= 3 for k in ("easy", "medium", "hard")):
            return pool

    return _fallback_multi_tier_pool(resume, jd, detected, missing)


def build_agenda(resume: str, jd: str) -> List[Dict[str, str]]:
    pool = generate_interview_pool(resume, jd)
    return pool.get("medium") or _fallback_agenda(jd)


def evaluate_answer(question: str, answer: str, jd: str, resume: str) -> Dict[str, Any]:
    system_prompt = """You are a rigorous technical interviewer and hiring committee member.
Evaluate the candidate's answer strictly based on job requirements and demonstrated evidence. Return ONLY valid JSON."""

    user_prompt = f"""Evaluate this interview answer on a 1-10 scale.

Job Description Context:
{jd[:3000]}

Candidate Resume Context:
{resume[:2500]}

Question Asked:
{question}

Candidate Answer:
{answer[:5000]}

Return JSON with:
- "rating": number 1-10 (weighted overall score)
- "technical_correctness": number 1-10
- "relevance": number 1-10
- "clarity": number 1-10
- "depth": number 1-10
- "strengths": list of 1-3 concise strengths
- "gaps": list of 1-3 specific missing concepts or weaknesses
- "ideal_answer": string providing a model STAR answer
- "transition": string with a natural conversational sentence acknowledging the answer and transitioning to the next question
- "follow_up_question": string with a targeted probe if there is a gap, or empty string
"""
    result = _groq_json(system_prompt, user_prompt)
    if result and isinstance(result.get("rating"), (int, float, str)):
        def _num(v, default):
            try:
                return round(float(v), 1)
            except (ValueError, TypeError):
                return default

        rating = _num(result.get("rating"), 6.0)
        result["rating"] = round(max(1, min(10, rating)), 1)
        result["technical_correctness"] = _num(result.get("technical_correctness"), rating)
        result["relevance"] = _num(result.get("relevance"), rating)
        result["clarity"] = _num(result.get("clarity"), rating)
        result["depth"] = _num(result.get("depth"), max(1, rating - 1))
        result["ai_prompt"] = user_prompt
        result["ai_evaluator"] = "Groq qwen/qwen3.8-27b"
        return result

    # Fallback only if Groq is temporarily unreachable
    words = len(answer.split())
    rating = max(2, min(10, 4 + (2 if words >= 40 else 0) + (2 if words >= 90 else 0)))
    return {
        "rating": rating,
        "technical_correctness": rating,
        "relevance": rating,
        "clarity": rating,
        "depth": max(1, rating - 1),
        "strengths": ["You provided a clear starting point."] if words else ["No answer was provided."],
        "gaps": ["Include concrete examples, technical trade-offs, and measurable outcomes."],
        "ideal_answer": "Use a specific STAR example, explain the technical reasoning, and quantify the outcome.",
        "transition": "Thank you for that response. Let's move to the next question.",
        "follow_up_question": "",
        "ai_prompt": user_prompt,
        "ai_evaluator": "Deterministic fallback (Groq unreachable)",
    }


def build_report(history: List[Dict[str, Any]], jd: str) -> Dict[str, Any] | None:
    system_prompt = """You are a senior tech hiring committee lead and executive coach. Return ONLY valid JSON."""
    user_prompt = f"""Create a final comprehensive hiring report based on the candidate's completed interview.

Target Job Requirements:
{jd[:4000]}

Candidate's Answers and Evaluations:
{json.dumps([{'question': h.get('question'), 'answer': h.get('answer'), 'rating': h.get('rating'), 'gaps': h.get('gaps')} for h in history], indent=2)[:8000]}

Generate JSON with:
- "readiness_score": integer 1-100 (Overall interview readiness)
- "jd_match_percent": integer 1-100 (Alignment with job description)
- "coaching_advice": string (Specific, high-impact paragraph on what to improve to get hired)
- "gap_summary": array of 2-4 strings detailing the primary technical or behavioral gaps
- "key_strengths": array of 2-4 strings detailing where the candidate demonstrated standout mastery
"""
    result = _groq_json(system_prompt, user_prompt)
    if result and isinstance(result, dict):
        result["ai_prompt"] = user_prompt
        result["ai_evaluator"] = "Groq qwen/qwen3.8-27b"
        return result
    return None


def start_interview(request: InterviewStartRequest) -> Dict[str, Any]:
    resume_text = (request.resume or "").strip()
    jd_text = (request.jd or "").strip()
    if len(jd_text) < 10:
        if resume_text:
            jd_text = f"Role matching candidate background in: {resume_text[:150]}"
        else:
            jd_text = "General Software Engineering, Technical Architecture, and Systems Design role"

    chosen_difficulty = (request.difficulty or "medium").lower()
    if chosen_difficulty not in ("easy", "medium", "hard"):
        chosen_difficulty = "medium"

    target_count = max(1, min(15, request.question_count or 5))

    # Priority 1: If pre-loaded questions were passed from frontend "Find My Match"
    if request.questions and isinstance(request.questions, list) and len(request.questions) > 0:
        agenda = [
            {
                "type": str(q.get("type", "technical")),
                "text": str(q.get("text", "")),
                "focus": str(q.get("focus", chosen_difficulty.capitalize())),
                "difficulty": str(q.get("difficulty", chosen_difficulty)),
            }
            for q in request.questions if q.get("text")
        ][:target_count]
    else:
        # Priority 2: Generate dynamic pool via Groq / fallback and select chosen difficulty
        pool = generate_interview_pool(resume_text, jd_text)
        selected_list = pool.get(chosen_difficulty) or pool.get("medium") or _fallback_agenda(jd_text)
        agenda = selected_list[:target_count]

    if not agenda:
        agenda = _fallback_agenda(jd_text)[:target_count]

    return {
        "session_id": str(uuid.uuid4()),
        "difficulty": chosen_difficulty,
        "agenda": agenda,
        "question": agenda[0],
        "current_index": 0,
        "completed": 0,
        "total": len(agenda),
        "history": [],
    }


def turn_interview(request: InterviewTurnRequest) -> Dict[str, Any]:
    answer = (request.candidate_answer or "").strip()
    if not answer:
        answer = "I don't have direct experience with that specific scenario."
    agenda = request.agenda or _fallback_agenda(request.jd)
    if request.current_index >= len(agenda):
        raise HTTPException(status_code=409, detail="Interview is already complete")
    current = agenda[request.current_index]
    evaluation = evaluate_answer(current["text"], answer, request.jd, request.resume)
    history = [*(request.history or []), {"question": current["text"], "answer": answer, **evaluation}]
    next_index = request.current_index + 1
    if next_index < len(agenda):
        next_question = evaluation.get("follow_up_question") or agenda[next_index]["text"]
        next_item = {**agenda[next_index], "text": next_question}
        return {
            "session_id": request.session_id, "agenda": agenda, "question": next_item,
            "current_index": next_index, "completed": next_index, "total": len(agenda),
            "history": history, "transition": evaluation["transition"], "evaluation": evaluation,
        }
    ratings = [float(item.get("rating", 0)) for item in history]
    average = sum(ratings) / len(ratings) if ratings else 0
    report = build_report(history, request.jd) or {
        "readiness_score": round(average * 10),
        "jd_match_percent": round(min(100, average * 10 + 5)),
        "coaching_advice": "Prioritize quantified STAR examples and connect each technical decision directly to the job requirements.",
        "gap_summary": ["Add measurable outcomes and explain technical trade-offs more explicitly."],
        "breakdown": history,
    }
    report["breakdown"] = history
    return {"session_id": request.session_id, "completed": len(history), "total": len(agenda), "history": history, "complete": True, "report": report, "evaluation": evaluation}
