const mongoose=require('mongoose');
const FollowUpSchema=new mongoose.Schema({customer:{type:mongoose.Schema.Types.ObjectId,ref:'Customer',required:true},salesperson:String,dueAt:{type:Date,required:true},type:{type:String,enum:['Call','WhatsApp','Email','Visit','Quotation'],default:'Call'},status:{type:String,enum:['Pending','Completed','Cancelled'],default:'Pending'},priority:{type:String,enum:['Low','Medium','High'],default:'Medium'},summary:String,nextAction:String,completedAt:Date},{timestamps:true});
module.exports=mongoose.model('FollowUp',FollowUpSchema);
