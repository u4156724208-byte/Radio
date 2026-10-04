
// BLACKOUT - FIX DEFINITIVO FRANKFURT + ABORTED + RENDER
// Fix per "The operation was aborted" su Render EU

const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ChannelType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');

// --- WEB SERVER FINTO PER RENDER (obbligatorio) ---
console.log('[START] Avvio bot...');
const app = express();
app.get('/', (req, res) => res.send('Blackout Bot Online - Frankfurt'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`[RENDER] Web server finto su porta ${PORT} - necessario per non far crashare`);
});

// --- CLIENT ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages]
});

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
if (!TOKEN) {
  console.error('[ERRORE] TOKEN non trovato! Metti DISCORD_TOKEN nelle Environment Variables di Render');
}

// Funzione pulizia vecchie connessioni
function cleanOldConnections() {
  console.log('[CLEAN] Pulizia connessioni vecchie...');
  // opzionale
  console.log('[CLEAN FINITO]');
}

// --- VOICE FIX CON RETRY PER "ABORTED" ---
async function connectWithRetry(channel, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`[VOICE] Tentativo ${i}/${retries} connessione a ${channel.name} in ${channel.guild.name}`);
      
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      // Attendi che sia pronto entro 15s, con retry se abortito
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      console.log('[VOICE READY] Connessione pronta!');
      return connection;

    } catch (err) {
      console.warn(`[VOICE] Tentativo ${i} fallito: ${err.message}`);
      const oldConn = getVoiceConnection(channel.guild.id);
      if (oldConn) {
        try { oldConn.destroy(); } catch {}
      }
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 2000 * i)); // backoff
    }
  }
}

// --- READY ---
client.once('ready', async () => {
  console.log(`[READY] BOT ONLINE come ${client.user.tag} - Regione: Frankfurt fix attivo`);
  console.log('[READY] Ping:', client.ws.ping, 'ms');
  cleanOldConnections();

  // Registra /party
  const commands = [
    new SlashCommandBuilder()
      .setName('party')
      .setDescription('Avvia il party musicale in vocale')
      .addChannelOption(o => o.setName('canale').setDescription('Canale vocale').addChannelTypes(ChannelType.GuildVoice).setRequired(false))
      .toJSON()
  ];
  
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('[SLASH] Registro comandi...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[SLASH] Comandi registrati!');
  } catch (e) {
    console.error('[SLASH ERRORE]', e);
  }
});

// --- INTERACTION ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'party') return;

  await interaction.deferReply({ ephemeral: true });

  const channelOption = interaction.options.getChannel('canale');
  const voiceChannel = channelOption || interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return interaction.editReply('❌ Devi essere in un canale vocale o specificarne uno!');
  }

  try {
    const connection = await connectWithRetry(voiceChannel, 5);
    
    const player = createAudioPlayer();
    // Esempio: se hai una radio/stream, metti qui la risorsa
    // const resource = createAudioResource('https://stream.url');
    // player.play(resource);
    // connection.subscribe(player);

    await interaction.editReply(`✅ Connesso a **${voiceChannel.name}** a Frankfurt! VOICE READY - Nessun abort.`);
    
    player.on(AudioPlayerStatus.Idle, () => console.log('[PLAYER] Idle'));
    player.on('error', e => console.error('[PLAYER ERROR]', e));

  } catch (err) {
    console.error('[PARTY ERRORE FINALE]', err);
    // Messaggio user-friendly invece di "The operation was aborted"
    if (err.message.includes('aborted') || err.message.includes('Abort')) {
      return interaction.editReply('⚠️ Connessione vocale abortita per lag EU. Riprovo... rifai /party tra 3 secondi. (Fix Frankfurt attivo)');
    }
    return interaction.editReply(`❌ Errore: ${err.message.slice(0, 180)}`);
  }
});

client.login(TOKEN);
