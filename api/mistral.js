const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

// Создаем Express-приложение
const app = express();

// Конфигурация CORS
const corsOptions = {
  origin: '*', // Разрешаем запросы со всех доменов
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

// Применяем middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Конфигурация Ollama
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const MODEL = process.env.MODEL || 'mistral:7b-instruct';

// Обработчик ошибок
const handleError = (res, error) => {
  console.error('API Error:', error.message);
  res.status(500).json({
    error: error.response?.data?.error || 'Internal Server Error',
    details: error.message
  });
};

// Маршрут для проверки статуса API
app.get('/', (req, res) => {
  res.status(200).json({ status: 'API работает' });
});

// Решение задач
app.post('/solve', async (req, res) => {
  try {
    const { question, subject } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Missing question' });
    }
    
    const prompt = buildSolvePrompt(question, subject || 'math');
    
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
      solution: response.data.response || 'Не получилось сгенерировать решение.',
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
      return res.status(400).json({ error: 'Missing answer' });
    }
    
    const prompt = `Ты опытный репетитор. Оцени ответ ученика: "${studentAnswer}". Дай конструктивную обратную связь, укажи на сильные стороны и что можно улучшить.`;
    
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
      feedback: response.data.response || 'Не удалось оценить ответ.',
      studentAnswer: studentAnswer
    });
  } catch (error) {
    handleError(res, error);
  }
});

// Генерация плана обучения
app.post('/generate-plan', async (req, res) => {
  try {
    const { subject, daysUntilExam } = req.body;
    
    const days = daysUntilExam || 30;
    const subjectName = subject || 'math';
    
    const prompt = `Ты опытный репетитор. Создай детальный план обучения по предмету "${subjectName === 'math' ? 'математика' : 'чешский язык'}" на ${days} дней. Разбей по неделям и укажи конкретные темы для изучения каждый день. План должен быть структурированным и последовательным.`;
    
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
      plan: response.data.response || 'Не удалось создать план обучения.',
      subject: subjectName,
      daysUntilExam: days
    });
  } catch (error) {
    handleError(res, error);
  }
});

// Вспомогательные функции
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

// Для локального запуска
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Экспорт для Vercel
module.exports = app;
