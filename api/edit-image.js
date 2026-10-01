// api/edit-image.js
// Trạm trung gian chạy trên Vercel: nhận ảnh từ trình duyệt, gọi Google Gemini API (Nano Banana)
// bằng key bí mật lưu trong Environment Variables, trả kết quả về cho trình duyệt.

// Lưu ý: Vercel giới hạn dữ liệu gửi lên ~4.5MB, trang web đã tự nén ảnh JPEG trước khi gửi.
// Thời gian chạy tối đa (60 giây) được đặt trong file vercel.json ở thư mục gốc.

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server chưa cấu hình GEMINI_API_KEY (vào Vercel > Settings > Environment Variables để thêm).' });
      return;
    }

    var model = 'gemini-2.5-flash-image';
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';

    var body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType || 'image/png', data: imageBase64 } }
        ]
      }],
      generationConfig: { responseModalities: ['IMAGE'] }
    };

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await geminiRes.json();
    if (!geminiRes.ok) {
      var msg = (data && data.error && data.error.message) || ('Lỗi Gemini (HTTP ' + geminiRes.status + ')');
      res.status(geminiRes.status).json({ error: msg });
      return;
    }

    // Tìm phần ảnh trong kết quả Gemini trả về
    var imageData = null, imageMime = 'image/png', aiText = '';
    var cand = data && data.candidates && data.candidates[0];
    var parts = cand && cand.content && cand.content.parts;
    if (parts) {
      for (var i = 0; i < parts.length; i++) {
        var inline = parts[i].inlineData || parts[i].inline_data;
        if (inline && inline.data) {
          imageData = inline.data;
          imageMime = inline.mimeType || inline.mime_type || imageMime;
          break;
        }
        if (parts[i].text) aiText += parts[i].text + ' ';
      }
    }
    if (!imageData) {
      var reason = (data && data.promptFeedback && data.promptFeedback.blockReason) || (cand && cand.finishReason) || '';
      res.status(500).json({
        error: 'AI không trả về ảnh' + (reason ? ' (lý do: ' + reason + ')' : '') +
          (aiText ? ' — AI nói: ' + aiText.trim().slice(0, 300) : '') +
          '. Thử đổi lại mô tả hoặc ảnh khác.'
      });
      return;
    }

    // Giữ nguyên dạng kết quả { data: [{ b64_json }] } để trang web không cần sửa gì thêm
    res.status(200).json({ data: [{ b64_json: imageData, mime_type: imageMime }] });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Lỗi không xác định ở server.' });
  }
}
