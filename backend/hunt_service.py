from celery import Celery
import requests
from bs4 import BeautifulSoup
from similarity_model import calculate_match_score
import os
import json
import random
import re

# Connect to Redis as broker AND result backend
# For All-in-One deployment, we use localhost
redis_url = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0')
app = Celery('tasks', 
             broker=redis_url,
             backend=redis_url)

app.conf.result_expires = 3600


def extract_keywords(resume_text, max_keywords=5):
    """
    Extract meaningful keywords from resume text for job searching.
    Uses frequency-based extraction of technical terms.
    """
    # Common tech/skill words to look for
    tech_terms = set()
    text_lower = resume_text.lower()
    
    # Extract capitalized terms and multi-word phrases that look like skills
    words = re.findall(r'\b[A-Z][a-zA-Z+#.]*(?:\s[A-Z][a-zA-Z+#.]*)*\b', resume_text)
    
    # Common skill patterns
    skill_patterns = [
        r'\b(?:python|java|javascript|typescript|react|angular|vue|node\.?js|django|flask|fastapi)\b',
        r'\b(?:aws|azure|gcp|docker|kubernetes|terraform|ci/cd|devops)\b',
        r'\b(?:machine\s?learning|deep\s?learning|data\s?science|nlp|computer\s?vision|ai)\b',
        r'\b(?:sql|nosql|mongodb|postgresql|mysql|redis|elasticsearch)\b',
        r'\b(?:product\s?manager|frontend|backend|full\s?stack|mobile|ios|android)\b',
        r'\b(?:marketing|sales|finance|accounting|design|ux|ui)\b',
    ]
    
    for pattern in skill_patterns:
        matches = re.findall(pattern, text_lower)
        tech_terms.update(matches)
    
    # Also grab job-title-like phrases
    title_patterns = re.findall(r'\b(?:senior|lead|junior|principal|staff)?\s*(?:software|data|product|project|ml|ai|cloud|devops)\s*(?:engineer|developer|scientist|analyst|manager|architect)\b', text_lower)
    tech_terms.update(title_patterns)
    
    # Pick top keywords, preferring longer/more specific ones
    keywords = sorted(list(tech_terms), key=len, reverse=True)[:max_keywords]
    
    # Fallback: if no keywords found, use simple word frequency
    if not keywords:
        common_words = {'the','and','or','a','an','in','on','at','to','for','of','is','was','are','were','be','been','with','from','by','as','this','that','it','we','our','my','i','have','has','had','do','did','not','no','but','if','they','their','you','your','will','can','would','should','could','may','might'}
        word_freq = {}
        for w in text_lower.split():
            w = re.sub(r'[^a-z0-9+#]', '', w)
            if len(w) > 3 and w not in common_words:
                word_freq[w] = word_freq.get(w, 0) + 1
        keywords = sorted(word_freq, key=word_freq.get, reverse=True)[:max_keywords]
    
    return keywords


@app.task(bind=True)
def hunt_jobs(self, resume_text):
    """
    Scrapes multiple job boards using resume-derived search keywords,
    scores each against the resume, and returns high-match results.
    """
    print("🎯 Hunt Mode Activated!")
    
    # Step 1: Extract search keywords from resume
    keywords = extract_keywords(resume_text)
    search_query = ' '.join(keywords[:3]) if keywords else 'software developer'
    print(f"🔍 Search keywords: {keywords}")
    print(f"🔍 Query: {search_query}")
    
    all_jobs = []
    errors = []
    
    # --- Source 1: RemoteOK (randomized slice) ---
    try:
        print("📡 Fetching from RemoteOK...")
        response = requests.get("https://remoteok.com/api", 
            headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            listings = data[1:] if len(data) > 1 else []
            
            # Filter by keyword relevance and randomize
            relevant = []
            for post in listings:
                title = (post.get("position", "") + " " + " ".join(post.get("tags", []))).lower()
                desc = post.get("description", "").lower()
                combined = title + " " + desc
                # Check if any keyword appears in the listing
                if any(kw in combined for kw in keywords):
                    relevant.append(post)
            
            # If we found relevant ones, use those; otherwise random sample
            if relevant:
                sample = random.sample(relevant, min(12, len(relevant)))
            else:
                sample = random.sample(listings, min(12, len(listings)))
            
            for post in sample:
                title = post.get("position", "Unknown Role")
                company = post.get("company", "Unknown Company")
                description = post.get("description", "")
                link = post.get("url", f"https://remoteok.com/remote-jobs/{post.get('id', '')}")
                tags = post.get("tags", [])
                
                if not description:
                    continue
                
                desc_soup = BeautifulSoup(description, 'html.parser')
                clean_desc = desc_soup.get_text(separator=' ', strip=True)[:500]
                score = calculate_match_score(resume_text, clean_desc)
                
                all_jobs.append({
                    "title": title, "company": company,
                    "score": round(score, 1), "link": link,
                    "tags": tags[:5] if tags else [],
                    "source": "RemoteOK"
                })
                print(f"  📋 {title} @ {company} → {score:.1f}%")
    except Exception as e:
        print(f"❌ RemoteOK error: {e}")
        errors.append(f"RemoteOK: {e}")
    
    # --- Source 2: Arbeitnow (free JSON API with keyword search) ---
    try:
        print("📡 Fetching from Arbeitnow...")
        url = f"https://www.arbeitnow.com/api/job-board-api?search={requests.utils.quote(search_query)}"
        response = requests.get(url, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            listings = data.get("data", [])[:10]
            
            for post in listings:
                title = post.get("title", "Unknown")
                company = post.get("company_name", "Unknown")
                description = post.get("description", "")
                link = post.get("url", "")
                tags_raw = post.get("tags", [])
                
                if not description:
                    continue
                
                desc_soup = BeautifulSoup(description, 'html.parser')
                clean_desc = desc_soup.get_text(separator=' ', strip=True)[:500]
                score = calculate_match_score(resume_text, clean_desc)
                
                all_jobs.append({
                    "title": title, "company": company,
                    "score": round(score, 1), "link": link,
                    "tags": tags_raw[:5] if tags_raw else [],
                    "source": "Arbeitnow"
                })
                print(f"  📋 {title} @ {company} → {score:.1f}%")
    except Exception as e:
        print(f"❌ Arbeitnow error: {e}")
        errors.append(f"Arbeitnow: {e}")
    
    # --- Source 3: HackerNews Jobs (randomized) ---
    try:
        print("📡 Fetching from HackerNews...")
        response = requests.get("https://hacker-news.firebaseio.com/v0/jobstories.json", timeout=10)
        
        if response.status_code == 200:
            all_ids = response.json()
            # Random sample instead of always top N
            sample_ids = random.sample(all_ids, min(10, len(all_ids)))
            
            for job_id in sample_ids:
                item_resp = requests.get(
                    f"https://hacker-news.firebaseio.com/v0/item/{job_id}.json", timeout=5)
                
                if item_resp.status_code == 200:
                    item = item_resp.json()
                    title = item.get("title", "Unknown")
                    text = item.get("text", "")
                    
                    if not text:
                        continue
                    
                    desc_soup = BeautifulSoup(text, 'html.parser')
                    clean_desc = desc_soup.get_text(separator=' ', strip=True)[:500]
                    score = calculate_match_score(resume_text, clean_desc)
                    
                    all_jobs.append({
                        "title": title,
                        "company": title.split("(")[0].strip() if "(" in title else "HN Listing",
                        "score": round(score, 1),
                        "link": f"https://news.ycombinator.com/item?id={job_id}",
                        "tags": [],
                        "source": "HackerNews"
                    })
                    print(f"  📋 {title} → {score:.1f}%")
                    
    except Exception as e:
        print(f"❌ HackerNews error: {e}")
        errors.append(f"HackerNews: {e}")
    
    # Sort by score and filter
    all_jobs.sort(key=lambda x: x["score"], reverse=True)
    # Lowered threshold to 25% because scraped snippets naturally have lower scores 
    # than full JDs, especially after the 1.2x multiplier tightening.
    matched_jobs = [j for j in all_jobs if j["score"] >= 25]
    
    result = {
        "matched_jobs": matched_jobs[:15],
        "total_scanned": len(all_jobs),
        "total_matched": len(matched_jobs),
        "search_keywords": keywords,
        "errors": errors,
    }
    
    print(f"\n🏁 Hunt complete! Scanned {len(all_jobs)} jobs, found {len(matched_jobs)} matches.")
    return result