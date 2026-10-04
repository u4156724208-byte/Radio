const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const express = require('express');
const https = require('https');
const ffmpeg = require('ffmpeg-static');

// LOG PER DEBUG SU RENDER
console.log('FFMPEG PATH:', ffmpeg);

// WEB SERVER - obbligatorio su Render per tenere vivo il servizio
const app = express();
app.get('/', (req, res) => res.send('Radio Bot Live - Radio 105 OK'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Web server on ${PORT}`));

// LINK RADIO 105 - il tuo link
const RADIO_105_URL = 'https://icy.unitedradio.it/Radio105.mp3';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages]
});

let connection = null;
let player = createAudioPlayer();

// GESTIONE PLAYER - NESSUN TIMEOUT NEGATIVO QUI
player.on(AudioPlayerStatus.Idle, () => {
  console.log('Player in Idle - per radio live è normale se cade, non faccio timeout negativo');
});

player.on('error', err => {
  console.error('Errore Player:', err.message);
});

player.on(AudioPlayerStatus.Playing, () => {
  console.log('▶️ Radio 105 in play - AUDIO STA PARTENDO');
});

// Funzione per ottenere lo stream live
function getRadioStream() {
  return new Promise((resolve, reject) => {
    const req = https.get(RADIO_105_URL, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`Status ${res.statusCode} su stream radio`));
        return;
      }
      console.log('Stream Radio 105 connesso, status', res.statusCode);
      resolve(res);
    });
    req.on('error', reject);
  });
}

client.once('ready', async () => {
  console.log(`✅ READY ${client.user.tag}`);
  console.log('Comandi in Blackout404');

  const commands = [
    new SlashCommandBuilder().setName('radio').setDescription('Accendi Radio 105 nel tuo vocale'),
    new SlashCommandBuilder().setName('stop').setDescription('Spegni la radio e esci dal vocale')
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Comandi globali ok');
  } catch (e) {
    console.error('Errore registrazione comandi:', e);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // COMANDO /radio
  if (interaction.commandName === 'radio') {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Entra prima in un canale vocale!', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      if (connection) {
        try { connection.destroy(); } catch {}
      }

      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 20000);
      console.log('Connesso a vocale:', voiceChannel.name);

      // FIX CHIAVE: stream live senza calcolare durata
      const stream = await getRadioStream();

      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary, // FIX per MP3 live
        inlineVolume: false
      });

      resource.playStream.on('error', err => console.error('Stream error:', err));

      player.play(resource);
      connection.subscribe(player);

      await interaction.editReply(`▶️ **Radio 105 in play** in ${voiceChannel} 📻\n${RADIO_105_URL}`);

    } catch (err) {
      console.error('ERRORE /radio:', err);
      await interaction.editReply(`❌ Errore: ${err.message}`).catch(() => {});
    }
  }

  // COMANDO /stop
  if (interaction.commandName === 'stop') {
    await interaction.deferReply();
    if (connection) {
      try { connection.destroy(); connection = null; } catch {}
      await interaction.editReply('⏹️ Radio spenta e uscito dal vocale!');
    } else {
      await interaction.editReply('Non sono in nessun vocale.');
    }
  }
});

process.on('unhandledRejection', e => console.error('Unhandled:', e));
process.on('uncaughtException', e => console.error('Uncaught:', e));

if (!process.env.DISCORD_TOKEN) {
  console.error('MANCA DISCORD_TOKEN nelle Environment Variables di Render!');
}
client.login(process.env.DISCORD_TOKEN);
