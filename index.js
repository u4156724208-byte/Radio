const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const express = require('express');
const https = require('https');
const ffmpeg = require('ffmpeg-static');
console.log('ffmpeg path:', ffmpeg);
const app = express();
app.get('/', (req, res) => res.send('radio live ok'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`web server on ${PORT}`));
const RADIO_URL = 'https://icy.unitedradio.it/Radio105.mp3';
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
let connection = null;
let player = createAudioPlayer();
client.once('ready', async () => {
  console.log(`ready ${client.user.tag}`);
  const commands = [
    new SlashCommandBuilder().setName('radio').setDescription('accendi radio 105 nel tuo vocale'),
    new SlashCommandBuilder().setName('stop').setDescription('spegni la radio')
  ].map(c => c.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log('comandi globali ok');
});
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === 'radio') {
      await interaction.deferReply().catch(()=>{});
      const vc = interaction.member?.voice?.channel;
      if (!vc) return await interaction.editReply('entra prima in un vocale!').catch(()=>{});
      if (connection) try { connection.destroy(); } catch {}
      connection = joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator, selfDeaf: false });
      await entersState(connection, VoiceConnectionStatus.Ready, 15000);
      const stream = await new Promise((res, rej) => https.get(RADIO_URL, r => res(r)).on('error', rej));
      const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
      player.play(resource);
      connection.subscribe(player);
      await interaction.editReply(`▶️ radio 105 in play in ${vc} 📻`).catch(()=>{});
    }
    if (interaction.commandName === 'stop') {
      await interaction.deferReply().catch(()=>{});
      if (connection) { connection.destroy(); connection = null; }
      await interaction.editReply('radio spenta!').catch(()=>{});
    }
  } catch (err) {
    console.error(err);
    if (interaction.deferred) await interaction.editReply('errore: ' + err.message).catch(()=>{});
  }
});
client.login(process.env.DISCORD_TOKEN);
