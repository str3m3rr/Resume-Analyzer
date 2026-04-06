from sentence_transformers import SentenceTransformer
import spacy

print("📥 Pre-downloading SBERT model...")
SentenceTransformer('all-MiniLM-L6-v2')

print("📥 Pre-downloading spaCy model...")
try:
    spacy.load("en_core_web_sm")
except:
    spacy.cli.download("en_core_web_sm")

print("✅ All models downloaded successfully!")
