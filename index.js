
// Versione LIGHT per RENDER - con finto web server per non far crashare
const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

const TOKEN = process.env.TOKEN;
const RADIO_URL = 'https://icecast.unitedradio.it/Radio105.mp3';
const PORT = process.env.PORT || 10000;

// Finto server web per Render (obbligatorio se usi Web Service)
const app = express();
app.get('/', (req,res) => res.send('Bot /party online - Radio 105'));
app.listen(PORT, () => console.log(`Finto web server su porta ${PORT}`));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const player = createAudioPlayer();

client.once('ready', async () => {
  console.log(`BOT ONLINE come ${client.user.tag}`);
  const commands = [new SlashCommandBuilder().setName('party').setDescription('Entra e mette Radio 105').toJSON()];
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Comando /party registrato - RENDER OK');
  } catch(e){ console.error(e) }
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() || i.commandName !== 'party') return;
  const vc = i.member?.voice?.channel;
  if (!vc) return i.reply({ content: 'Entra prima in un vocale!', ephemeral: true });
  await i.deferReply();
  try {
    const conn = joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator, selfDeaf: false });
    const resource = createAudioResource(RADIO_URL);
    player.play(resource);
    conn.subscribe(player);
    await i.editReply(`🔊 Entrato in **${vc.name}** - Radio 105 ON!`);
  } catch(e){ console.error(e); await i.editReply('Errore vocale'); }
});

client.login(TOKEN);
