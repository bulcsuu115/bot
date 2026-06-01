import express from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../utils/config';

export function createWebApp() {
  const app = express();

  const viewsPath = fs.existsSync(path.join(__dirname, 'views'))
    ? path.join(__dirname, 'views')
    : path.join(process.cwd(), 'src/web/views');
  app.set('view engine', 'ejs');
  app.set('views', viewsPath);
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  const telegramLink = config.botUsername;

  app.get('/', (req, res) => {
    res.render('landing', { telegramLink });
  });

  return app;
}
