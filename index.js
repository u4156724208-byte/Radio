const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const express = require('express');
const https = require('https');
const ffmpeg = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpeg;
console.log('ffmpeg path:', ffmpeg);

// web server per render
const app = express();
app.get('/', (req, res) => res.send('radio live ok'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`web server on ${PORT}`));

const RADIO_URLS = [
  'https://icecast.unitedradio.it/Radio105.mp3',
  'https://icy.unitedradio.it/Radio105.mp3',
  'http://icecast.unitedradio.it/Radio105.mp3'
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

let connection = null;
let player = createAudioPlayer();
player.on(AudioPlayerStatus.Playing, () => console.log('radio 105 in play'));
player.on(AudioPlayerStatus.Idle, () => console.log('player idle'));
player.on('error', e => console.error('player error:', e.message));

async function createRadioResource() {
  for (const url of RADIO_URLS) {
    try {
      console.log('provo url', url);
      const res = createAudioResource(url, { inputType: StreamType.Arbitrary, inlineVolume: false });
      console.log('resource ok per', url);
      return res;
    } catch (e) {
      console.error('fallito', url, e.message);
    }
  }
  throw new Error('nessun URL radio funziona su Render');
}

client.once('ready', async () => {
  console.log(`ready ${client.user.tag}`);
  const commands = [
    new SlashCommandBuilder().setName('radio').setDescription('accendi radio 105 nel tuo vocale'),
    new SlashCommandBuilder().setName('party').setDescription('accendi radio 105 nel tuo vocale'),
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
    if (interaction.commandName === 'radio' || interaction.commandName === 'party') {
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
      await entersState(connection, VoiceConnectionStatus.Ready, 30000);
      console.log('connesso a', vc.name);
      const resource = await createRadioResource();
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
