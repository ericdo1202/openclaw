import express from 'express';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const app = express();
app.use(express.json());

const HISTORY_FILE = path.join(process.cwd(), 'last_history_id.txt'); // file lưu historyId cuối cùng

async function getLastHistoryId() {
  try {
    return await fs.readFile(HISTORY_FILE, 'utf8');
  } catch (err) {
    return '0'; // nếu chưa có file, bắt đầu từ 0
  }
}

async function saveLastHistoryId(id) {
  await fs.writeFile(HISTORY_FILE, id.toString(), 'utf8');
}

app.post('/gmail-webhook', async (req, res) => {
  console.log('Google push mail mới:', new Date().toISOString());
  console.log('Notification body:', req.body);

  const notification = req.body.message?.data ? JSON.parse(Buffer.from(req.body.message.data, 'base64').toString()) : null;

  if (!notification || !notification.historyId) {
    console.log('Push không có historyId, bỏ qua.');
    return res.sendStatus(200);
  }

  const newHistoryId = notification.historyId;
  const lastHistoryId = await getLastHistoryId();

  if (newHistoryId <= lastHistoryId) {
    console.log(`HistoryId cũ hoặc bằng (${newHistoryId} <= ${lastHistoryId}), bỏ qua duplicate.`);
    return res.sendStatus(200);
  }

  console.log(`Có thay đổi mới (historyId ${newHistoryId} > ${lastHistoryId}) → xử lý mail mới nhất.`);

  // Chạy script poll để lấy mail mới nhất và xử lý
  exec('./poll_email_to_calendar.sh', (err, stdout, stderr) => {
    if (err) {
      console.error('Lỗi chạy script:', err);
      return;
    }
    console.log('Script output:', stdout);
    console.error('Script error:', stderr);
  });

  // Lưu historyId mới để lần sau bỏ qua
  await saveLastHistoryId(newHistoryId);

  res.sendStatus(200);
});

const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`Webhook server chạy trên port ${PORT} - chờ push từ Google...`);
  const lastId = await getLastHistoryId();
  console.log(`HistoryId cuối cùng đã xử lý: ${lastId}`);
});