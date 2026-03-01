const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const app = express();

// Эти ключи будут на сервере, в безопасности!
const SUPABASE_URL = "https://njqhoiedauyyivbhvyla.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qcWhvaWVkYXV5eWl2Ymh2eWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEzNzY5NjQsImV4cCI6MjA1Njk1Mjk2NH0.nWbuowFz2rI4zMeci0a-JGSyGCC3xFmh8oVRTz14eZ8"; // НЕ anon ключ!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

app.use(cors());
app.use(express.json());

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
  
  // Проверка свободного времени
  const { data: blocks } = await supabase
    .from('block_time')
    .select('*')
    .eq('date', date);
    
  const { data: existing } = await supabase
    .from('client_appointments')
    .select('time')
    .eq('date', date);

  // Тут ваша логика проверки времени (можно скопировать из вашего order.html)

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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));