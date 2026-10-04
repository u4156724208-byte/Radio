
// BLACKOUT v3 - FIX LOGIN + LOG + FRANKFURT ABORT FIX
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ChannelType } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');

console.log('[START] Avvio bot... v3 LOG FIX');
const app = express();
app.get('/', (req, res) => res.send('Blackout v3 Online'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`[RENDER] Web server finto su porta ${PORT}`));

const rawToken = process.env.DISCORD_TOKEN || process.env.TOKEN || '';
const TOKEN = rawToken.trim().replace(/\n/g,'').replace(/\r/g,'');

console.log('[DEBUG] TOKEN presente?', !!TOKEN);
console.log('[DEBUG] Lunghezza token:', TOKEN.length);
console.log('[DEBUG] Inizia con MT?:', TOKEN.startsWith('MT') ? 'SI' : 'NO - TOKEN ERRATO');
if (!TOKEN) {
  console.error('[FATALE] DISCORD_TOKEN vuoto! Vai in Environment e incollalo senza spazi');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages]
});

async function connectWithRetry(channel, retries = 5) {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`[VOICE] Tentativo ${i}/${retries} -> ${channel.name}`);
      const conn = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
      });
      await entersState(conn, VoiceConnectionStatus.Ready, 15000);
      console.log('[VOICE READY] OK!');
      return conn;
    } catch (e) {
      console.warn(`[VOICE] Fail ${i}: ${e.message}`);
      const old = getVoiceConnection(channel.guild.id);
      if (old) try{old.destroy()}catch{}
      if (i === retries) throw e;
      await new Promise(r=>setTimeout(r, 2000*i));
    }
  }
}

client.once('ready', async () => {
  console.log(`[READY] BOT ONLINE come ${client.user.tag} - FIX FRANKFURT ATTIVO`);
  console.log('[READY] Ping gateway:', client.ws.ping);
  const cmds = [new SlashCommandBuilder().setName('party').setDescription('Avvia party in vocale').addChannelOption(o=>o.setName('canale').setDescription('Canale vocale').addChannelTypes(ChannelType.GuildVoice).setRequired(false)).toJSON()];
  const rest = new REST({version:'10'}).setToken(TOKEN);
  try {
    console.log('[SLASH] Registro comandi...');
    await rest.put(Routes.applicationCommands(client.user.id), {body: cmds});
    console.log('[SLASH] Comandi OK');
  } catch(e){ console.error('[SLASH ERR]', e.message); }
});

client.on('interactionCreate', async (inter) => {
  if (!inter.isChatInputCommand() || inter.commandName !== 'party') return;
  await inter.deferReply({ephemeral:true});
  const chOpt = inter.options.getChannel('canale');
  const vc = chOpt || inter.member?.voice?.channel;
  if (!vc) return inter.editReply('❌ Devi essere in vocale!');
  try {
    await connectWithRetry(vc, 5);
    await inter.editReply(`✅ Connesso a **${vc.name}** - Frankfurt fix attivo!`);
  } catch(e){
    console.error('[PARTY ERR]', e);
    if (e.message.includes('aborted') || e.message.includes('Abort')) {
      return inter.editReply('⚠️ Abortato per lag, rifai /party tra 3 sec - retry attivo');
    }
    return inter.editReply(`❌ Errore: ${e.message.slice(0,150)}`);
  }
});

console.log('[LOGIN] Tento login...');
client.login(TOKEN).then(()=>console.log('[LOGIN] Login inviato a Discord...')).catch(e=>{
  console.error('[LOGIN ERRORE FATALE]', e.message);
  console.error('[LOGIN] Token invalido o con spazi/a capo! Resetta il token su Discord Developer Portal');
});
