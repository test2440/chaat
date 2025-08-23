// خادم Express يعمل كبروكسي آمن لـ OpenAI Responses API
// يدعم: نص + صور (input_text, input_image) | إشعار تيليجرام للمطوّر

import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.')); // تقديم index.html والملفات الساكنة

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if(!OPENAI_API_KEY){
  console.warn('⚠️ ضع OPENAI_API_KEY في متغيرات البيئة قبل التشغيل.');
}

// نقطة محادثة
app.post('/api/chat', async (req, res) => {
  try{
    const { model = 'gpt-4o-mini', input = [] } = req.body || {};

    // تحقق بسيط من الأنواع لمنع الخطأ الشائع "type: text"
    for(const msg of input){
      for(const part of (msg.content||[])){
        const t = part.type;
        if(t && !['input_text','input_image'].includes(t)){
          return res.status(400).json({ error: { message: `نوع غير مدعوم: ${t}. استخدم input_text أو input_image.` }});
        }
      }
    }

    const r = await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, input })
    });

    if(!r.ok){
      const errText = await r.text();
      return res.status(r.status).send(errText);
    }

    const data = await r.json();
    const text = data?.output?.[0]?.content?.filter(p=>p?.type==='output_text').map(p=>p?.text||'').join('\n')
             || data?.output_text
             || data?.choices?.[0]?.message?.content
             || '';

    res.json({ text });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// إشعار للمطوّر عبر تيليجرام
app.post('/api/notify', async (req, res) => {
  try{
    const { message } = req.body || {};
    if(!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID){
      return res.status(400).json({ error: 'إعدادات تيليجرام غير مضافة.' });
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = { chat_id: TELEGRAM_CHAT_ID, text: `رسالة من موقع الشات:\n${message}` };
    const r = await fetch(url,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const data = await r.json();
    if(!data.ok) return res.status(500).json({ error: data.description });
    res.json({ ok: true });
  }catch(e){ res.status(500).json({ error: e.message }); }
});

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log('✅ Server running on http://localhost:'+port));
