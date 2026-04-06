import pdfplumber
import re

def extract_text_from_pdf(file_content):
    """
    Extracts text from a PDF file object.
    We pass the file object directly from FastAPI to avoid saving to disk unnecessarily.
    """
    text = ""
    try:
        with pdfplumber.open(file_content) as pdf:
            for page in pdf.pages:
                # Try layout-based extraction first (preserves spacing from PDF layout)
                page_text = page.extract_text(layout=True)
                if not page_text:
                    page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        
        return clean_text(text)
    
    except Exception as e:
        print(f"Error extracting text: {e}")
        return ""


def fix_missing_spaces(text):
    """
    Fixes concatenated words that lost their spaces during PDF extraction.
    Examples:
        'GNSSClockEphemeris'  → 'GNSS Clock Ephemeris'
        'predictingtheunseen' → handled by downstream NLP (too ambiguous for regex)
        'TensorFlow,LSTM'    → 'TensorFlow, LSTM'
        'datasets,predicting' → 'datasets, predicting'
    """
    # 1. Insert space between a lowercase letter and an uppercase letter
    #    e.g., 'clockEphemeris' → 'clock Ephemeris'
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    
    # 2. Insert space between a run of uppercase and an uppercase+lowercase
    #    e.g., 'GNSSClock' → 'GNSS Clock', 'LSTMModel' → 'LSTM Model'
    text = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', text)
    
    # 3. Insert space between a letter and a digit (and vice versa) 
    #    e.g., 'Python3' stays, but 'day15' → 'day 15', '7daytime' → '7 daytime'
    text = re.sub(r'([a-zA-Z])(\d)', r'\1 \2', text)
    text = re.sub(r'(\d)([a-zA-Z])', r'\1 \2', text)
    
    # 4. Add space after commas that are directly followed by a letter
    #    e.g., 'TensorFlow,LSTM' → 'TensorFlow, LSTM'
    text = re.sub(r',([a-zA-Z])', r', \1', text)
    
    # 5. Add space after periods that are directly followed by a capital letter
    #    e.g., 'tasks.Developed' → 'tasks. Developed'
    text = re.sub(r'\.([A-Z])', r'. \1', text)
    
    return text


def clean_text(text):
    """
    Cleans the extracted text by removing extra whitespaces, fixing 
    concatenated words, and removing messy characters.
    """
    # First, fix words that got glued together during PDF extraction
    text = fix_missing_spaces(text)
    
    # Replace multiple newlines with a single space
    text = re.sub(r'\n+', ' ', text)
    
    # Replace multiple spaces with a single space
    text = re.sub(r'\s+', ' ', text)
    
    # Remove special characters but keep letters, numbers, and basic punctuation
    text = re.sub(r'[^a-zA-Z0-9\s.,#+-]', '', text)
    
    return text.strip()