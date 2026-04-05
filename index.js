const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// تخزين حالة المستخدم
let userState = {};

// delay لتفادي حظر فيسبوك
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("Bot is running ✅");
});

// التحقق
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }
  res.send("Error");
});

// استقبال الرسائل
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (body.object === "page") {
      for (const entry of body.entry) {
        const event = entry.messaging[0];
        const sender = event.sender.id;

        if (event.message && event.message.text) {
          let text = event.message.text.trim().toLowerCase();

          // رجوع
          if (text === "list") {
            userState[sender] = null;
            await sendText(sender, "📌 أرسل اسم أنمي (مثال: one piece)");
            continue;
          }

          // مزيد
          if (text === "مزيد") {
            if (!userState[sender]) {
              await sendText(sender, "❗ أرسل اسم أنمي أولاً");
              continue;
            }

            await sendAnimeImage(sender, userState[sender]);
            continue;
          }

          // بحث جديد
          userState[sender] = text.replace(/\s+/g, "");

          await sendText(sender, `🔍 جاري البحث عن ${text}...`);
          await sendAnimeImage(sender, userState[sender]);
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.log("MAIN ERROR:", err);
    res.sendStatus(200);
  }
});

// 🔥 جلب صورة حسب الأنمي
async function sendAnimeImage(userId, category) {
  try {
    const url = `https://animepixels-api.vercel.app/api/media/random/image?category=${category}`;

    const res = await axios.get(url);

    if (!res.data || !res.data.url) {
      return sendText(userId, "❌ لا توجد صور لهذا الأنمي");
    }

    await sendImage(userId, res.data.url);
    await delay(500); // مهم جداً

  } catch (err) {
    console.log("IMAGE ERROR:", err.response?.data || err.message);
    await sendText(userId, "⚠️ لم يتم العثور على صور لهذا الأنمي");
  }
}

// إرسال نص
async function sendText(userId, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: userId },
        message: { text }
      }
    );
  } catch (err) {
    console.log("TEXT ERROR:", err.response?.data || err.message);
  }
}

// إرسال صورة
async function sendImage(userId, url) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: userId },
        message: {
          attachment: {
            type: "image",
            payload: { url }
          }
        }
      }
    );
  } catch (err) {
    console.log("IMAGE SEND ERROR:", err.response?.data || err.message);
  }
}

module.exports = app;