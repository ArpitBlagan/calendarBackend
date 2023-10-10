const express=require('express');
const cors=require('cors');
const cookieParser=require('cookie-parser');
const {google}=require('googleapis');
require('dotenv').config();
const mongoose=require('mongoose');
mongoose.connect("mongodb+srv://Arpit:Ab123@cluster0.j4fl22k.mongodb.net/assignment",{
  useNewUrlParser: true,
useUnifiedTopology: true,
}).then(con=>{console.log("connnected")});
const app=express();
app.use(cors({
    origin:['http://localhost:5173','https://65242e13da108e00a0677408--lighthearted-kheer-5a0511.netlify.app'],
    credentials:true
}));
app.use(cookieParser());
const tDB= require('./model/tokenSchema');
const calendar=google.calendar({
    version:"v3",
    auth:process.env.KEY
});
const url="https://calendarclone.onrender.com/google/auth";
const oauth2Client=new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    url
);

const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/calendar.readonly'
];
app.get('/login',(req,res)=>{
    const url=oauth2Client.generateAuthUrl({
        access_type:'offline',
        approval_prompt: 'auto',
        scope:scopes
    });
    console.log(url);
    res.redirect(url);
});
app.get('/google/auth',async(req,res)=>{
    const code=req.query.code;
    const {tokens}=await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    console.log(tokens);
    const storedAccessToken=tokens.access_token;
    const storedRefreshToken='';
    if(tokens.refresh_token){
        storedRefreshToken=tokens.refresh_token;
        const val=await tDB.create({
            access_token:storedAccessToken,
            refresh_token:storedRefreshToken
        });console.log(val);
    }
    res.cookie('token',storedAccessToken,{
      httpOnly:true,
         expires:new  Date(Date.now()+(30*24*60*60*1000)),
         sameSite: 'none',
         secure:true
 }) 
     res.redirect('https://65242e13da108e00a0677408--lighthearted-kheer-5a0511.netlify.app/main');
});
app.get('/info',async(req,res)=>{
    const token=req.cookies.token;
    console.log(token);
    if(!token||token==''){
        return  res.send({msg:"Login Required"})
    }
    let storedAccessToken='';
    let storedRefreshToken='';
    if(token){
      const val=await tDB.find({access_token:token});
      if(!val){
        return  res.send({msg:"Login Required"})
      }
      storedAccessToken=val.access_token;
      storedRefreshToken=val.refresh_token;
    }
    if (storedRefreshToken=='') {console.log("Error here");return  res.send({msg:"Login Required"})}
    // Set the stored refresh token on the OAuth2 client.
    oauth2Client.setCredentials({ refresh_token: storedRefreshToken });
    // Refresh the access token.
    const { credentials } = await oauth2Client.refreshAccessToken();
    // Set the new access token on the OAuth2 client.
    console.log("cred:  ",credentials);
    oauth2Client.setCredentials(credentials);
    const people = google.people({ version: 'v1', auth: oauth2Client });
    const data=await people.people.get({
        resourceName: 'people/me',
        personFields: 'names,emailAddresses,photos'
      }).catch((err)=>{
        console.log("info: ",err);
       return  res.send({msg:"Login Required"})
    })
    if(data){
        const profile = data.data;
        console.log(profile);
        console.log(`Name: ${profile.names[0].displayName}`);
        console.log(`Email: ${profile.emailAddresses[0].value}`);
        console.log(`Photo: ${profile.photos[0].url}`);
        const name=profile.names[0].displayName;
        const email=profile.emailAddresses[0].value;
        const img=profile.photos[0].url
        return res.status(200).json({name,email,img});
    }return  res.send({msg:"Login Required"})
});
app.get('/logout',async(req,res)=>{
    const token=req.cookies.token;
    console.log(token);
    const ff=await tDB.deleteOne({access_token:token});
    console.log("logout",ff);
    oauth2Client.revokeToken( storedAccessToken,(err, response) => {
        if (err) {
          console.error('Error revoking access token:', err);
        } else {
          console.log('Access token revoked successfully');
        }
      });
      
      // Revoke the refresh token (if supported by the OAuth2 provider)
      if (storedRefreshToken) {
        oauth2Client.revokeToken(storedRefreshToken, (err, response) => {
          if (err) {
            console.error('Error revoking refresh token:', err);
          } else {
            console.log('Refresh token revoked successfully');
          }
        });
      }
    res.cookie("token",'',{
        httpOnly:true,
        sameSite: 'none',
        secure: true, 
    });
      res.send({msg:"done"});
});
app.get('/events',async(req,res)=>{
    const token=req.cookies.token;
    console.log("cal",token)
    if(!token||token==''){
      return  res.send({msg:"Login Required"})
    }
    let storedAccessToken='';
    let storedRefreshToken='';
    if(token){
      const val=await tDB.find({access_token:token});
      if(!val){
        return  res.send({msg:"Login Required"})
      }
      storedAccessToken=val.access_token;
      storedRefreshToken=val.refresh_token;
    }
    if (storedRefreshToken=='') {return  res.send({msg:"Login Required"})}
    // Set the stored refresh token on the OAuth2 client.
    oauth2Client.setCredentials({ refresh_token: storedRefreshToken });
    // Refresh the access token.
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log("cred:  ",credentials);
    // Set the new access token on the OAuth2 client.
    oauth2Client.setCredentials(credentials);
    const data=await  calendar.events.list({
        calendarId: "primary",
        auth:oauth2Client
      }).catch((err)=>{
        console.log("cal",err);
       return  res.send({msg:"Login Required"})
    })
    if(data){
        const events=data?.data?.items;
        //console.log(events);
        return res.status(200).json(events);
    }return  res.send({msg:"Login Required"})
});
app.listen(process.env.PORT,()=>{
    console.log(`Listening on Port ${process.env.PORT}`);
})
