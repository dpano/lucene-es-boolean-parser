import { IRule, IRuleset, operators, IRootDecorate } from './query-parser-model';

export class QueryBuilderHelper {
    private static operatorsMap = {
        'OR': '|',
        'OR NOT': ';',
        'AND': '&',
        'AND NOT': '@'
    };
    /**
     * Parse IRuleset to string with boolean expressions
     * @param query
     * @param level
     */
    static queryToString(query: IRuleset, level = 0): string {
        let text = '';
        if (query.condition && query.rules) {
            text += '(';
            query.rules.forEach((val: any, idx: number) => {
                if (val.condition && val.rules) {
                    // prepend the operator before ruleset only in levels bigger than 0
                    text += idx > 0 ? ' ' + query.condition.toUpperCase().split('_').join(' ') + ' ' : '';
                    text += this.queryToString(val, ++level);
                } else {
                    text += idx === 0 ? '' : ' ' + query.condition.toUpperCase().split('_').join(' ') + ' ';
                    text += val.entity === 'columnsearch' ? `${val.field}:${val.value}` : val.value;
                }
            });
            return text += ')';
        } else {
            return text;
        }
    }

    /**
     * Transforms a Query string to IRuleset
     * @param str
     */
    static queryStringToQueryObject(str: string): IRuleset {
        return this.parseQueryString(str);
    }

    /**
     * Removes double whitespace in a string
     * In: a b  c\nd\te
     * Out: a b c d e
     * @param phrase
     */
    private static removeDoubleWhiteSpace(phrase: string): string {
        return phrase.replace(/[\s]+/g, ' ');
    }

    /**
     * Removes the bracket at the beginning and end of a string. Only if they both
     * exist. Otherwise it returns the original phrase.
     * Ex: (a OR b) -> a OR b
     * But yet doesn't remove the brackets when the last bracket isn't linked to
     * the first bracket.
     * Ex: (a OR b) AND (x OR y) -> (a OR b) AND (x OR y)
     * @param phrase
     */
    private static removeOuterBrackets(phrase: string): string {
        // If the first character is a bracket
        if (phrase.charAt(0) === '(') {

            let counter = 0;
            for (let i = 0; i < phrase.length; i++) {

                // Increment the counter at each '('
                if (phrase.charAt(i) === '(') { counter++; } else if (phrase.charAt(i) === ')') { counter--; }

                // If the counter is at 0, we are at the closing bracket.
                if (counter === 0) {

                    // If we are not at the end of the sentence, Return the
                    // phrase as-is without modifying it
                    if (i !== phrase.length - 1) {
                        return phrase;
                    } else {
                        return phrase.substring(1, phrase.length - 1);
                    }
                }
            }

        }
        return phrase;
    }

    /**
     * Parse boolean query string to IRuleset
     * @param str
     */
    private static parseQueryString(str: string): IRuleset {
        try {
            let input = (' ' + str).slice(1); // clone string
            this.checkForBalancedBrackets(input);
            input = input.trim();
            this.checkOperatorsValidity(input);
            input = this.removeDoubleWhiteSpace(input);
            input = this.replaceSpacesWithOperator(input);
            input = this.replaceOperators(input);
            return this.parseQuery(input);
        } catch (error) {
            throw Error(error);
        }

    }

    /**
     * Creates an IRule out of a string
     * @param leaf
     */
    private static createRule(leaf: string): IRule {
        const colonFound = leaf.indexOf(':') !== -1;
        const value = colonFound ? leaf.split(':')[1] : leaf;
        return { value };
    }

    /**
     * Replaces the space between terms that it is assumed to be an operator.
     *
     * ex. a b OR c -> a AND b OR c
     * @param str
     * @param operator Default value: AND
     */
    private static replaceSpacesWithOperator(str: string, operator = 'AND'): string {
        let output = str;
        // replace space between terms that are in quotes
        output = output.replace(/\s+(?=(?:(?:[^"]*"){2})*[^"]*"[^"]*$)/g, '__');

        // replace space with operator
        str = str.replace(/(?<!AND|OR|OR NOT|AND NOT|\")\s(?!AND|OR|OR NOR|AND NOT)/g, ` ${operator} `);

        // remove __ from string
        str = str.replace(/__/g, ' ');
        return str;
    }

    /**
     * Replace operators with symbols for later parsing
     * @param str
     */
    private static replaceOperators(str: string): string {
        let res = str.replace(/AND(?! NOT)/g, '&');
        res = res.replace(/AND NOT/g, '@');
        res = res.replace(/OR(?! NOT)/g, '|');
        res = res.replace(/OR NOT/g, ';');
        return res;
    }

    /**
     * Find root operators and decorate them
     * @param str
     * @param operator
     */
    private static markRootSplit(str: string, operator: operators ): IRootDecorate {
        let parentCount = 0;
        let tmpString = '';
        let rootFound = false;
        for (let index = 0; index < str.length; index++) {
            const element = str[index];
            if (element === '(') {
                parentCount++;
                tmpString = tmpString + element;
            } else if (element === ')') {
                parentCount--;
                tmpString = tmpString + element;
            } else if (element === this.operatorsMap[operator] && parentCount === 0) {
                tmpString = tmpString + `<<${operator}>>`;
                rootFound = true;
            } else {
                tmpString = tmpString + element;
            }
        }
        return { value: tmpString, rootFound };
    }

    /**
     * Check for balanced brackets.
     *
     * Throw error if is not balanced
     * @param str
     */
    private static checkForBalancedBrackets(str: string): void {
        let parentCount = 0;
        for (let index = 0; index < str.length; index++) {
            const element = str[index];
            if (element === '(') {
                parentCount++;
            } else if (element === ')') {
                parentCount--;
            }

            if (parentCount < 0) {
                throw new Error('Brackets are not well balanced. please check your input');
            }

        }
        if (parentCount > 0) {
            throw new Error('Brackets are not balanced! Please check your Input');
        }
    }

    /**
     * Decorates operators
     * @param key
     */
    private static decoratePattern(key: string): any {
        switch (key) {
        case 'OR':
            return / \<\<OR\>\> /g;
        case 'OR NOT':
            return / \<\<OR NOT\>\> /g;
        case 'AND':
            return / \<\<AND\>\> /g;
        case 'AND NOT':
            return / \<\<AND NOT\>\> /g;
        default:
            return;
        }
    }

    /**
     * Checks for operators at the beginning and the end of the query.
     *
     * Find: ex. "AND a", "a AND", "AND OR a" etc.
     * @param str
     */
    private static checkOperatorsValidity(str: string): void {

        const pattern = /(^((AND NOT|AND|OR NOT|OR)\s)+)|((\s(AND|OR|OR NOT|AND NOT))+$)/g;
        if (str.match(pattern) !== null) {
            throw Error('Query is not well formed. Boolean operators found in the beginning or the end of the query!');
        }
    }

    /**
     * Recursive function that splits the string on root operators in order defined in operatorsMap property
     * @param str
     */
    private static parseQuery(str: string): IRuleset {
        str = this.removeOuterBrackets(str);
        let operatorFound: string = '';
        let rootSplitsDecorated: IRootDecorate | undefined;

        Object.keys(this.operatorsMap).some((key: any) => {
            const root = this.markRootSplit(str, key);
            if (root.rootFound) {
                operatorFound = key;
                rootSplitsDecorated = root;
                return true;
            }
        });

        const tree: IRuleset = { condition: 'AND', rules: [] };
        let splited = [];
        if (rootSplitsDecorated && rootSplitsDecorated.rootFound) {
            const pattern = this.decoratePattern(operatorFound);
            splited = rootSplitsDecorated.value.split(pattern);
            tree.condition = operatorFound;

          // iterate over members to find operators
            splited.forEach(val => {
                if (val.match(/(\&|\@|\||\;)/) === null) {
              // is a leaf
              // push to rules
                    tree.rules.push(this.createRule(val));
                } else {
              // recurse
                    tree.rules.push(this.parseQuery(val));
                }
            });
            return tree;
        } else if ( rootSplitsDecorated === undefined) {
            // When there is only one term in the query string
            tree.rules.push(this.createRule(str));
        }
        return tree;
    }

}



