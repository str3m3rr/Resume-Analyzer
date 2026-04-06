import chromadb
import os

# Initialize local ChromaDB (this creates a folder inside the container to save your DB)
chroma_client = chromadb.PersistentClient(path="./chroma_data")

# Create or load the memory collection
# Chroma automatically uses an embedding model under the hood to vectorize the text
memory_collection = chroma_client.get_or_create_collection(name="resume_memories")

def initialize_memory():
    """Reads the master text file and loads it into the vector database."""
    # Check if we already loaded it to avoid duplicates
    if memory_collection.count() > 0:
        return

    if not os.path.exists("master_experience.txt"):
        print("Warning: master_experience.txt not found!")
        return

    with open("master_experience.txt", "r", encoding="utf-8") as file:
        content = file.read()
    
    # Split the document by newlines (each paragraph is one "memory")
    memories = [m.strip() for m in content.split('\n') if m.strip()]
    
    # Generate unique IDs for each memory chunk
    ids = [f"mem_{i}" for i in range(len(memories))]
    
    # Add to the database
    memory_collection.add(
        documents=memories,
        ids=ids
    )
    print(f"Successfully loaded {len(memories)} memories into ChromaDB!")

def retrieve_relevant_memory(target_skill: str) -> str:
    """Searches the database for the closest matching experience."""
    if memory_collection.count() == 0:
        return "No extended background context available."

    results = memory_collection.query(
        query_texts=[target_skill],
        n_results=1 # Just get the single most relevant memory
    )
    
    if results['documents'] and results['documents'][0]:
        return results['documents'][0][0]
    return "No relevant past experience found for this skill."