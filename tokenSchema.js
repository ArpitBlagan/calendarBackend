const mongoose=require('mongoose');
const tokenSchema=mongoose.Schema({
    access_token:String,
    refresh_token:String
});
module.exports=mongoose.model('tDB',tokenSchema);
