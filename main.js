//Importe les modules
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
    client.user.setActivity("https://github.com/skelletondude/github", { type: "WATCHING" });
});

//lien pour l'api de riot
const riotApiUrl = "https://euw1.api.riotgames.com"


//lors de la reception d'un message
client.on('message', async message => {

    //Exclus les messages ne commencant pas par le préfix ou/et provenant d'un bot 
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

    //sauvegarde le nom d'invocateur de la personne en utilisant son id discord
    if (command === "save") {
        if (args[0] === "delete") {
            let file = `./ids/${message.author.id}.json`;
            fs.unlinkSync(file);
            message.reply(":white_check_mark: Vous avez été retiré de la liste des utilisateurs enregistrés avec succés!");
            return end();
        }
        if (args[0] === "edit") {
            let newEntry = {
                "id": message.author.id,
                "inGameNick": args[1]
            };
            fs.writeFileSync(`./ids/${message.author.id}.json`, JSON.stringify(newEntry, null, 2));
            message.reply(`:white_check_mark: Votre pseudo ingame à été modifié avec succès! C'est maintenant: ${args[1]}`);
            return end();
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
            message.reply(`:white_check_mark: Votre pseudo ingame à été enregistré! C'est maintenant: ${args[0]}`);
        }
        end();
    }



    //Commande "ping", ping sois l'api sois le bot
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

    //si la commande est "summoner": recupere le summoner,son niveau ,ses champions et leurs nombre de points de maitrise
    if (command === "summoner") {
        if (args.length === 0) {
            args[0] = await getNick(message.author.id);
        }
        if (args[0] === null) {
            return message.reply(":no_entry: Vous n'avez pas indiqué votre pseudo ingame! Utilisez `" + prefix + "save <pseudo ingame>` pour le renseigner ou indiquez le nom d'un invocateur"), end();
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
            .setTimestamp()

        message.channel.send(embed);

        end();
    }


    //si la command est "last": alors recupere la derniere partie et l'envoie en embed avec beaucoup de statistiques
    if (command === "last") {
        if (args.length === 0) {
            args[0] = await getNick(message.author.id);
        }
        if (args[0] === null) {
            return message.reply(":no_entry: Vous n'avez pas indiqué votre pseudo ingame! Utilisez `" + prefix + "save <pseudo ingame>` pour le renseigner ou indiquez le nom d'un invocateur"), end();
        }
        summoner = await superagent.get(riotApiUrl + "/lol/summoner/v4/summoners/by-name/" + args[0]).set("X-Riot-Token", keys.riot).then(res => res.body);
        lastMatches = await superagent.get(riotApiUrl + "/lol/match/v4/matchlists/by-account/" + summoner.accountId).set("X-Riot-Token", keys.riot).then(res => res.body.matches[0]);
        lastMatchSpecs = await superagent.get(riotApiUrl + "/lol/match/v4/matches/" + lastMatches.gameId).set("X-Riot-Token", keys.riot).then(res => res.body);
        gameModes = await superagent.get("https://static.developer.riotgames.com/docs/lol/queues.json").then(res => res.body);
        let gameMode = gameModes.find(x => x.queueId === lastMatchSpecs.queueId);
        var participantid = lastMatchSpecs.participantIdentities.find(x => x.player.accountId === summoner.accountId).participantId;
        if (summoner.accountId != lastMatchSpecs.participantIdentities[participantid].player.accountId) { participantid = 0 }
        const champion = await getChampionByKey(lastMatchSpecs.participants[participantid].championId, "fr_FR")


        let embed = new Discord.MessageEmbed()
            .setAuthor(`${summoner.name}`)
            .setThumbnail("http://ddragon.leagueoflegends.com/cdn/11.15.1/img/profileicon/" + summoner.profileIconId + ".png")
            .setDescription(`${gameMode.description}`)
            .addFields({ name: "Champion", value: `${champion.id}`, inline: true }, { name: "KDA", value: `${lastMatchSpecs.participants[participantid].stats.kills}/${lastMatchSpecs.participants[participantid].stats.deaths}/${lastMatchSpecs.participants[participantid].stats.assists}`, inline: "true" }, { name: "CS", value: `${lastMatchSpecs.participants[participantid].stats.totalMinionsKilled}`, inline: true }, { name: "Gold", value: `${lastMatchSpecs.participants[participantid].stats.goldEarned}`, inline: true }, { name: "Damage", value: `${lastMatchSpecs.participants[participantid].stats.totalDamageDealtToChampions}`, inline: true }, { name: "Vision", value: `${lastMatchSpecs.participants[participantid].stats.visionScore}`, inline: true })
            .setTimestamp()
            .setFooter(`${lastMatchSpecs.gameVersion}`)

        message.channel.send(embed);
        end();
    }


    //fonction supprimant le message et logs la commande avec les arguments et l'auteur 
    function end() {
        console.log(`Commande : ${command} \nArgs : ${args}\nAuteur : ${author}\n`);
        message.delete();
        return
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

    try {
        let file = `./ids/${id}.json`;
        let players = JSON.parse(fs.readFileSync(file));
        let nick = players.inGameNick;
        return nick;
    } catch { return nick = null; }


}