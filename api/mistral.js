const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

// Create Express app
const app = express();

// Configure CORS
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin'],
  optionsSuccessStatus: 200
};

// Apply middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.options('*', cors(corsOptions));

// Get Ollama server URL from environment variable - note the updated URL
const OLLAMA_SERVER = process.env.OLLAMA_SERVER || 'https://c9c8-109-183-236-86.ngrok-free.app';
const MODEL = process.env.MODEL || 'mistral:7b-instruct';

console.log('Using Ollama server:', OLLAMA_SERVER);

// Check if we can access Ollama
const hasOllamaAccess = !!OLLAMA_SERVER;

// Error handler with more detailed logging
const handleError = (res, error) => {
  console.error('API Error:', error.message);
  console.error('Request details:', error.config || 'No config available');
  console.error('Response details:', error.response?.data || 'No response data');
  
  res.status(500).json({
    error: error.response?.data?.error || 'Internal Server Error',
    details: error.message
  });
};

// Status route
app.get('/', (req, res) => {
  if (!hasOllamaAccess) {
    return res.status(200).json({ 
      status: 'API работает в демо-режиме. Настройте OLLAMA_SERVER в переменных окружения Vercel.' 
    });
  }
  res.status(200).json({ status: 'API работает, подключен к Ollama: ' + OLLAMA_SERVER });
});

// Test route to check Ollama connection
app.get('/test-ollama', async (req, res) => {
  try {
    console.log(`Testing connection to Ollama at ${OLLAMA_SERVER}`);
    const response = await axios.get(`${OLLAMA_SERVER}/api/tags`);
    res.json({
      status: 'success',
      models: response.data,
      ollama_server: OLLAMA_SERVER
    });
  } catch (error) {
    console.error('Ollama connection test failed:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to Ollama server',
      error: error.message,
      ollama_server: OLLAMA_SERVER
    });
  }
});

// Math/Czech problem solving route
app.post('/solve', async (req, res) => {
  try {
    const { question, subject } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Missing question' });
    }
    
    console.log(`Processing question: "${question}" (subject: ${subject})`);
    
    // Check if in demo mode
    if (!hasOllamaAccess) {
      return res.json({
        solution: generateLocalResponse(question, subject || 'math'),
        question: question,
        subject: subject
      });
    }
    
    const prompt = buildSolvePrompt(question, subject || 'math');
    
    // Log the request details
    console.log(`Sending request to: ${OLLAMA_SERVER}/api/generate`);
    console.log('Request payload:', {
      model: MODEL,
      prompt: prompt.substring(0, 100) + '...' // Log truncated prompt
    });
    
    const response = await axios.post(`${OLLAMA_SERVER}/api/generate`, {
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        max_tokens: 2048
      }
    });
    
    console.log('Received response from Ollama');
    
    res.json({
      solution: response.data.response || 'Не получилось сгенерировать решение.',
      question: question,
      subject: subject
    });
  } catch (error) {
    console.error(`Error solving question: ${error.message}`);
    
    // Return demo response on error
    res.json({
      solution: `Произошла ошибка при обращении к API: ${error.message}.\n\n` + 
                generateLocalResponse(req.body.question || '', req.body.subject || 'math'),
      question: req.body.question || '',
      subject: req.body.subject || 'math',
      error: error.message
    });
  }
});

// Answer checking route
app.post('/check-answer', async (req, res) => {
  try {
    const { studentAnswer } = req.body;
    
    if (!studentAnswer) {
      return res.status(400).json({ error: 'Missing answer' });
    }
    
    // Check if in demo mode
    if (!hasOllamaAccess) {
      return res.json({
        feedback: `Ваш ответ: "${studentAnswer}" выглядит неплохо. Продолжайте практиковаться!`,
        studentAnswer: studentAnswer
      });
    }
    
    const prompt = `Ты опытный репетитор. Оцени ответ ученика: "${studentAnswer}". Дай конструктивную обратную связь, укажи на сильные стороны и что можно улучшить.`;
    
    const response = await axios.post(`${OLLAMA_SERVER}/api/generate`, {
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        max_tokens: 1024
      }
    });
    
    res.json({
      feedback: response.data.response || 'Не удалось оценить ответ.',
      studentAnswer: studentAnswer
    });
  } catch (error) {
    // Return demo response on error
    res.json({
      feedback: `Произошла ошибка при обращении к API. Ваш ответ выглядит неплохо. Продолжайте практиковаться!`,
      studentAnswer: req.body.studentAnswer || '',
      error: error.message
    });
  }
});

// Learning plan generation route
app.post('/generate-plan', async (req, res) => {
  try {
    const { subject, daysUntilExam } = req.body;
    
    const days = daysUntilExam || 30;
    const subjectName = subject || 'math';
    
    // Check if in demo mode
    if (!hasOllamaAccess) {
      return res.json({
        plan: generateLocalPlan(subjectName),
        subject: subjectName,
        daysUntilExam: days
      });
    }
    
    const prompt = `Ты опытный репетитор. Создай детальный план обучения по предмету "${subjectName === 'math' ? 'математика' : 'чешский язык'}" на ${days} дней. Разбей по неделям и укажи конкретные темы для изучения каждый день. План должен быть структурированным и последовательным.`;
    
    const response = await axios.post(`${OLLAMA_SERVER}/api/generate`, {
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        max_tokens: 1024
      }
    });
    
    res.json({
      plan: response.data.response || 'Не удалось создать план обучения.',
      subject: subjectName,
      daysUntilExam: days
    });
  } catch (error) {
    // Return demo response on error
    res.json({
      plan: generateLocalPlan(req.body.subject || 'math'),
      subject: req.body.subject || 'math',
      daysUntilExam: req.body.daysUntilExam || 30,
      error: error.message
    });
  }
});

// Helper functions
function buildSolvePrompt(question, subject) {
  if (subject === 'math') {
    return `Ты опытный репетитор по математике. Подробно реши следующую задачу:

"${question}"

Объясни каждый шаг решения. Если есть несколько способов решения, покажи наиболее понятный. В конце укажи итоговый ответ.`;
  } else if (subject === 'czech') {
    return `Ты опытный репетитор по чешскому языку. Подробно ответь на следующий вопрос:

"${question}"

Дай полное объяснение, приведи примеры, где это уместно. Если вопрос связан с грамматикой, объясни правила и исключения.`;
  }
  
  return `Ответь на вопрос ученика: "${question}"`;
}

// Local responses for demo mode
function generateLocalResponse(question, subject) {
  if (subject === 'math') {
    if (question.includes('реши') || question.includes('решить')) {
      return `Конечно, давайте разберем эту задачу:\n\nПервым шагом нужно определить, какой метод лучше подходит для решения. Обычно начинаем с анализа условий.\n\nРешение:\n1. Выделяем основные данные из условия\n2. Применяем соответствующую формулу\n3. Выполняем вычисления шаг за шагом\n\nИтоговый ответ: [демо-версия] Для получения точного решения необходимо подключение к API.`;
    } else if (question.includes('производная') || question.includes('интеграл')) {
      return `Для решения задач с производными и интегралами нужно применять правила дифференцирования и интегрирования.\n\nОсновные правила дифференцирования:\n- (C)' = 0, где C - константа\n- (x^n)' = n*x^(n-1)\n- (u + v)' = u' + v'\n- (u*v)' = u'*v + u*v'\n\n[демо-версия] Для полного решения обратитесь к API.`;
    } else {
      return `Отвечаю на вопрос по математике:\n\nЭто важная тема в математике. Для глубокого понимания необходимо рассмотреть несколько ключевых концепций:\n\n1. Основные определения\n2. Формулы и их применение \n3. Типовые задачи и методы их решения\n\n[демо-версия] Для более конкретного ответа необходимо подключение к API.`;
    }
  } else {
    return `О чешском языке:\n\nЧешский язык принадлежит к западнославянской группе языков. Он имеет много общего с другими славянскими языками, включая русский, но также имеет свои уникальные особенности.\n\nВ чешском языке есть:\n- 7 падежей \n- Длинные и краткие гласные\n- Ударение всегда падает на первый слог\n\n[демо-версия] Для более подробного ответа необходимо подключение к API.`;
  }
}

// Local learning plan for demo mode
function generateLocalPlan(subject) {
  if (subject === 'math') {
    return `План подготовки по математике на 30 дней:

Неделя 1: Основы алгебры
- День 1-2: Числовые множества и операции
- День 3-4: Уравнения первой степени
- День 5-7: Системы линейных уравнений

Неделя 2: Функции
- День 8-10: Основные функции и их графики
- День 11-14: Преобразования графиков

Неделя 3: Производные
- День 15-18: Определение и правила дифференцирования
- День 19-21: Применение производных

Неделя 4: Подготовка к экзамену
- День 22-25: Решение типовых задач
- День 26-28: Пробные тесты
- День 29-30: Повторение сложных тем

[демо-версия] Для персонализированного плана обратитесь к API.`;
  } else {
    return `План изучения чешского языка на 30 дней:

Неделя 1: Основы
- День 1-3: Алфавит и произношение
- День 4-7: Базовые фразы и приветствия

Неделя 2: Грамматика I
- День 8-11: Существительные и падежи
- День 12-14: Глаголы и спряжения

Неделя 3: Разговорная практика
- День 15-18: Повседневные диалоги
- День 19-21: Описание событий и планов

Неделя 4: Укрепление знаний
- День 22-25: Чтение и аудирование
- День 26-28: Письменные упражнения
- День 29-30: Финальное повторение

[демо-версия] Для персонализированного плана обратитесь к API.`;
  }
}

// For local runs
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Ollama server: ${OLLAMA_SERVER}`);
  });
}

// Export for Vercel
module.exports = app;
