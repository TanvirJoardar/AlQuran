declare module 'sql.js' {
  interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): { columns: string[]; values: any[][] }[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  interface Statement {
    run(params?: any[]): void;
    free(): void;
  }

  interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database;
  }

  interface InitOptions {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(options?: InitOptions): Promise<SqlJsStatic>;
  export type { Database, Statement, SqlJsStatic };
}
