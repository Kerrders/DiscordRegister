import mysql from 'mysql2';
import Connection, { ConnectionOptions } from 'mysql2/typings/mysql/lib/Connection';
import { FormInputValue } from 'src/interfaces/input-value.interface';

export class DatabaseService {
    private db: Connection;

    constructor(private connectionOptions: ConnectionOptions) {
        this.db = mysql.createConnection(this.connectionOptions);
    }

    public async createAccount(data: Array<FormInputValue>, callback: Function): Promise<void> {
        const fieldNames: Array<string> = data.map((field: FormInputValue) => {
            return field.fieldName;
        });

        const fieldValues: Array<string | number> = data.map((field: FormInputValue) => {
            return field.value;
        });

        const queryString = `INSERT INTO account (${fieldNames.join(',')}) VALUES (${Array(fieldNames.length)
            .fill('?')
            .join(',')})`;

        this.db.query(queryString, fieldValues, (err) => {
            if (err) {
                callback(false);
                return;
            }
            callback(true);
        });
    }
}
