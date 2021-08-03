//puuId = 5mdPyMvgiw8hZFT1p0eqoNF8r3f5WEIw01DzhXH1dtz2uK5iztqlK97VN8iDa2QZ1bSvC1guBSRjnw
//summonerId = qiLkFBeg0NQlvt1gxMo8nk1-bf88fxhoHgqQcJ5JYm0QxEvd

//importe les modules
const Discord = require("discord.js");
const keys = require("./keys.json");
const fs = require("fs");
const util = require('util');
const superagent = require("superagent");
const { url } = require("inspector");
const { get } = require("superagent");
const { request } = require("http");
const champs = require("./riot/champion.json");
const fetch = require("node-fetch");
//crée un client discord
const client = new Discord.Client();

//se connecte a discord avec le token du bot
client.login(keys.discord);

//établi le préfixe
const prefix = "!";

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

    if (command === "save") {
        if (args[0] === "edit") {
            let newEntry = {
                "id": message.author.id,
                "inGameNick": args[1]
            };
            fs.writeFileSync(`./ids/${message.author.id}.json`, JSON.stringify(newEntry, null, 2));
            message.reply(`:white_check_mark: Your in-game nick has been edited! It is now: ${args[1]}`);
            end();
            return
        }
        try {
            let file = `./ids/${message.author.id}.json`
            require(file)
            fs.readFile(`./ids/${message.author.id}.json`, 'utf-8', (err, jsonString) => {
                var fileJson = JSON.parse(jsonString)
                console.log(fileJson)
                message.reply(`votre nom ingame est ${fileJson.inGameNick}`)
                console.log('trouvé')
            });
        } catch (error) {

            let newEntry = {
                "id": message.author.id,
                "inGameNick": args[0]
            };
            fs.writeFileSync(`./ids/${message.author.id}.json`, JSON.stringify(newEntry, null, 2));
            message.reply(`:white_check_mark: Your in-game nick has been saved! It is now: ${args[0]}`);
            end();
        }
        end();
    }



    //Commande PING, ping sois l'api sois le bot
    if (command === "ping") {
        //commande ping pour l'api
        if (args == "api") {
            //requete a l'api concernant son status
            superagent
                .get(riotApiUrl + "/lol/status/v4/platform-data")
                .set("X-Riot-Token", keys.riot)
                .then(res => {
                    let timeTaken = Date.now() - message.createdTimestamp //calcule le temps pris pour repondre au message
                    message.reply("l'api a une latence de " + `${timeTaken}ms`); //repond
                });
        } else {
            let timeTaken = Date.now() - message.createdTimestamp //calcule le temps pris pour repondre au message
            message.reply("le bot a une latence de " + `${timeTaken}ms`); //repond
        }
        end();
    }

    //si la commande est "summoner": recupere le summoner et son niveau et ses champions et leurs nombre de points de maitrise
    if (command === "summoner") {
        if (args.length === 0) {
            args[0] = await getNick(message.author.id);
            console.log(args[0] + " issssss");
        }
        var summoner = await superagent.get(riotApiUrl + "/lol/summoner/v4/summoners/by-name/" + args[0]).set("X-Riot-Token", keys.riot).then(res => res.body);
        let request = riotApiUrl + "/lol/champion-mastery/v4/champion-masteries/by-summoner/" + summoner.id;

        var champMastery = await superagent.get(request)
            .set("X-Riot-Token", keys.riot)
            .then(res => {
                return res.body;
            })

        const firstChampion = await getChampionByKey(champMastery[0].championId, "fr_FR");
        const secondChampion = await getChampionByKey(champMastery[1].championId, "fr_FR");
        const thirdChampion = await getChampionByKey(champMastery[2].championId, "fr_FR");

        let embed = new Discord.MessageEmbed()
            .setAuthor(summoner.name)
            .addFields({ name: firstChampion.name, value: `${champMastery[0].championPoints}`, inline: true }, { name: secondChampion.name, value: `${champMastery[1].championPoints}`, inline: true }, { name: thirdChampion.name, value: `${champMastery[2].championPoints}`, inline: true })
            .setThumbnail("http://ddragon.leagueoflegends.com/cdn/11.15.1/img/profileicon/" + summoner.profileIconId + ".png")
            .setDescription('level : ' + summoner.summonerLevel)

        message.channel.send(embed);

        end();
    }



    //fonction supprimant le message et logs la commande avec les arguments et l'auteur 
    function end() {
        console.log(`Commande : ${command} \nArgs : ${args}\nAuteur : ${author}\n`);
        message.delete();
    }





});
//code by Querijn for the champs :)
let championByIdCache = {};
let championJson = {};

async function getLatestChampionDDragon(language = "en_US") {

    if (championJson[language])
        return championJson[language];

    let response;
    let versionIndex = 0;
    do { // I loop over versions because 9.22.1 is broken
        const version = (await fetch("http://ddragon.leagueoflegends.com/api/versions.json").then(async(r) => await r.json()))[versionIndex++];

        response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/${language}/champion.json`);
    }
    while (!response.ok)

    championJson[language] = await response.json();
    return championJson[language];
}

async function getChampionByKey(key, language = "en_US") {

    // Setup cache
    if (!championByIdCache[language]) {
        let json = await getLatestChampionDDragon(language);

        championByIdCache[language] = {};
        for (var championName in json.data) {
            if (!json.data.hasOwnProperty(championName))
                continue;

            const champInfo = json.data[championName];
            championByIdCache[language][champInfo.key] = champInfo;
        }
    }

    return championByIdCache[language][key];
}

// NOTE: IN DDRAGON THE ID IS THE CLEAN NAME!!! It's also super-inconsistent, and broken at times.
// Cho'gath => Chogath, Wukong => Monkeyking, Fiddlesticks => Fiddlesticks/FiddleSticks (depending on what mood DDragon is in this patch)
async function getChampionByID(name, language = "en_US") {
    return await getLatestChampionDDragon(language)[name];
}

// async function main() {
//     const annie = await getChampionByKey(1, "en_US");
//     const leona = await getChampionByKey(89, "es_ES");
//     const brand = await getChampionByID("brand");

//     console.log(annie);
//     console.log(leona);
//     console.log(brand);
// }

// fonction qui va recuperer le nom ingame du joueur grace a son id dans les fichiers json
function getNick(id) {

    let file = `./ids/${id}.json`;
    let players = JSON.parse(fs.readFileSync(file));
    let nick = players.inGameNick;

    if (!nick) {
        nick = "";
    }

    return nick;
}