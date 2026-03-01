const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ РАЗРЕШАЕМ ЗАПРОСЫ С ВАШЕГО САЙТА
app.use(cors({
  origin: 'https://shimmering-panda-4e619f.netlify.app', // ТОЛЬКО ваш сайт
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Эти переменные берутся из окружения (Render или .env файл)
const SUPABASE_URL = process.env.SUPABASE_URL || "https://njqhoiedauyyivbhvyla.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Проверка, что ключ загружен
if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY is not set! Check your environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ===== ВСЕ ВАШИ ЗАПРОСЫ ИДУТ СЮДА =====

// 1. Получение записей (как в my_appoint.html)
app.get('/api/appointments', async (req, res) => {
  const { fullName, phone } = req.query;
  
  let query = supabase
    .from('client_appointments')
    .select('*')
    .order('date', { ascending: false });

  if (fullName) query = query.eq('fullname', fullName);
  if (phone) {
    const searchPhone = phone.replace(/\D/g, '').slice(-9);
    query = query.or(`phone.ilike.%${searchPhone}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json(error);
  res.json(data);
});

// 2. Получение ожидающих записей
app.get('/api/pending-appointments', async (req, res) => {
  const { fullName, phone } = req.query;
  
  let query = supabase
    .from('appointments')
    .select('*')
    .is('status', null)
    .order('date', { ascending: false });

  if (fullName) query = query.eq('fullname', fullName);
  if (phone) {
    const searchPhone = phone.replace(/\D/g, '').slice(-9);
    query = query.or(`phone.ilike.%${searchPhone}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json(error);
  res.json(data);
});

// 3. Создание записи (как в order.html)
app.post('/api/create-appointment', async (req, res) => {
  const { fullname, phone, service, date, time, price, cost_price } = req.body;
  
  // Проверка свободного времени (упрощенная)
  const { data: blocks } = await supabase
    .from('block_time')
    .select('*')
    .eq('date', date);
    
  const { data: existing } = await supabase
    .from('client_appointments')
    .select('time')
    .eq('date', date);

  // Здесь можно добавить вашу логику проверки времени

  const { data, error } = await supabase
    .from('appointments')
    .insert([{ fullname, phone, service, date, time, price, cost_price, status: null }]);

  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

// 4. Отправка feedback (как в feed.html)
app.post('/api/feedback', async (req, res) => {
  const { fullname, phone, mass } = req.body;
  
  const { error } = await supabase
    .from('feedback_user')
    .insert([{ fullname, phone, mass }]);

  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

// 5. Авторизация (как в index.html)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email, password
  });

  if (error) return res.status(401).json(error);
  res.json(data);
});

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  
  const { data, error } = await supabase.auth.signUp({
    email, password
  });

  if (error) return res.status(400).json(error);
  res.json(data);
});

// 6. Получение профиля
app.get('/api/profile/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.params.userId)
    .single();

  if (error) return res.status(500).json(error);
  res.json(data);
});

// 7. Обновление профиля
app.post('/api/profile', async (req, res) => {
  const { userId, first_name, last_name, phone } = req.body;
  
  const { error } = await supabase
    .from('profiles')
    .update({ first_name, last_name, phone })
    .eq('id', userId);

  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
