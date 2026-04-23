const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const suggestionBtns = document.querySelectorAll('.suggestion-btn');
const langBtns = document.querySelectorAll('.lang-btn');

let currentLanguage = 'english';

// Send message on button click
sendBtn.addEventListener('click', sendMessage);

// Send message on Enter key
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

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
    });
});

function updateLanguageText() {
    const welcomeMsg = document.getElementById('welcome-msg');
    if (currentLanguage === 'marathi') {
        welcomeMsg.textContent = 'स्मार्ट कृषीला स्वागतम! कृषी, पीके, कीटक, मातीची गुणवत्ता, जल व्यवस्थापन आणि आणखी बरेच काही विषयावर मला काही विचारा. मी तुम्हाला मदत करण्यासाठी येथे आहे!';
        userInput.placeholder = 'आपल्या कृषी प्रश्नाची विचारणा करा...';
    } else {
        welcomeMsg.textContent = 'Welcome to Smart Krushi! Ask me anything about farming, crops, pests, soil, water management, and more. I\'m here to help!';
        userInput.placeholder = 'Ask your farming question...';
    }
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessage(message, 'user');
    userInput.value = '';

    // Show loading indicator
    const loadingDiv = addMessage('Thinking...', 'bot', true);

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
        } else {
            addMessage('Sorry, I couldn\'t find an answer. Please try rephrasing your question.', 'bot');
        }
    } catch (error) {
        loadingDiv.remove();
        addMessage('Error: Unable to connect to the AI service. Please try again.', 'bot');
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