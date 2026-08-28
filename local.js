import 'dotenv/config';
import handler from './api/index.js';
import http from 'http';
http.createServer((req,res)=>handler(req,res)).listen(process.env.PORT || 3000,()=>console.log('API running on port '+(process.env.PORT||3000)));
