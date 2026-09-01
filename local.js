import 'dotenv/config';
import app from './api/index.js';
import http from 'http';
http.createServer(app).listen(process.env.PORT || 3000,()=>console.log('API running on port '+(process.env.PORT||3000)));
