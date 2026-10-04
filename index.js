const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const http = require('http');
const ffmpeg = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpeg;

// web server leggerissimo per Render (no express)
http.createServer((req,res)=>{ res.writeHead(200); res.end('Radio 105 OK'); }).listen(process.env.PORT||10000, ()=>console.log('web ok'));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
let connection = null;
let player = createAudioPlayer();
player.on(AudioPlayerStatus.Playing, ()=>console.log('PLAYING'));
player.on(AudioPlayerStatus.Idle, ()=>console.log('IDLE'));
player.on('error', e=>console.error('player err', e.message));

const RADIO = 'https://icecast.unitedradio.it/R105';

client.once('ready', async()=>{
  console.log('READY', client.user.tag);
  const cmds = [
    new SlashCommandBuilder().setName('radio').setDescription('Accendi Radio 105'),
    new SlashCommandBuilder().setName('party').setDescription('Accendi Radio 105'),
    new SlashCommandBuilder().setName('stop').setDescription('Spegni radio')
  ].map(c=>c.toJSON());
  const rest = new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), {body:cmds});
  console.log('comandi ok');
});

client.on('interactionCreate', async i=>{
  if(!i.isChatInputCommand()) return;
  try{
    if(i.commandName==='radio' || i.commandName==='party'){
      await i.deferReply().catch(()=>{});
      const vc = i.member?.voice?.channel;
      if(!vc) return i.editReply('Entra prima in un vocale!').catch(()=>{});
      if(connection) { try{connection.destroy()}catch{}; connection=null; }
      await new Promise(r=>setTimeout(r,300));
      connection = joinVoiceChannel({ channelId: vc.id, guildId: i.guild.id, adapterCreator: i.guild.voiceAdapterCreator, selfDeaf:false });
      await entersState(connection, VoiceConnectionStatus.Ready, 20000);
      console.log('connesso', vc.name, 'provo', RADIO);
      const resource = createAudioResource(RADIO, { inputType: 'arbitrary', inlineVolume:false });
      resource.playStream.on('error', e=>console.error('stream err', e.message));
      player.play(resource);
      connection.subscribe(player);
      await i.editReply(`▶️ Radio 105 in ${vc} 📻`).catch(()=>{});
    }
    if(i.commandName==='stop'){
      await i.deferReply().catch(()=>{});
      if(connection){ try{connection.destroy()}catch{}; connection=null; }
      await i.editReply('spenta!').catch(()=>{});
    }
  }catch(err){
    console.error('ERR', err);
    const msg = err.message.includes('aborted') ? 'Connessione abortita da Discord - riprova tra 3 sec con /party' : 'Errore: '+err.message;
    if(i.deferred||i.replied) await i.editReply(msg).catch(()=>{});
    else await i.reply({content:msg, ephemeral:true}).catch(()=>{});
  }
});

process.on('unhandledRejection', e=>console.error('unhandled', e));
client.login(process.env.DISCORD_TOKEN);

