const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

// Создаем полноценное Express-приложение вместо роутера
const app = express();

// Конфигурация CORS
const corsOptions = {
  origin: ['http://justax.space', 'http://localhost:3000'],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  optionsSuccessStatus: 200
};

// Применяем middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Конфигурация Ollama
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const MODEL = process.env.MODEL || 'mistral:7b-instruct';

// Обработчики ошибок
const handleError = (res, error) => {
  console.error('API Error:', error);
  res.status(500).json({
    error: error.response?.data?.error || 'Internal Server Error',
    details: error.message
  });
};

// Решение задач
app.post('/solve', async (req, res) => {
  try {
    const { question, subject } = req.body;
    
    if (!question || !subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const prompt = buildSolvePrompt(question, subject);
    
    const response = await axios.post(`${OLLAMA_ENDPOINT}/api/generate`, {
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        max_tokens: 2048
      }
    });
    
    res.json({
      solution: response.data.response,
      question: question,
      subject: subject
    });
  } catch (error) {
    handleError(res, error);
  }
});

// Проверка ответов
app.post('/check-answer', async (req, res) => {
  try {
    const { studentAnswer } = req.body;
    
    if (!studentAnswer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const prompt = `Оцени ответ ученика: "${studentAnswer}". Дай конструктивную обратную связь.`;
    
    const response = await axios.post(`${OLLAMA_ENDPOINT}/api/generate`, {
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        max_tokens: 1024
      }
    });
    
    res.json({
      feedback: response.data.response
    });
  } catch (error) {
    handleError(res, error);
  }
});

// Генерация плана обучения
app.post('/generate-plan', async (req, res) => {
  try {
    const { subject, daysUntilExam } = req.body;
    
    if (!subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const prompt = `Создай план обучения по предмету "${subject}" на ${daysUntilExam || 30} дней. Разбей по неделям и укажи темы для изучения.`;
    
    const response = await axios.post(`${OLLAMA_ENDPOINT}/api/generate`, {
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        max_tokens: 1024
      }
    });
    
    res.json({
      plan: response.data.response,
      subject: subject
    });
  } catch (error) {
    handleError(res, error);
  }
});

// Вспомогательные функции
function buildSolvePrompt(question, subject) {
  if (subject === 'math') {
    return `Ты опытный репетитор по математике. Подробно реши задачу:\n\n${question}\n\nОбъясни каждый шаг.`;
  }
  return `Ответь на вопрос по чешскому языку:\n\n${question}`;
}

// Для локального запуска
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Для Vercel - экспортируем приложение
module.exports = app;
