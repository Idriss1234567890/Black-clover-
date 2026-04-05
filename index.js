const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// تخزين الحالة (اسم + offset + الصور)
let userState = {};

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

          // 🔁 list
          if (text === "list") {
            userState[sender] = null;
            await sendText(sender, "📌 أرسل اسم أنمي (مثال: one piece)");
            continue;
          }

          // 👑 القائمة
          if (text === "القائمة") {
            await sendText(sender, "👑 مطوّر البوت:\nhttps://www.facebook.com/idriss.wle");
            continue;
          }

          // ➕ مزيد (صورة واحدة فقط)
          if (text === "مزيد") {
            if (!userState[sender]) {
              await sendText(sender, "❗ أرسل اسم أنمي أولاً");
              continue;
            }

            await sendNextImage(sender);
            continue;
          }

          // 🔍 بحث جديد
          userState[sender] = {
            query: text,
            offset: 0,
            images: []
          };

          await sendText(sender, `🔍 جاري البحث عن ${text}...`);
          await sendNextImage(sender);
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.log("MAIN ERROR:", err);
    res.sendStatus(200);
  }
});

// 🔥 إرسال صورة واحدة فقط
async function sendNextImage(userId) {
  try {
    let state = userState[userId];

    // إذا ما كاين صور في الكاش → جيب دفعة جديدة
    if (!state.images || state.images.length === 0) {
      const url = `https://animepixels-api.vercel.app/api/media/search/image?q=${encodeURIComponent(state.query)}&limit=5&offset=${state.offset}`;

      const response = await axios.get(url);

      if (!response.data || !response.data.results || response.data.results.length === 0) {
        return sendText(userId, "❌ لا توجد صور أخرى");
      }

      state.images = response.data.results;
      state.offset += 5;
    }

    // خذ صورة وحدة فقط
    const img = state.images.shift();

    if (img && img.url) {
      await sendImage(userId, img.url);
      await delay(300);
      await sendText(userId, "📩 أرسل (مزيد) لصورة أخرى");
    }

  } catch (err) {
    console.log("IMAGE ERROR:", err.response?.data || err.message);
    await sendText(userId, "⚠️ خطأ أثناء جلب الصور");
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
