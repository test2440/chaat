// خادم بسيط بـ Express يعمل كبروكسي لـ OpenAI ويحمي المفتاح
// يتعامل مع Responses API ويرجع نص المساعدة

import express from 'express';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static('.')); // يقدم index.html والملفات الساكنة من جذر المشروع

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if(!OPENAI_API_KEY){
  console.warn('⚠️ ضع OPENAI_API_KEY في متغيرات البيئة قبل التشغيل على Render');
}

app.post('/api/chat', async (req, res) => {
  try{
    const { model = 'gpt-4o-mini', messages = [], system } = req.body || {};
    // نحول الرسائل لصيغة inputs الخاصة بـ Responses API
    // سنرسل System كمقدمة، وبعدها الرسائل التناوبية User/Assistant
    const input = [];
    if(system){ input.push({ role: 'system', content: [ { type:'text', text: system } ] }); }
    for(const m of messages){
      input.push({ role: m.role, content: [ { type:'text', text: m.content } ] });
    }

    const r = await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type':'application/json'
      },
      body: JSON.stringify({
        model,
        input,
        // اختيارياً: نقدر نطلب تنسيق نصي فقط
        // modalities: ['text']
      })
    });

    if(!r.ok){
      const errText = await r.text();
      return res.status(r.status).send(errText);
    }

    const data = await r.json();
    // استخراج النص من أول message
    const text = data?.output?.[0]?.content?.map(p=>p?.text || '').join('\n')
             || data?.output_text
             || data?.choices?.[0]?.message?.content
             || '';

    res.json({ text });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log('✅ Server running on http://localhost:'+port));
