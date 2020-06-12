export interface IRule {
    value: string;
}
export type parserRules = IRule[] | IRuleset[];

export interface IRuleset {
    condition: string;
    rules: IRule[] & IRuleset[];
}

export interface IRootDecorate {
    value: string; 
    rootFound: boolean
}

export type operators = 'OR' | 'AND' | 'OR NOT' | 'AND NOT';