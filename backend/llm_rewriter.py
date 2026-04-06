import os
from groq import Groq

def rewrite_bullet_point(original_bullet, target_skill, job_role, api_key, memory_context):
    client = Groq(api_key=api_key)
    
    prompt = f"""
    You are an expert tech recruiter and resume writer.
    A candidate is applying for a {job_role} position.
    They need to highlight their experience with '{target_skill}'.
    
    Here is the bullet point they want to rewrite: 
    "{original_bullet}"

    Here is a true fact pulled from their extended background:
    "{memory_context}"

    Rewrite the original bullet point to naturally incorporate '{target_skill}'. 
    CRITICAL: Use the facts from the extended background to prove they know the skill. Do not hallucinate or invent experience. Make it sound professional and punchy.
    
    Output ONLY the rewritten bullet point, nothing else.
    """

    try:
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant", 
            messages=[
                {"role": "system", "content": "You are a precise resume editing API. Output only the requested rewritten text."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3, # Lowered temperature to force it to stick to the facts
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        return f"AI Error: {str(e)}"