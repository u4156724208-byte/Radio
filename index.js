
// BLACKOUT RADIO - VERSIONE FINALE VERIFICATA
// Solo /party x1 - Fix duplicati + Fix "operation was aborted" + Audio OK su Render

const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  entersState, 
  VoiceConnectionStatus, 
  getVoiceConnection,
  StreamType
} = require('@discordjs/voice');

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.error('MANCA TOKEN nelle Environment Variables di Render!');
  process.exit(1);
}

const RADIO_URL = 'https://icecast.unitedradio.it/Radio105.mp3'; // stream stabile
const PORT = process.env.PORT || 10000;

// 1. Server web finto per Render (obbligatorio su Web Service)
const app = express();
app.get('/', (_, res) => res.send('Bot OK - solo /party'));
app.listen(PORT, () => console.log(`[RENDER] Web server finto su porta ${PORT} - necessario per non far crashare`));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const player = createAudioPlayer();

// 2. PULIZIA TOTALE COMANDI + REGISTRAZIONE SOLO /party
client.once('ready', async () => {
  console.log(`[BOT] ONLINE come ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const soloParty = new SlashCommandBuilder()
    .setName('party')
    .setDescription('Metti Radio 105 nel tuo vocale')
    .toJSON();

  try {
    console.log('[CLEAN] Pulisco comandi GLOBALI...');
    // Sovrascrive tutti i globali con solo /party
    await rest.put(Routes.applicationCommands(client.user.id), { body: [soloParty] });
    console.log('[CLEAN] Globali -> solo /party OK');

    // Pulisce tutti i comandi di GILDA (sono quelli che creano duplicati)
    const guilds = await client.guilds.fetch();
    console.log(`[CLEAN] Trovate ${guilds.size} gilde, pulisco comandi gilda...`);
    for (const [guildId, guild] of guilds) {
      try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [] });
        console.log(`[CLEAN] Gilda ${guild.name} (${guildId}) pulita`);
      } catch (e) {
        console.log(`[CLEAN] Skip gilda ${guildId}: ${e.message}`);
      }
    }
    console.log('[CLEAN] FINITO - Ora esiste SOLO /party x1');
  } catch (e) {
    console.error('[ERRORE CLEAN]', e);
  }
});

// 3. COMANDO /party CON FIX "operation was aborted"
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'party') return;

  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: 'Devi entrare prima in un canale vocale!', ephemeral: true });
  }

  await interaction.deferReply().catch(()=>{});

  // Distruggi vecchia connessione se esiste (fix abort)
  const oldConnection = getVoiceConnection(interaction.guild.id);
  if (oldConnection) {
    try { oldConnection.destroy(); console.log('[VOICE] Vecchia connessione distrutta'); } catch {}
  }

  try {
    console.log(`[VOICE] Tento join in ${voiceChannel.name}`);

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    // Gestione disconnessioni Render
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        console.log('[VOICE] Riconnessione in corso...');
      } catch {
        try { connection.destroy(); } catch {}
        console.log('[VOICE] Connessione distrutta dopo disconnect');
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => console.log('[VOICE] Connection destroyed'));
    connection.on('error', e => console.error('[VOICE] Connection error', e.message));

    // FIX CRITICO per "The operation was aborted" - aspetta 20s
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    console.log('[VOICE] Status READY - connessione stabile');

    // Crea risorsa audio con volume
    const resource = createAudioResource(RADIO_URL, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true
    });
    resource.volume.setVolume(1);

    player.removeAllListeners();

    player.on(AudioPlayerStatus.Playing, () => console.log('[PLAYER] Playing Radio 105'));
    player.on(AudioPlayerStatus.Idle, () => {
      console.log('[PLAYER] Idle - replay');
      try {
        const newResource = createAudioResource(RADIO_URL, { inputType: StreamType.Arbitrary, inlineVolume: true });
        newResource.volume.setVolume(1);
        player.play(newResource);
      } catch (e) { console.error('[PLAYER] Replay error', e.message); }
    });
    player.on('error', e => console.error('[PLAYER] Error', e.message));

    player.play(resource);
    const subscription = connection.subscribe(player);
    
    if (subscription) {
      console.log('[VOICE] Subscribed player to connection');
      await interaction.editReply(`🔊 **Radio 105 ON** in **${voiceChannel.name}**!`).catch(()=>{});
    } else {
      throw new Error('Subscribe fallita');
    }

  } catch (err) {
    console.error('[ERRORE VOCALE]', err);
    await interaction.editReply(`❌ Errore vocale: ${err.message}\nRiprova /party tra 5 secondi. Se persiste, controlla che il bot abbia permessi di parlare nel canale.`).catch(()=>{});
  }
});

client.login(TOKEN);
console.log('[START] Avvio bot...');
