const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const express = require('express');
const https = require('https');
const ffmpeg = require('ffmpeg-static');

console.log('FFMPEG PATH:', ffmpeg);

const app = express();
app.get('/', (req, res) => res.send('Radio Bot Live - Radio 105 OK'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Web server on ${PORT}`));

// TUO LINK RICHIESTO
const RADIO_105_URL = 'https://icy.unitedradio.it/Radio105.mp3';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages]
});

let connection = null;
let player = createAudioPlayer();

player.on(AudioPlayerStatus.Idle, () => {
  console.log('Player Idle - radio live, se cade non uso timeout negativo');
});
player.on('error', err => console.error('Errore Player:', err.message));
player.on(AudioPlayerStatus.Playing, () => console.log('▶️ Radio 105 in play - AUDIO STA PARTENDO'));

function getRadioStream() {
  return new Promise((resolve, reject) => {
    const req = https.get(RADIO_105_URL, res => {
      if (res.statusCode !== 200) return reject(new Error(`Status ${res.statusCode}`));
      console.log('Stream Radio 105 connesso', res.statusCode);
      resolve(res);
    });
    req.on('error', reject);
  });
}

client.once('ready', async () => {
  console.log(`✅ READY ${client.user.tag}`);
  const commands = [
    new SlashCommandBuilder().setName('radio').setDescription('Accendi Radio 105 nel tuo vocale'),
    new SlashCommandBuilder().setName('stop').setDescription('Spegni la radio')
  ].map(c => c.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Comandi globali ok');
  } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'radio') {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) return interaction.reply({ content: '❌ Entra in un vocale prima!', ephemeral: true });
    await interaction.deferReply();
    try {
      if (connection) try { connection.destroy(); } catch {}
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });
      await entersState(connection, VoiceConnectionStatus.Ready, 20000);
      const stream = await getRadioStream();
      const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary, inlineVolume: false });
      resource.playStream.on('error', e => console.error('Stream error', e));
      player.play(resource);
      connection.subscribe(player);
      await interaction.editReply(`▶️ **Radio 105 in play** in ${voiceChannel} 📻\n${RADIO_105_URL}`);
    } catch (err) {
      console.error('ERRORE /radio:', err);
      await interaction.editReply(`❌ Errore: ${err.message}`).catch(() => {});
    }
  }
  if (interaction.commandName === 'stop') {
    await interaction.deferReply();
    if (connection) { try { connection.destroy(); connection = null; } catch {} await interaction.editReply('⏹️ Radio spenta!'); }
    else await interaction.editReply('Non sono in nessun vocale.');
  }
});

process.on('unhandledRejection', e => console.error('Unhandled:', e));
process.on('uncaughtException', e => console.error('Uncaught:', e));
client.login(process.env.DISCORD_TOKEN);
