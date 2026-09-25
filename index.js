require("dotenv").config();
const express=require("express");
const session=require("express-session");
const cors=require("cors");
const {google}=require("googleapis");

const app=express();
const PORT=process.env.PORT||3000;
const FRONTEND=process.env.FRONTEND_URL||"https://mygolive.netlify.app";

app.use(cors({origin:FRONTEND,credentials:true}));
app.use(express.json());
app.set("trust proxy",1);
app.use(session({
  secret:process.env.SESSION_SECRET||"CHANGE_ME",
  resave:false,saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:"none",secure:true}
}));

function yt(){
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"StreamHub backend"}));
app.get("/api/status",(req,res)=>res.json({
  youtubeConnected:!!req.session.youtubeTokens,
  facebookConnected:!!req.session.facebookToken
}));

app.get("/auth/youtube",(req,res)=>{
  if(!process.env.GOOGLE_CLIENT_ID) return res.status(500).send("Google OAuth is not configured.");
  const client=yt();
  res.redirect(client.generateAuthUrl({
    access_type:"offline",prompt:"consent",
    scope:["https://www.googleapis.com/auth/youtube"]
  }));
});

app.get("/auth/youtube/callback",async(req,res)=>{
  try{
    const client=yt();
    const {tokens}=await client.getToken(req.query.code);
    req.session.youtubeTokens=tokens;
    res.redirect(FRONTEND+"?youtube=connected");
  }catch(err){
    console.error(err);
    res.status(500).send("YouTube OAuth failed. Check redirect URI and credentials.");
  }
});

app.get("/auth/facebook",(req,res)=>{
  if(!process.env.META_APP_ID) return res.status(500).send("Meta OAuth is not configured.");
  const version=process.env.META_GRAPH_VERSION||"v23.0";
  const redirect=encodeURIComponent(process.env.META_REDIRECT_URI);
  const scope=encodeURIComponent("pages_show_list,pages_read_engagement,pages_manage_posts");
  const url=`https://www.facebook.com/${version}/dialog/oauth?client_id=${encodeURIComponent(process.env.META_APP_ID)}&redirect_uri=${redirect}&scope=${scope}`;
  res.redirect(url);
});

app.get("/auth/facebook/callback",(req,res)=>{
  // Complete Meta authorization/token exchange here after configuring
  // the Meta app and the permissions available to your app.
  res.redirect(FRONTEND+"?facebook=callback_received");
});

app.post("/api/youtube/create-live",async(req,res)=>{
  if(!req.session.youtubeTokens) return res.status(401).json({error:"Connect YouTube first."});
  try{
    const auth=yt(); auth.setCredentials(req.session.youtubeTokens);
    const youtube=google.youtube({version:"v3",auth});
    const title=String(req.body.title||"StreamHub Live").slice(0,100);
    const description=String(req.body.description||"").slice(0,5000);
    const privacy=["public","unlisted","private"].includes(req.body.privacy)?req.body.privacy:"unlisted";
    const start=new Date(Date.now()+120000).toISOString();

    const b=await youtube.liveBroadcasts.insert({
      part:["snippet","status","contentDetails"],
      requestBody:{
        snippet:{title,description,scheduledStartTime:start},
        status:{privacyStatus:privacy},
        contentDetails:{enableAutoStart:false,enableAutoStop:true}
      }
    });

    const s=await youtube.liveStreams.insert({
      part:["snippet","cdn","contentDetails"],
      requestBody:{
        snippet:{title},
        cdn:{frameRate:"30fps",resolution:"720p",ingestionType:"rtmp"},
        contentDetails:{isReusable:false}
      }
    });

    await youtube.liveBroadcasts.bind({
      part:["id,snippet"],
      id:b.data.id,
      streamId:s.data.id
    });

    const i=s.data.cdn?.ingestionInfo||{};
    res.json({
      ok:true,
      broadcastId:b.data.id,
      streamId:s.data.id,
      rtmpUrl:i.ingestionAddress||null,
      streamKey:i.streamName||null,
      note:"Use the RTMP URL + stream key in your encoder/streaming server. After the stream is active, call /api/youtube/start-live."
    });
  }catch(err){
    console.error(err.response?.data||err);
    res.status(500).json({error:err.response?.data?.error?.message||"YouTube Live API failed."});
  }
});

app.post("/api/youtube/start-live",async(req,res)=>{
  if(!req.session.youtubeTokens) return res.status(401).json({error:"Connect YouTube first."});
  try{
    const auth=yt(); auth.setCredentials(req.session.youtubeTokens);
    const youtube=google.youtube({version:"v3",auth});
    const out=await youtube.liveBroadcasts.transition({
      part:["id","status"],
      id:req.body.broadcastId,
      broadcastStatus:"live"
    });
    res.json({ok:true,status:out.data.status?.lifeCycleStatus});
  }catch(err){
    res.status(500).json({error:err.response?.data?.error?.message||"Could not start broadcast."});
  }
});

app.post("/api/youtube/stop-live",async(req,res)=>{
  if(!req.session.youtubeTokens) return res.status(401).json({error:"Connect YouTube first."});
  try{
    const auth=yt(); auth.setCredentials(req.session.youtubeTokens);
    const youtube=google.youtube({version:"v3",auth});
    const out=await youtube.liveBroadcasts.transition({
      part:["id","status"],
      id:req.body.broadcastId,
      broadcastStatus:"complete"
    });
    res.json({ok:true,status:out.data.status?.lifeCycleStatus});
  }catch(err){
    res.status(500).json({error:err.response?.data?.error?.message||"Could not stop broadcast."});
  }
});

app.listen(PORT,()=>console.log(`StreamHub backend listening on ${PORT}`));
