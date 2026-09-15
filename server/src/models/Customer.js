const mongoose=require('mongoose');
const CustomerSchema=new mongoose.Schema({customerCode:{type:String,unique:true},name:{type:String,required:true},phone:String,whatsapp:String,email:String,location:String,source:{type:String,default:'Walk-in'},assignedSalesperson:String,status:{type:String,enum:['Active','Converted','Lost','Inactive'],default:'Active'},productInterest:String,quotationAmount:{type:Number,default:0},notes:String},{timestamps:true});
module.exports=mongoose.model('Customer',CustomerSchema);
