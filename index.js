
// Bot Radio 105 - Versione RENDER (voce diretta funziona 100%)
const { Client, GatewayIntentBits, SlashCommandBuilder, Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const RADIO_URL = 'https://icy.unitedradio.it/Radio105.mp3';
const PORT = process.env.PORT || 3000;

// Web server per Render (tiene vivo il bot)
const app = express();
app.get('/', (req,res) => res.send(`<h1>Radio Bot Online</h1><p>${new Date().toISOString()}</p>`));
app.listen(PORT, () => console.log(`Web server on ${PORT}`));

if(!TOKEN){
  console.error('Manca TOKEN nelle variabili!');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const player = createAudioPlayer();

function playRadio(){
  try{
    const resource = createAudioResource(RADIO_URL, { inlineVolume: true });
    resource.volume.setVolume(0.8);
    player.play(resource);
    console.log('▶️ Radio 105 in play');
  }catch(e){
    console.error('play error', e);
    setTimeout(playRadio, 2000);
  }
}
player.on(AudioPlayerStatus.Idle, () => setTimeout(playRadio, 1000));
player.on('error', e => { console.error('player error', e.message); setTimeout(playRadio, 2000); });

client.once(Events.ClientReady, async () => {
  console.log(`✅ READY ${client.user.tag}`);
  const cmds = [
    new SlashCommandBuilder().setName('party').setDescription('Metti Radio 105 nel tuo vocale'),
    new SlashCommandBuilder().setName('stop').setDescription('Ferma la radio')
  ].map(c=>c.toJSON());
  
  // Registra comandi su tutti i server
  for(const guild of client.guilds.cache.values()){
    try{ await guild.commands.set(cmds); console.log(`Comandi in ${guild.name}`); }catch(e){}
  }
  try{ await client.application.commands.set(cmds); console.log('Comandi globali ok'); }catch{}
});

client.on(Events.InteractionCreate, async i => {
  if(!i.isChatInputCommand()) return;
  
  if(i.commandName === 'party'){
    await i.deferReply();
    const vc = i.member?.voice?.channel;
    if(!vc) return i.editReply('❌ Entra prima in un canale vocale!');
    
    const old = getVoiceConnection(i.guildId);
    if(old){ try{ old.destroy(); }catch{} await new Promise(r=>setTimeout(r,500)); }
    
    try{
      const conn = joinVoiceChannel({
        channelId: vc.id,
        guildId: i.guildId,
        adapterCreator: i.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });
      conn.subscribe(player);
      if(player.state.status !== 'playing') playRadio();
      
      return i.editReply(`✅ **PARTY ON!** Radio 105 in **${vc.name}** 🔊`);
    }catch(err){
      console.error('join error', err);
      return i.editReply(`❌ Errore: ${err.message}`);
    }
  }
  
  if(i.commandName === 'stop'){
    await i.deferReply();
    player.stop();
    const conn = getVoiceConnection(i.guildId);
    if(conn) conn.destroy();
    return i.editReply('⏹️ Radio fermata.');
  }
});

client.login(TOKEN);
