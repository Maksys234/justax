const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

// Create Express app
const app = express();

app.use(cors()); // Это разрешит все домены
// Apply middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.options('*', cors(corsOptions));

// Get Ollama server URL from environment variable
const OLLAMA_SERVER = process.env.OLLAMA_SERVER || 'https://c9c8-109-183-236-86.ngrok-free.app/';
const MODEL = process.env.MODEL || 'mistral:7b-instruct';

console.log('Using Ollama server:', OLLAMA_SERVER);

// Check if we can access Ollama
const hasOllamaAccess = !!OLLAMA_SERVER;

// Status route
app.get('/', (req, res) => {
  if (!hasOllamaAccess) {
    return res.status(200).json({ 
      status: 'API работает в демо-режиме. Настройте OLLAMA_SERVER в переменных окружения Vercel.' 
    });
  }
  res.status(200).json({ status: 'API работает, подключен к Ollama: ' + OLLAMA_SERVER });
});

// Simple chat route
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }
    
    console.log(`Received message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // Check if in demo mode
    if (!hasOllamaAccess) {
      return res.json({
        response: generateDemoResponse(message),
        success: true
      });
    }
    
    const prompt = `<s>[INST] ${message} [/INST]</s>`;
    
    console.log(`Sending request to Ollama at ${OLLAMA_SERVER}/api/generate`);
    
    const response = await axios.post(`${OLLAMA_SERVER}/api/generate`, {
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        max_tokens: 2048
      }
    });
    
    console.log('Received response from Ollama');
    
    res.json({
      response: response.data.response || 'Извините, я не смог сформулировать ответ.',
      success: true
    });
  } catch (error) {
    console.error(`Error in chat: ${error.message}`);
    
    // Return demo response on error
    res.json({
      response: `Произошла ошибка при обращении к AI: ${error.message}.\n\n` + 
                generateDemoResponse(req.body.message || ''),
      success: false,
      error: error.message
    });
  }
});

// Generate demo responses when API is not available
function generateDemoResponse(message) {
  const responses = [
    "Извините, я работаю в демо-режиме и пока не могу дать полноценный ответ.",
    "В демо-режиме мои возможности ограничены. Для полноценной работы необходим доступ к API.",
    "Я бы с радостью ответил подробнее, но сейчас работаю в демо-режиме.",
    "Интересный вопрос! К сожалению, для полного ответа нужно настроить подключение к API.",
    "Спасибо за ваше сообщение. Для полноценного диалога необходимо настроить подключение к серверу Ollama."
  ];
  
  // Simple keyword-based responses for demo mode
  if (message.toLowerCase().includes('привет') || message.toLowerCase().includes('здравствуй')) {
    return "Привет! Я ИИ-ассистент. Сейчас я работаю в демо-режиме, но я могу стать полноценным помощником после настройки.";
  }
  
  if (message.toLowerCase().includes('как дела') || message.toLowerCase().includes('как ты')) {
    return "У меня всё хорошо, спасибо! В демо-режиме я работаю с ограниченными возможностями, но готов помогать как могу.";
  }
  
  if (message.includes('?')) {
    return "Хороший вопрос! В полной версии я мог бы дать развернутый ответ. Для этого необходимо настроить подключение к API.";
  }
  
  // Return random response for other messages
  return responses[Math.floor(Math.random() * responses.length)];
}

// For local testing
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Ollama server: ${OLLAMA_SERVER}`);
  });
}

// Export for Vercel
module.exports = app;
