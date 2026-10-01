// api/edit-image.js
// Trạm trung gian chạy trên Vercel: nhận ảnh từ trình duyệt, gọi OpenAI bằng key bí mật
// lưu trong Environment Variables (không ai nhìn thấy được từ bên ngoài), trả kết quả về.

export const config = {
  api: {
    bodyParser: { sizeLimit: '8mb' }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Chỉ chấp nhận POST.' });
    return;
  }

  try {
    const { imageBase64, mimeType, prompt } = req.body || {};
    if (!imageBase64 || !prompt) {
      res.status(400).json({ error: 'Thiếu ảnh hoặc mô tả.' });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server chưa cấu hình OPENAI_API_KEY (vào Vercel > Settings > Environment Variables để thêm).' });
      return;
    }

    const buffer = Buffer.from(imageBase64, 'base64');
    const blob = new Blob([buffer], { type: mimeType || 'image/png' });

    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('image', blob, 'image.png');
    form.append('prompt', prompt);
    form.append('size', '1024x1024');

    const openaiRes = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      body: form
    });

    const data = await openaiRes.json();
    if (!openaiRes.ok) {
      var msg = (data && data.error && data.error.message) || ('Lỗi OpenAI (HTTP ' + openaiRes.status + ')');
      res.status(openaiRes.status).json({ error: msg });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi không xác định ở server.' });
  }
}
