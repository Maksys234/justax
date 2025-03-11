const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

// Создаем Express-роутер
const router = express.Router();

// Конфигурация CORS
const corsOptions = {
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin'],
  optionsSuccessStatus: 200
};

// Применяем middleware
router.use(cors(corsOptions));
router.use(bodyParser.json());

// Настраиваем preflight OPTIONS запросы
router.options('*', cors(corsOptions));

// URL Ollama сервера
const OLLAMA_SERVER = process.env.OLLAMA_SERVER || 'http://localhost:11434';

// Обработчик ошибок
const handleError = (res, error) => {
  console.error('Ollama API Error:', error.message);
  res.status(500).json({
    error: error.response?.data?.error || 'Internal Server Error',
    details: error.message
  });
};

// Общий обработчик прокси
router.all('/:path(*)', async (req, res) => {
  try {
    const path = req.params.path;
    const apiUrl = `${OLLAMA_SERVER}/${path}`;
    
    console.log(`Proxying request to: ${apiUrl}`);
    
    const config = {
      method: req.method,
      url: apiUrl,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    // Добавляем body для не-GET запросов
    if (req.method !== 'GET' && Object.keys(req.body).length > 0) {
      config.data = req.body;
    }
    
    const response = await axios(config);
    
    // Отправляем ответ клиенту
    res.status(response.status).json(response.data);
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
