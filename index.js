
const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

const TOKEN = process.env.TOKEN;
const RADIO_URL = 'https://icecast.unitedradio.it/Radio105.mp3';
const PORT = process.env.PORT || 10000;

// Server finto per Render
const app = express();
app.get('/', (req,res) => res.send('Radio bot solo /party online'));
app.listen(PORT, () => console.log('Web server finto su ' + PORT));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const player = createAudioPlayer();

client.once('ready', async () => {
  console.log(`BOT ONLINE ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const partyCmd = new SlashCommandBuilder().setName('party').setDescription('Metti Radio 105 nel tuo vocale').toJSON();

  try {
    // 1. PULISCE TUTTI I COMANDI GLOBALI e mette solo /party
    console.log('Pulisco comandi globali...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: [partyCmd] });
    console.log('Globali puliti -> solo /party');

    // 2. PULISCE TUTTI I COMANDI DI GILDA (sono quelli che creano i duplicati)
    const guilds = await client.guilds.fetch();
    for (const [guildId] of guilds) {
      try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [] });
        console.log(`Puliti comandi gilda ${guildId}`);
      } catch {}
    }
    console.log('FATTO - ora esiste solo /party x1');
  } catch(e){ console.error('Errore pulizia comandi', e) }
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() || i.commandName !== 'party') return;
  const vc = i.member?.voice?.channel;
  if (!vc) return i.reply({ content: 'Entra prima in un vocale!', ephemeral: true });
  
  await i.deferReply();
  try {
    const connection = joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

    const resource = createAudioResource(RADIO_URL, { inlineVolume: true });
    resource.volume.setVolume(1);
    
    player.play(resource);
    const sub = connection.subscribe(player);
    
    player.on(AudioPlayerStatus.Idle, () => {
      console.log('Stream finito, riconnetto...');
      try { player.play(createAudioResource(RADIO_URL)); } catch {}
    });

    player.on('error', e => console.error('Player error', e));

    await i.editReply(`🔊 Entrato in ${vc.name} • Radio 105 ON! Se non senti, alza volume Discord!`);
    console.log(`Entrato in ${vc.name} e sto suonando`);

  } catch(e){
    console.error(e);
    await i.editReply('Errore vocale: ' + e.message);
  }
});

client.login(TOKEN);
