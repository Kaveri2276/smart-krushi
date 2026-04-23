from flask import Flask, render_template, request, jsonify
import json
import os
from dotenv import load_dotenv
import requests
import speech_recognition as sr
from pydub import AudioSegment
from io import BytesIO
import pyttsx3

load_dotenv()

app = Flask(__name__)

# Initialize text-to-speech engine
tts_engine = pyttsx3.init()
tts_engine.setProperty('rate', 150)  # Slower speech for clarity

# Open-source AI API configuration (using Hugging Face Inference API)
HUGGINGFACE_API_KEY = os.getenv('HUGGINGFACE_API_KEY', 'your_api_key_here')
HF_API_URL = "https://api-inference.huggingface.co/models/google/flan-t5-large"

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/farming-solutions', methods=['POST'])
def farming_solutions():
    """
    Main endpoint that handles both text and voice input
    Supports multiple languages (English and Marathi)
    """
    try:
        data = request.json
        question = data.get('question')
        language = data.get('language', 'english')
        
        if not question:
            return jsonify({'error': 'No question provided'}), 400
        
        # Get AI-powered answer
        answer = get_ai_answer(question, language)
        
        return jsonify({
            'answer': answer,
            'language': language
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/voice-input', methods=['POST'])
def voice_input():
    """
    Endpoint to handle voice input from farmers
    Converts speech to text
    """
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        language = request.form.get('language', 'english')
        
        # Convert speech to text
        text = speech_to_text(audio_file, language)
        
        if not text:
            return jsonify({'error': 'Could not understand speech'}), 400
        
        # Get AI answer
        answer = get_ai_answer(text, language)
        
        # Convert answer to speech
        audio_response = text_to_speech(answer, language)
        
        return jsonify({
            'question_text': text,
            'answer': answer,
            'audio_url': audio_response,
            'language': language
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/text-to-speech', methods=['POST'])
def convert_to_speech():
    """
    Endpoint to convert text answer to speech
    """
    try:
        data = request.json
        text = data.get('text')
        language = data.get('language', 'english')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        audio_url = text_to_speech(text, language)
        
        return jsonify({'audio_url': audio_url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_ai_answer(question, language='english'):
    """
    Get answer from open-source AI (Hugging Face)
    Falls back to local farming database if API fails
    """
    try:
        # Prepare the prompt with farming context
        farming_context = """You are an expert agricultural advisor helping farmers with their farming questions. 
        Provide practical, actionable advice suitable for small farmers. Keep answers concise and clear."""
        
        prompt = f"{farming_context}\n\nFarmer's Question: {question}\nAnswer:"
        
        # Call Hugging Face API
        headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_length": 200,
                "temperature": 0.7
            }
        }
        
        response = requests.post(HF_API_URL, headers=headers, json=payload, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            if result and len(result) > 0:
                answer = result[0].get('generated_text', '').replace(prompt, '').strip()
                if answer:
                    return answer
    except Exception as e:
        print(f"AI API error: {e}")
    
    # Fallback to local farming database
    return get_local_farming_solution(question, language)

def get_local_farming_solution(question, language='english'):
    """
    Fallback function using local farming database
    """
    try:
        with open('farming_data.json', 'r', encoding='utf-8') as f:
            farming_data = json.load(f)
        
        # Convert question to lowercase for matching
        question_lower = question.lower()
        
        # Search for matching solutions
        lang_key = 'Marathi' if language == 'marathi' else 'English'
        solutions = []
        
        for category, category_data in farming_data.get('farming_solutions', {}).items():
            if lang_key in category_data:
                # Check if category keywords match
                if any(keyword in question_lower for keyword in category.lower().split('_')):
                    solutions.extend(category_data[lang_key].values())
        
        if solutions:
            return ' '.join(solutions)
        else:
            if language == 'marathi':
                return "मला खेद आहे, मी या प्रश्नाचे उत्तर देऊ शकत नाही. कृपया स्पष्ट प्रश्न विचारा."
            else:
                return "I'm sorry, I couldn't find a specific solution for your question. Please try asking about crop diseases, watering, pests, or soil issues."
    
    except Exception as e:
        if language == 'marathi':
            return "डेटाबेस मध्ये त्रुटी. कृपया पुन्हा प्रयत्न करा."
        else:
            return "Error accessing database. Please try again."

def speech_to_text(audio_file, language='english'):
    """
    Convert speech audio to text
    Supports English and Marathi
    """
    try:
        recognizer = sr.Recognizer()
        
        # Read audio file
        audio_data = audio_file.read()
        audio_stream = BytesIO(audio_data)
        
        # Handle different audio formats
        try:
            audio = sr.AudioFile(audio_stream)
        except:
            # Try converting if format is not supported
            audio_stream.seek(0)
            audio = sr.AudioFile(audio_stream)
        
        with audio as source:
            audio_content = recognizer.record(source)
        
        # Recognize speech
        lang_code = 'mr-IN' if language == 'marathi' else 'en-US'
        text = recognizer.recognize_google(audio_content, language=lang_code)
        
        return text
    except sr.UnknownValueError:
        return None
    except sr.RequestError as e:
        print(f"Speech recognition error: {e}")
        return None
    except Exception as e:
        print(f"Error processing audio: {e}")
        return None

def text_to_speech(text, language='english'):
    """
    Convert text to speech using pyttsx3 (offline)
    """
    try:
        # Configure language
        if language == 'marathi':
            # For Marathi, use a slower rate
            tts_engine.setProperty('rate', 120)
        else:
            tts_engine.setProperty('rate', 150)
        
        # Save to file
        filename = f"response_{language}_{int(time.time())}.mp3"
        filepath = os.path.join('static', filename)
        
        tts_engine.save_to_file(text, filepath)
        tts_engine.runAndWait()
        
        # Return URL path
        return f"/static/{filename}"
    except Exception as e:
        print(f"Text-to-speech error: {e}")
        return None

if __name__ == '__main__':
    # Create static directory if it doesn't exist
    os.makedirs('static', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5000)
