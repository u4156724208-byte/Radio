const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const express = require('express');
const https = require('https');
const ffmpeg = require('ffmpeg-static');

console.log('ffmpeg path:', ffmpeg);

// web server per render
const app = express();
app.get('/', (req, res) => res.send('radio live ok'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`web server on ${PORT}`));

const RADIO_URL = 'https://icy.unitedradio.it/Radio105.mp3';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

let connection = null;
let player = createAudioPlayer();
player.on(AudioPlayerStatus.Playing, () => console.log('radio 105 in play'));
player.on(AudioPlayerStatus.Idle, () => console.log('player idle'));
player.on('error', e => console.error('player error:', e.message));

function getStreamWithTimeout(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout stream radio 105')), timeoutMs);
    const req = https.get(RADIO_URL, res => {
      clearTimeout(timer);
      if (res.statusCode !== 200) return reject(new Error('status ' + res.statusCode));
      console.log('stream connesso', res.statusCode);
      resolve(res);
    });
    req.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

client.once('ready', async () => {
  console.log(`ready ${client.user.tag}`);
  const commands = [
    new SlashCommandBuilder().setName('radio').setDescription('accendi radio 105 nel tuo vocale'),
    new SlashCommandBuilder().setName('stop').setDescription('spegni la radio')
  ].map(c => c.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('comandi globali ok');
  } catch (e) { console.error('errore comandi', e); }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === 'radio') {
      // FIX: defer immediato per non far scadere l'interazione
      await interaction.deferReply({ ephemeral: false }).catch(()=>{});
      const vc = interaction.member?.voice?.channel;
      if (!vc) {
        return await interaction.editReply('entra prima in un vocale!').catch(()=>{});
      }
      if (connection) { try { connection.destroy(); } catch {} }
      connection = joinVoiceChannel({
        channelId: vc.id,
        guildId: vc.guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });
      await entersState(connection, VoiceConnectionStatus.Ready, 15000);
      console.log('connesso a', vc.name);
      const stream = await getStreamWithTimeout(6000);
      const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary, inlineVolume: false });
      resource.playStream.on('error', e => console.error('stream error', e));
      player.play(resource);
      connection.subscribe(player);
      await interaction.editReply(`▶️ radio 105 in play in ${vc} 📻`).catch(()=>{});
    }

    if (interaction.commandName === 'stop') {
      await interaction.deferReply().catch(()=>{});
      if (connection) { try { connection.destroy(); } catch {} connection = null; await interaction.editReply('radio spenta!').catch(()=>{}); }
      else await interaction.editReply('non sono in vocale').catch(()=>{});
    }
  } catch (err) {
    console.error('errore interaction:', err);
    // tenta sempre di rispondere per evitare "applicazione non ha risposto"
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('errore: ' + err.message).catch(()=>{});
    } else {
      await interaction.reply({ content: 'errore: ' + err.message, ephemeral: true }).catch(()=>{});
    }
  }
});

process.on('unhandledRejection', e => console.error('unhandled', e));
process.on('uncaughtException', e => console.error('uncaught', e));

client.login(process.env.DISCORD_TOKEN);
