const {
  Client,
  GatewayIntentBits,
  Collection
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  getVoiceConnection
} = require("@discordjs/voice");

const play = require("play-dl");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.queue = new Map();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity("CritHitGlitch Music 🎧");
});

async function playSong(guild, song) {
  const serverQueue = client.queue.get(guild.id);
  if (!song) {
    serverQueue.connection.destroy();
    client.queue.delete(guild.id);
    return;
  }

  const stream = await play.stream(song.url);
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type
  });

  serverQueue.player.play(resource);
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const args = message.content.split(" ");

  // 🎧 PLAY COMMAND
  if (message.content.startsWith("!play")) {
    const query = args.slice(1).join(" ");
    if (!query) return message.reply("❌ Give a YouTube link or search text!");

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply("❌ Join a voice channel first!");

    let songInfo;

    // If link
    if (play.yt_validate(query) === "video") {
      songInfo = await play.video_info(query);
    } else {
      const search = await play.search(query, { limit: 1 });
      if (!search.length) return message.reply("❌ No results found!");
      songInfo = await play.video_info(search[0].url);
    }

    const song = {
      title: songInfo.video_details.title,
      url: songInfo.video_details.url
    };

    let queue = client.queue.get(message.guild.id);

    if (!queue) {
      const player = createAudioPlayer();

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator
      });

      queue = {
        connection,
        player,
        songs: []
      };

      client.queue.set(message.guild.id, queue);

      queue.songs.push(song);

      player.on(AudioPlayerStatus.Idle, () => {
        queue.songs.shift();
        playSong(message.guild, queue.songs[0]);
      });

      connection.subscribe(player);
      playSong(message.guild, queue.songs[0]);

      return message.reply(`🎧 Now Playing: **${song.title}**`);
    } else {
      queue.songs.push(song);
      return message.reply(`➕ Added to queue: **${song.title}**`);
    }
  }

  // ⏭ SKIP
  if (message.content === "!skip") {
    const queue = client.queue.get(message.guild.id);
    if (!queue) return message.reply("❌ Nothing playing!");

    queue.player.stop();
    message.reply("⏭ Skipped!");
  }

  // ⛔ STOP
  if (message.content === "!stop") {
    const queue = client.queue.get(message.guild.id);
    if (!queue) return message.reply("❌ Nothing playing!");

    queue.songs = [];
    queue.player.stop();
    queue.connection.destroy();
    client.queue.delete(message.guild.id);

    message.reply("⛔ Stopped music!");
  }

  // 📜 QUEUE
  if (message.content === "!queue") {
    const queue = client.queue.get(message.guild.id);
    if (!queue || !queue.songs.length) {
      return message.reply("❌ Queue is empty!");
    }

    const list = queue.songs
      .map((s, i) => `${i + 1}. ${s.title}`)
      .join("\n");

    message.reply("🎵 **Queue:**\n" + list);
  }
});

client.login(process.env.DISCORD_TOKEN);
