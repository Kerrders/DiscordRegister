import {
    Client,
    Intents,
    ColorResolvable,
    GuildTextBasedChannel,
    Message,
    MessageAttachment,
    MessageEmbed,
    TextBasedChannel,
    Collection
} from 'discord.js';
import * as dotenv from 'dotenv';
import Captcha = require('@haileybot/captcha-generator');
import { FormInput } from './interfaces/input.interface';
import { FormType } from './enums/form-type';
import { FormInputValue } from './interfaces/input-value.interface';

dotenv.config();
const client = new Client({
    partials: ['CHANNEL'],
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES]
});
const prefix: string | undefined = process.env.COMMAND_PREFIX;
const serverLogoUrl: string = process.env.SERVERLOGO_URL ?? '';
const primaryColor: ColorResolvable = '#0099ff';

client.on('ready', () => {
    console.log(`Ready`);
});

client.on('messageCreate', async (message: Message) => {
    if (message.channel.type.toLowerCase() === 'dm') {
        if (message.content.startsWith(`${prefix}register`)) {
            const msg_filter: (m: Message) => boolean = (m: Message) => m.author.id === message.author.id;
            const registerFormElements: Array<FormInput> = [
                {
                    fieldName: 'social_code',
                    name: 'Delete code',
                    description: 'Please enter a delete code (7 chars)',
                    type: FormType.NUMBER,
                    min: 7,
                    max: 7
                },
                {
                    fieldName: 'login',
                    name: 'Username',
                    description: 'Please enter a username (5-15 chars)',
                    type: FormType.TEXT,
                    min: 5,
                    max: 15
                },
                {
                    fieldName: 'password',
                    name: 'Password',
                    description: 'Please enter a password (5-15 chars)',
                    type: FormType.TEXT,
                    min: 5,
                    max: 15
                },
                {
                    fieldName: 'email',
                    name: 'E-mail',
                    description: 'Please enter a valid E-mail',
                    type: FormType.EMAIL
                }
            ];
            const formResults: Array<FormInputValue> = [];
            for (const formInput of registerFormElements) {
                let value = 'INVALID';
                while (value === 'INVALID') {
                    value = await getInput(formInput, message.channel, msg_filter);
                }
                if (!value) {
                    return;
                }
                formResults.push({
                    fieldName: formInput.fieldName,
                    value: value
                });
            }
            console.log(formResults);
            const checkCaptcha: boolean = await captchaCheck(message.channel, msg_filter);
            if (checkCaptcha) {
                // @todo insert into database
            }
        }
    }
});

async function captchaCheck(
    channel: GuildTextBasedChannel | TextBasedChannel,
    msg_filter: (m: Message) => boolean
): Promise<boolean> {
    let captchaInput = 'START';
    let captchaValue = 'VALUE';
    while (captchaInput !== captchaValue) {
        const newCaptcha: Captcha = new Captcha();
        const base64Match: RegExpMatchArray | null = newCaptcha.dataURL.match(/^data:.+\/(.+);base64,(.*)$/);
        const attachment = new MessageAttachment(Buffer.from(base64Match ? base64Match[2] : '', 'base64'));
        if (captchaInput === 'CANCELED') {
            return false;
        }
        captchaValue = newCaptcha.value;
        const embed: MessageEmbed = new MessageEmbed()
            .setTitle('Captcha')
            .setDescription('Please solve the captcha')
            .setColor(primaryColor)
            .setThumbnail(serverLogoUrl);
        await channel.send({ embeds: [embed], files: [attachment] });
        await channel.awaitMessages({ filter: msg_filter, max: 1, time: 15000 }).then((collected) => {
            const messageContent: string = collected.first()?.content ?? '';
            if (!messageContent) {
                sendTimeoutMessage(channel);
                captchaInput = 'CANCELED';
                return false;
            }
            captchaInput = messageContent;
        });
    }
    return true;
}

async function getInput(
    input: FormInput,
    channel: GuildTextBasedChannel | TextBasedChannel,
    msg_filter: (m: Message) => boolean
): Promise<string> {
    const embed: MessageEmbed = new MessageEmbed()
        .setTitle(input.name)
        .setDescription(input.description)
        .setColor(primaryColor)
        .setThumbnail(serverLogoUrl);
    await channel.send({ embeds: [embed] });
    const value: string = await channel
        .awaitMessages({ filter: msg_filter, max: 1, time: 15000 })
        .then((collected: Collection<string, Message<boolean>>) => {
            const messageContent: string | undefined = collected.first()?.content;
            if (!messageContent) {
                sendTimeoutMessage(channel);
                return '';
            }

            if (
                (input.min && messageContent.length < input.min) ||
                (input.max && messageContent.length > input.max) ||
                (input.type === FormType.NUMBER && (isNaN(Number(messageContent)) || Number(messageContent) < 0)) ||
                (input.type === FormType.EMAIL && !messageContent.toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/))
            ) {
                return 'INVALID';
            }

            return messageContent;
        });
    return value;
}

function sendTimeoutMessage(channel: GuildTextBasedChannel | TextBasedChannel): void {
    channel.send({
        embeds: [
            new MessageEmbed()
                .setTitle('Register')
                .setDescription('Registration canceled time expired')
                .setColor(primaryColor)
                .setThumbnail(serverLogoUrl)
        ]
    });
}

client.login(process.env.DISCORD_TOKEN);
