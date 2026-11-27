from fastembed import TextEmbedding
import spacy

print("📥 Pre-downloading FastEmbed ONNX model (sentence-transformers/all-MiniLM-L6-v2)...")
TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2", threads=1)

print("📥 Pre-downloading spaCy model...")
try:
    spacy.load("en_core_web_sm")
except Exception:
    spacy.cli.download("en_core_web_sm")

print("✅ All models downloaded successfully!")
