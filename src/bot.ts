import { Client, Intents, ColorResolvable, GuildTextBasedChannel, Message, MessageAttachment, MessageEmbed, TextBasedChannel } from "discord.js";
import * as dotenv from "dotenv";
import { Captcha } from "./interfaces/captcha.interface";
import { FormInput } from "./interfaces/input.interface";

dotenv.config();
const client= new Client({
	partials: ["CHANNEL"],
	intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES]
});
const prefix: string|undefined = process.env.COMMAND_PREFIX;
const serverLogoUrl: string = process.env.SERVERLOGO_URL ?? '';
const primaryColor: ColorResolvable = "#0099ff";
const captcha: any = require("nodejs-captcha");

client.on('ready', () => {
  console.log(`Ready`);
});

client.on("messageCreate", async(message: Message) => {
	if(message.channel.type.toLowerCase() === "dm") {
		if (message.content.startsWith(`${prefix}register`)) {
            const msg_filter: any = (m: Message) => m.author.id === message.author.id;
            const checkCaptcha: boolean = await captchaCheck(message.channel, msg_filter);
            if(checkCaptcha) {
                console.log('fertig 2');
            }
		}
	}
});

async function captchaCheck(channel: GuildTextBasedChannel|TextBasedChannel, msg_filter: any): Promise<boolean>
{
    let captchaInput: string = 'START';
    let captchaValue: string = 'VALUE'
    while(captchaInput !== captchaValue) {
        const newCaptcha: Captcha = captcha();
        const attachment = new MessageAttachment(Buffer.from(newCaptcha.image.match(/^data:.+\/(.+);base64,(.*)$/)[2], "base64"));
        if(captchaInput === 'CANCELED') {
            return false;
        }
        captchaValue = newCaptcha.value;
        const embed: MessageEmbed = new MessageEmbed()
            .setTitle('Captcha')
            .setDescription('Please solve the captcha')
            .setColor(primaryColor)
            .setThumbnail(serverLogoUrl);
        await channel.send({ embeds: [embed], files: [attachment] });
        await channel.awaitMessages({ filter: msg_filter, max: 1, time: 15000 })
            .then((collected) => {
                const messageContent: string = collected.first()?.content ?? '';
                if(!messageContent) {
                    sendTimeoutMessage(channel);
                    captchaInput = 'CANCELED';
                    return false;
                }
                captchaInput = messageContent;
            });
    }
    return true;
}

async function getInput(input: FormInput, channel: GuildTextBasedChannel|TextBasedChannel, msg_filter: any): Promise<string>
{
    let value: string|number;

    const embed: MessageEmbed = new MessageEmbed()
        .setTitle('Captcha')
        .setDescription('Please solve the captcha')
        .setColor(primaryColor)
        .setThumbnail(serverLogoUrl);
    await channel.send({ embeds: [embed] });
    await channel.awaitMessages({ filter: msg_filter, max: 1, time: 15000 })
        .then((collected) => {
            const messageContent: string | undefined = collected.first()?.content;
            console.log('content');
            console.log(messageContent)
            if(!messageContent) {
                return 'Test';
            }
        });
        return 'test';
}

function sendTimeoutMessage(channel: GuildTextBasedChannel|TextBasedChannel): void {
    channel.send({ embeds: [new MessageEmbed()
        .setTitle('Register')
        .setDescription('Registration canceled time expired')
        .setColor(primaryColor)
        .setThumbnail(serverLogoUrl)] });
}

client.login(process.env.DISCORD_TOKEN);