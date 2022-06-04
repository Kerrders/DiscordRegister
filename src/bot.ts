import {
    Client,
    Intents,
    ColorResolvable,
    GuildTextBasedChannel,
    Message,
    MessageAttachment,
    MessageEmbed,
    TextBasedChannel,
    Collection,
    MessageSelectMenu,
    MessageActionRow
} from 'discord.js';
import * as dotenv from 'dotenv';
import Captcha = require('@haileybot/captcha-generator');
import { FormInput } from './interfaces/input.interface';
import { FormTypeEnum } from './enums/form-type-enum';
import { FormInputValue } from './interfaces/input-value.interface';

dotenv.config();
const client = new Client({
    partials: ['CHANNEL'],
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES]
});
const prefix: string = process.env.COMMAND_PREFIX ?? '!';
const serverLogoUrl: string = process.env.SERVERLOGO_URL ?? '';
const primaryColor: ColorResolvable = '#0099ff';
const registerFormElements: Array<FormInput> = [
    {
        type: FormTypeEnum.SELECT,
        fieldName: 'question',
        name: 'Security question',
        description: 'Choose a security question',
        selectOptions: [
            {
                emoji: '🐶',
                label: 'What as the Name of your first pet?',
                value: 'first_option'
            },
            {
                emoji: '👵',
                label: 'What is the name of your grandmother?',
                value: 'second_option'
            },
            {
                emoji: '🚗',
                label: 'What was your first car?',
                value: 'car'
            }
        ]
    },
    {
        type: FormTypeEnum.TEXT,
        fieldName: 'login',
        name: 'Username',
        description: 'Please enter a username (5-15 chars)',
        min: 5,
        max: 15
    },
    {
        type: FormTypeEnum.TEXT,
        fieldName: 'password',
        name: 'Password',
        description: 'Please enter a password (5-15 chars)',
        min: 5,
        max: 15
    },
    {
        type: FormTypeEnum.EMAIL,
        fieldName: 'email',
        name: 'E-mail',
        description: 'Please enter a valid E-mail'
    },
    {
        type: FormTypeEnum.NUMBER,
        fieldName: 'social_code',
        name: 'Delete code',
        description: 'Please enter a delete code (7 chars)',
        min: 7,
        max: 7
    }
];
let tmpData: Array<FormInput> = [];
let selectBoxTmpData: Array<string> = [];
let tmpUserInRegister: Array<number> = [];

client.on('ready', () => {
    console.log(`Ready`);
});

client.on('messageCreate', async (message: Message) => {
    if (message.channel.type.toLowerCase() === 'dm') {
        if (message.content.startsWith(`${prefix}register`)) {
            if (tmpUserInRegister[parseInt(message.author.id)]) {
                return;
            }
            const msg_filter: (m: Message) => boolean = (m: Message) => m.author.id === message.author.id;
            const formResults: Array<FormInputValue> = [];
            for (const formInput of registerFormElements) {
                let value = 'INVALID';
                while (value === 'INVALID') {
                    switch (formInput.type) {
                        case FormTypeEnum.SELECT:
                            value = await getSelectValue(formInput, message.channel, parseInt(message.author.id));
                            break;
                        default:
                            value = await getInputValue(
                                formInput,
                                message.channel,
                                msg_filter,
                                parseInt(message.author.id)
                            );
                            break;
                    }
                }
                console.log('VALUE');
                console.log(value);
                if (!value) {
                    return;
                }
                formResults.push({
                    fieldName: formInput.fieldName,
                    value: value
                });
            }
            console.log(formResults);
            const checkCaptcha: boolean = await captchaCheck(parseInt(message.author.id), message.channel, msg_filter);
            if (checkCaptcha) {
                // @todo insert into database
            }
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isSelectMenu()) return;

    const selectBoxExist: boolean = registerFormElements.some((input) => input.fieldName === interaction.customId);
    const userId: number = parseInt(interaction.user.id);
    if (selectBoxExist && tmpData[userId] !== undefined) {
        await interaction.update({ content: 'Something was selected!', components: [] });
        selectBoxTmpData[userId] = interaction.values[0];
        delete tmpData[userId];
    }
});

async function captchaCheck(
    userId: number,
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
                cancelRegister(userId, channel);
                captchaInput = 'CANCELED';
                return false;
            }
            captchaInput = messageContent;
        });
    }
    return true;
}

async function getInputValue(
    input: FormInput,
    channel: GuildTextBasedChannel | TextBasedChannel,
    msg_filter: (m: Message) => boolean,
    userId: number
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
                cancelRegister(userId, channel);
                return '';
            }

            if (
                (input.min && messageContent.length < input.min) ||
                (input.max && messageContent.length > input.max) ||
                (input.type === FormTypeEnum.NUMBER && (isNaN(Number(messageContent)) || Number(messageContent) < 0)) ||
                (input.type === FormTypeEnum.EMAIL &&
                    !messageContent
                        .toLowerCase()
                        .match(
                            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
                        ))
            ) {
                return 'INVALID';
            }

            return messageContent;
        });
    return value;
}

async function getSelectValue(
    input: FormInput,
    channel: GuildTextBasedChannel | TextBasedChannel,
    userId: number
): Promise<string> {
    if (!input.selectOptions) {
        return '';
    }
    const row = new MessageActionRow().addComponents(
        new MessageSelectMenu()
            .setCustomId(input.fieldName)
            .setPlaceholder('Nothing selected')
            .addOptions(input.selectOptions)
    );
    const embed: MessageEmbed = new MessageEmbed()
        .setTitle(input.name)
        .setDescription(input.description)
        .setColor(primaryColor)
        .setThumbnail(serverLogoUrl);
    await channel.send({ components: [row], embeds: [embed] });
    const timeoutID: NodeJS.Timeout = setTimeout(function () {
        cancelRegister(userId, channel);
    }, 15000);
    tmpData[userId] = input;

    while (tmpData[userId] !== undefined) {
        await new Promise((f) => setTimeout(f, 1000));
    }
    clearTimeout(timeoutID);
    const selectValue: string = selectBoxTmpData[userId];
    delete selectBoxTmpData[userId];
    return selectValue ?? '';
}

function cancelRegister(userId: number, channel: GuildTextBasedChannel | TextBasedChannel): void {
    delete tmpData[userId];
    delete tmpUserInRegister[userId];
    delete selectBoxTmpData[userId];

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
