const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Настройка CORS (выбери ОДИН вариант)

// ВАРИАНТ 1: Для продакшена - только твой сайт
app.use(cors({
  origin: 'https://shimmering-panda-4e619f.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ВАРИАНТ 2: Для разработки - все (закомментируй вариант 1)
// app.use(cors());

app.use(express.json());

// Конфигурация Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || "https://njqhoiedauyyivbhvyla.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY is not set! Check your environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ========== API ENDPOINTS ==========

// 1. Получение записей клиентов
app.get('/api/appointments', async (req, res) => {
  try {
    const { fullName, phone } = req.query;
    
    let query = supabase
      .from('client_appointments')
      .select('*')
      .order('date', { ascending: false });

    if (fullName) {
      query = query.eq('fullname', fullName);
    }
    
    if (phone) {
      const searchPhone = phone.replace(/\D/g, '').slice(-9);
      query = query.or(`phone.ilike.%${searchPhone}%`);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error in GET /api/appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Получение ожидающих записей
app.get('/api/pending-appointments', async (req, res) => {
  try {
    const { fullName, phone } = req.query;
    
    let query = supabase
      .from('appointments')
      .select('*')
      .is('status', null)
      .order('date', { ascending: false });

    if (fullName) {
      query = query.eq('fullname', fullName);
    }
    
    if (phone) {
      const searchPhone = phone.replace(/\D/g, '').slice(-9);
      query = query.or(`phone.ilike.%${searchPhone}%`);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error in GET /api/pending-appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Создание записи с проверкой времени
app.post('/api/create-appointment', async (req, res) => {
  try {
    const { fullname, phone, service, date, time, price, cost_price } = req.body;
    
    // Валидация обязательных полей
    if (!fullname || !phone || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Проверка заблокированного времени
    const { data: blocks, error: blockError } = await supabase
      .from('block_time')
      .select('*')
      .eq('date', date);
      
    if (blockError) throw blockError;
    
    // Проверка существующих записей
    const { data: existing, error: existingError } = await supabase
      .from('client_appointments')
      .select('time')
      .eq('date', date);
      
    if (existingError) throw existingError;
    
    // Твоя логика проверки времени
    // Например, проверка не заблокировано ли время
    const isTimeBlocked = blocks?.some(block => block.time === time);
    if (isTimeBlocked) {
      return res.status(400).json({ error: 'This time is blocked' });
    }
    
    // Проверка не занято ли время
    const isTimeTaken = existing?.some(app => app.time === time);
    if (isTimeTaken) {
      return res.status(400).json({ error: 'This time is already taken' });
    }

    // Создание записи
    const { data, error } = await supabase
      .from('appointments')
      .insert([{ 
        fullname, 
        phone, 
        service, 
        date, 
        time, 
        price, 
        cost_price, 
        status: null,
        created_at: new Date()
      }]);

    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in POST /api/create-appointment:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Отправка feedback
app.post('/api/feedback', async (req, res) => {
  try {
    const { fullname, phone, mass } = req.body;
    
    if (!fullname || !phone || !mass) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const { error } = await supabase
      .from('feedback_user')
      .insert([{ 
        fullname, 
        phone, 
        mass,
        created_at: new Date()
      }]);

    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Авторизация
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password
    });

    if (error) throw error;
    
    res.json(data);
  } catch (error) {
    console.error('Error in POST /api/auth/login:', error);
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const { data, error } = await supabase.auth.signUp({
      email, password
    });

    if (error) throw error;
    
    res.json(data);
  } catch (error) {
    console.error('Error in POST /api/auth/signup:', error);
    res.status(400).json({ error: error.message });
  }
});

// 6. Получение профиля
app.get('/api/profile/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.params.userId)
      .single();

    if (error) throw error;
    
    res.json(data);
  } catch (error) {
    console.error('Error in GET /api/profile/:userId:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Обновление профиля
app.post('/api/profile', async (req, res) => {
  try {
    const { userId, first_name, last_name, phone } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'UserId required' });
    }
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        first_name, 
        last_name, 
        phone,
        updated_at: new Date()
      })
      .eq('id', userId);

    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint (полезно для Render)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Обработка 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 CORS enabled for: https://shimmering-panda-4e619f.netlify.app`);
});
