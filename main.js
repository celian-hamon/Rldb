//importe les modules
const Discord = require("discord.js");
const keys = require("./keys.json");
const fs = require("fs");
const util = require('util');
const superagent = require("superagent");
const { url } = require("inspector");

//crée un client discord
const client = new Discord.Client();

//se connecte a discord avec le token du bot
client.login(keys.discord);

//établi le préfixe
const prefix = "¤";

//log un message une fois pret et met un status
client.on("ready", () => {
    console.log("lol-bot : I am ready!");
    client.user.setActivity("Kcorp les bests", { type: "WATCHING" });
});

const riotApiUrl = "https://euw1.api.riotgames.com"

client.on('message', async message => {
    //Exclus les messages ne commencant pas par le préfix ou provenant d'un bot 
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    //split le messages en differentes parties afin de le traiter
    let commandBody = message.content.slice(prefix.length);
    let args = commandBody.split(" ");
    let command = args.shift().toLowerCase();

    //propriétés du message
    let fetchUser = message.mentions.users.first() || message.author;
    let member = message.guild.members.cache.get(fetchUser.id);
    let nickname = member.nickname;
    let author = message.author.username;


    //commande qui recupere le joueur 
    if (command === "info") {
        superagent
            .get(riotApiUrl + "/lol/status/v4/platform-data")
            .set("X-Riot-Token", keys.riot)
            .then(res => { console.log(res.body) })
    }

});