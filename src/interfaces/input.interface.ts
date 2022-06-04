import { MessageSelectOptionData } from 'discord.js';
import { FormType } from 'src/enums/form-type';

export interface FormInput {
    fieldName: string;
    name: string;
    description: string;
    type: FormType;
    min?: number;
    max?: number;
    selectOptions?: Array<MessageSelectOptionData>;
}
