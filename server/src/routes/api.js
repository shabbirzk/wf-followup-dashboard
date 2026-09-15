const router=require('express').Router(); const Customer=require('../models/Customer'); const FollowUp=require('../models/FollowUp');
router.get('/customers',async(req,res)=>res.json(await Customer.find().sort({createdAt:-1})));
router.post('/customers',async(req,res)=>{const count=await Customer.countDocuments(); const c=await Customer.create({...req.body,customerCode:`CUST-${String(count+1).padStart(4,'0')}`});res.status(201).json(c)});
router.patch('/customers/:id',async(req,res)=>res.json(await Customer.findByIdAndUpdate(req.params.id,req.body,{new:true})));
router.get('/followups',async(req,res)=>res.json(await FollowUp.find().populate('customer').sort({dueAt:1})));
router.post('/followups',async(req,res)=>res.status(201).json(await FollowUp.create(req.body)));
router.patch('/followups/:id',async(req,res)=>{const data={...req.body};if(data.status==='Completed')data.completedAt=new Date();res.json(await FollowUp.findByIdAndUpdate(req.params.id,data,{new:true}).populate('customer'))});
router.get('/summary',async(req,res)=>{const now=new Date();const end=new Date(now);end.setHours(23,59,59,999);const [customers,pending,today,overdue,completed,converted]=await Promise.all([Customer.countDocuments(),FollowUp.countDocuments({status:'Pending'}),FollowUp.countDocuments({status:'Pending',dueAt:{$gte:now,$lte:end}}),FollowUp.countDocuments({status:'Pending',dueAt:{$lt:now}}),FollowUp.countDocuments({status:'Completed'}),Customer.countDocuments({status:'Converted'})]);res.json({customers,pending,today,overdue,completed,converted})});
module.exports=router;
