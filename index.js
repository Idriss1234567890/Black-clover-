const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// المتغيرات المطلوبة (ضع قيمك هنا أو في Vercel Env)
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'my_secret_token';

// ذاكرة مؤقتة لتخزين رقم الصفحة لكل مستخدم (تختفي عند إعادة تشغيل السيرفر)
let userState = {};

// مسار التحقق من الـ Webhook لفيسبوك
app.get('/', (req, res) => {
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// استقبال الرسائل
app.post('/', (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(entry => {
            let webhook_event = entry.messaging[0];
            let sender_psid = webhook_event.sender.id;

            if (webhook_event.message && webhook_event.message.text) {
                handleMessage(sender_psid, webhook_event.message.text.trim());
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

async function handleMessage(psid, text) {
    const query = text.toLowerCase();

    // 1. أمر العودة للقائمة الرئيسية
    if (query === 'list') {
        userState[psid] = { query: '', page: 1 };
        return sendTextMessage(psid, "🏠 القائمة الرئيسية:\nأرسل اسم الأنمي للبحث عن خلفيات (مثلاً: One Piece).");
    }

    // 2. أمر المزيد
    if (query === 'مزيد' || query === 'more') {
        if (!userState[psid] || !userState[psid].query) {
            return sendTextMessage(psid, "يرجى كتابة اسم الأنمي أولاً قبل طلب المزيد.");
        }
        userState[psid].page += 1;
        return fetchAndSend(psid, userState[psid].query, userState[psid].page);
    }

    // 3. بحث جديد
    userState[psid] = { query: text, page: 1 };
    fetchAndSend(psid, text, 1);
}

async function fetchAndSend(psid, query, page) {
    try {
        await sendTextMessage(psid, `🔍 جاري البحث عن ${query} (صفحة ${page})...`);
        
        // استبدل هذا الرابط بـ Endpoint الخاص بـ AnimePixels API الفعلي
        const response = await axios.get(`https://api.animepixels.net/v1/search`, {
            params: { q: query, page: page }
        });

        const results = response.data.results || [];
        const topFive = results.slice(0, 5);

        if (topFive.length === 0) {
            return sendTextMessage(psid, "❌ لم يتم العثور على نتائج.");
        }

        // إرسال الصور
        for (let item of topFive) {
            await sendAttachment(psid, 'image', item.url);
        }

        await sendTextMessage(psid, "✅ أرسل 'مزيد' للحصول على صور أخرى، أو 'list' للبحث من جديد.");

    } catch (error) {
        console.error(error);
        sendTextMessage(psid, "⚠️ حدث خطأ أثناء جلب البيانات من API.");
    }
}

// وظائف إرسال لـ Facebook API
async function sendTextMessage(psid, text) {
    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
        recipient: { id: psid },
        message: { text: text }
    });
}

async function sendAttachment(psid, type, url) {
    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
        recipient: { id: psid },
        message: {
            attachment: {
                type: type,
                payload: { url: url, is_selectable: true }
            }
        }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));