import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import serverless from 'serverless-http';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') || true, methods: ['GET','POST','PATCH','DELETE'] }));
app.use(express.json({ limit: '100kb' }));
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({ name:{type:String,required:true,trim:true,maxlength:80}, email:{type:String,required:true,unique:true,lowercase:true,trim:true}, passwordHash:{type:String,required:true}, role:{type:String,enum:['customer','owner'],default:'customer'} }, {timestamps:true}));
const Product = mongoose.models.Product || mongoose.model('Product', new mongoose.Schema({
  name:{type:String,required:true,trim:true,maxlength:120},
  category:{type:String,required:true,trim:true,maxlength:80},
  price:{type:Number,required:true,min:0},
  imageUrl:{type:String,trim:true,maxlength:1000,default:''},
  description:{type:String,trim:true,maxlength:1500,default:''},
  sizes:{type:[String],default:[]},
  inStock:{type:Boolean,default:true}
}, {timestamps:true}));
const Review = mongoose.models.Review || mongoose.model('Review', new mongoose.Schema({ user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}, text:{type:String,required:true,trim:true,minlength:10,maxlength:1000}, rating:{type:Number,required:true,min:1,max:5}, reply:{text:{type:String,trim:true,maxlength:1000},createdAt:Date} }, {timestamps:true}));
let connection;
async function connect(){
  if(!process.env.MONGODB_URI) throw new Error('Server database is not configured.');
  if(!connection) {
    connection=mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000,connectTimeoutMS:5000});
    connection.catch(()=>{connection=null;});
  }
  return connection;
}
function token(user){ return jwt.sign({sub:user._id.toString(),role:user.role},process.env.JWT_SECRET,{expiresIn:'7d'}); }
async function authenticate(req,res,next){ try { await connect(); const raw=req.headers.authorization?.replace('Bearer ',''); if(!raw) throw Error(); const data=jwt.verify(raw,process.env.JWT_SECRET); req.user=await User.findById(data.sub); if(!req.user) throw Error(); next(); } catch { res.status(401).json({message:'Please sign in to continue.'}); } }
function owner(req,res,next){ return req.user?.role==='owner' ? next() : res.status(403).json({message:'Store-owner access is required.'}); }
function publicUser(user){ return {id:user._id,name:user.name,email:user.email,role:user.role}; }
function productInput(body){
  const sizes=['XS','S','M','L','XL','XXL','3XL'];
  return {
    name:typeof body.name==='string'?body.name.trim():'', category:typeof body.category==='string'?body.category.trim():'',
    price:Number(body.price), imageUrl:typeof body.imageUrl==='string'?body.imageUrl.trim():'',
    description:typeof body.description==='string'?body.description.trim():'',
    sizes:Array.isArray(body.sizes)?[...new Set(body.sizes.filter(size=>sizes.includes(size)))]:[], inStock:body.inStock!==false
  };
}
app.get('/api/health', async (_,res)=>{ try { await connect(); res.json({ok:true}); } catch { res.status(503).json({ok:false}); } });
app.post('/api/auth/register', async (req,res)=>{ try { await connect(); const {name,email,password}=req.body; if(!name || !email || typeof password!=='string' || password.length<8) return res.status(400).json({message:'Name, a valid email, and an 8+ character password are required.'}); const exists=await User.findOne({email:email.toLowerCase()}); if(exists) return res.status(409).json({message:'An account with that email already exists.'}); const role=email.toLowerCase()===process.env.OWNER_EMAIL?.toLowerCase()?'owner':'customer'; const user=await User.create({name,email,passwordHash:await bcrypt.hash(password,12),role}); res.status(201).json({token:token(user),user:publicUser(user)}); }catch(e){console.error('Registration failed',e);res.status(503).json({message:'Signup is temporarily unavailable. Please try again shortly.'});} });
app.post('/api/auth/login', async (req,res)=>{ try { await connect(); const {email,password}=req.body; const user=await User.findOne({email:email?.toLowerCase()}); if(!user || !await bcrypt.compare(password||'',user.passwordHash)) return res.status(401).json({message:'Invalid email or password.'}); res.json({token:token(user),user:publicUser(user)}); }catch(e){res.status(500).json({message:'Could not sign you in.'});} });
app.get('/api/auth/me',authenticate,(req,res)=>res.json({user:publicUser(req.user)}));
app.get('/api/products', async (_,res)=>{ try{await connect();res.json({products:await Product.find().sort({createdAt:-1}).lean()});}catch{res.status(500).json({message:'Could not load products.'});} });
app.get('/api/admin/products',authenticate,owner,async(_,res)=>{try{res.json({products:await Product.find().sort({createdAt:-1}).lean()});}catch{res.status(500).json({message:'Could not load products.'});}});
app.post('/api/products',authenticate,owner,async(req,res)=>{try{await connect();const product=await Product.create(productInput(req.body));res.status(201).json({product});}catch{res.status(400).json({message:'Add a product name, category, and valid price.'});}});
app.patch('/api/products/:id',authenticate,owner,async(req,res)=>{try{const product=await Product.findByIdAndUpdate(req.params.id,productInput(req.body),{new:true,runValidators:true});product?res.json({product}):res.status(404).json({message:'Product not found.'});}catch{res.status(400).json({message:'Could not update this product.'});}});
app.delete('/api/products/:id',authenticate,owner,async(req,res)=>{const product=await Product.findByIdAndDelete(req.params.id);product?res.status(204).end():res.status(404).json({message:'Product not found.'});});
app.get('/api/reviews',async(_,res)=>{try{await connect();res.json({reviews:await Review.find().populate('user','name').sort({createdAt:-1}).lean()});}catch{res.status(500).json({message:'Could not load reviews.'});}});
app.post('/api/reviews',authenticate,async(req,res)=>{try{const {text,rating}=req.body;const review=await Review.create({user:req.user._id,text,rating});res.status(201).json({review});}catch{res.status(400).json({message:'A 10–1000 character review and a 1–5 rating are required.'});}});
app.patch('/api/reviews/:id/reply',authenticate,owner,async(req,res)=>{try{const review=await Review.findByIdAndUpdate(req.params.id,{$set:{reply:{text:req.body.text,createdAt:new Date()}}},{new:true,runValidators:true});review?res.json({review}):res.status(404).json({message:'Review not found.'});}catch{res.status(400).json({message:'A reply is required.'});}});
app.use((_,res)=>res.status(404).json({message:'Not found.'}));
export default serverless(app);
