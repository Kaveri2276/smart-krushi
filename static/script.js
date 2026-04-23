const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const suggestionBtns = document.querySelectorAll('.suggestion-btn');
const langBtns = document.querySelectorAll('.lang-btn');
const voiceBtn = document.getElementById('voiceBtn');
const audioToggle = document.getElementById('audioToggle');
const audioPlayer = document.getElementById('audioPlayer');

let currentLanguage = 'english';
let isRecording = false;
let recognition = null;
let audioEnabled = true;

// Check if browser supports Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
}

// Initialize
setupEventListeners();
updateLanguageText();

function setupEventListeners() {
    // Send message events
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Voice input
    voiceBtn.addEventListener('click', toggleVoiceInput);

    // Audio toggle
    audioToggle.addEventListener('click', toggleAudio);

    // Suggestion buttons
    suggestionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            userInput.value = btn.dataset.question;
            sendMessage();
        });
    });

    // Language switching
    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLanguage = btn.dataset.lang;
            updateLanguageText();
            if (recognition) {
                recognition.lang = currentLanguage === 'marathi' ? 'mr-IN' : 'en-US';
            }
        });
    });

    // Voice recognition events
    if (recognition) {
        recognition.onstart = () => {
            isRecording = true;
            voiceBtn.classList.add('recording');
            voiceBtn.querySelector('.action-text').textContent = 'Listening...';
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            userInput.value = finalTranscript || interimTranscript;
            userInput.placeholder = finalTranscript ? 'Ready to send...' : 'Still listening...';
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            voiceBtn.classList.remove('recording');
            voiceBtn.querySelector('.action-text').textContent = 'Try Again';
            showNotification(`Voice Error: ${event.error}`, 'error');
        };

        recognition.onend = () => {
            isRecording = false;
            voiceBtn.classList.remove('recording');
            voiceBtn.querySelector('.action-text').textContent = 'Tap to Speak';
            
            // Auto-send if there's text
            if (userInput.value.trim()) {
                setTimeout(sendMessage, 500);
            }
        };
    }
}

function toggleVoiceInput() {
    if (!recognition) {
        showNotification('Speech recognition not supported in your browser', 'error');
        return;
    }

    if (isRecording) {
        recognition.stop();
    } else {
        userInput.value = '';
        recognition.lang = currentLanguage === 'marathi' ? 'mr-IN' : 'en-US';
        recognition.start();
    }
}

function toggleAudio() {
    audioEnabled = !audioEnabled;
    audioToggle.classList.toggle('enabled', audioEnabled);
    
    const audioText = audioToggle.querySelector('#audioText');
    audioText.textContent = audioEnabled ? 'Audio ON' : 'Audio OFF';
    
    showNotification(`Audio responses ${audioEnabled ? 'enabled' : 'disabled'}`, 'info');
}

function updateLanguageText() {
    const welcomeMsg = document.getElementById('welcome-msg');
    if (currentLanguage === 'marathi') {
        welcomeMsg.textContent = 'स्मार्ट कृषीला स्वागतम! कृषी, पीके, कीटक, मातीची गुणवत्ता, जल व्यवस्थापन आणि आणखी बरेच काही विषयावर मला काही विचारा. मी तुम्हाला मदत करण्यासाठी येथे आहे!';
        userInput.placeholder = 'आपल्या कृषी प्रश्नाची विचारणा करा किंवा 🎤 वापरा...';
    } else {
        welcomeMsg.textContent = 'Welcome to Smart Krushi! Ask me anything about farming, crops, pests, soil, water management, and more. I\'m here to help!';
        userInput.placeholder = 'Ask your farming question or use 🎤 to speak...';
    }
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessage(message, 'user');
    userInput.value = '';

    // Show loading indicator
    const loadingDiv = addMessage(currentLanguage === 'marathi' ? 'सोच रहे आहे...' : 'Thinking...', 'bot', true);

    try {
        const response = await fetch('/api/farming-solutions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: message,
                language: currentLanguage
            })
        });

        const data = await response.json();

        // Remove loading indicator
        loadingDiv.remove();

        if (data.answer) {
            addMessage(data.answer, 'bot');
            
            // Play audio response if enabled
            if (audioEnabled) {
                playTextToSpeech(data.answer);
            }
        } else {
            const errorMsg = currentLanguage === 'marathi' 
                ? 'क्षमा करा, मला उत्तर देऊ शकत नाही। कृपया प्रश्न पुन्हा विचारा।'
                : 'Sorry, I couldn\'t find an answer. Please try rephrasing your question.';
            addMessage(errorMsg, 'bot');
        }
    } catch (error) {
        loadingDiv.remove();
        const errorMsg = currentLanguage === 'marathi'
            ? 'त्रुटी: AI सेवा जोडण्यास असमर्थ। कृपया पुन्हा प्रयत्न करा।'
            : 'Error: Unable to connect to the AI service. Please try again.';
        addMessage(errorMsg, 'bot');
        console.error('Error:', error);
    }

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addMessage(text, sender, isLoading = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const avatar = sender === 'user' ? '👨‍🌾' : '🤖';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <p>${escapeHtml(text)}</p>
            ${isLoading ? '<span class="typing-indicator"><span></span><span></span><span></span></span>' : ''}
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return messageDiv;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function playTextToSpeech(text) {
    // Use Web Speech API for text-to-speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = currentLanguage === 'marathi' ? 'mr-IN' : 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    window.speechSynthesis.speak(utterance);

    utterance.onerror = (event) => {
        console.error('Text-to-speech error:', event.error);
    };
}

function showNotification(message, type = 'info') {
    // Create a simple notification (can be improved with a toast library)
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'error' ? '#ff6b6b' : type === 'info' ? '#4ecdc4' : '#4a7c2c'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
        font-weight: 500;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add slide animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Set initial language for speech recognition
if (recognition) {
    recognition.lang = 'en-US';
}
