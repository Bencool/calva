import * as vscode from 'vscode';
import * as state from '../state';
import * as util from '../utilities';
import * as infoparser from './infoparser';

export default class HoverProvider implements vscode.HoverProvider {
    state: any;

    constructor() {
        this.state = state;
    }

    async provideHover(document, position, _) {

        if (util.getConnectedState()) {
            let text = util.getWordAtPosition(document, position);
            let ns = util.getNamespace(document);
            let client = util.getSession(util.getFileType(document));
            if(client) {
                await util.createNamespaceFromDocumentIfNotExists(document);
                let res = await client.info(ns, text);
                return new vscode.Hover(infoparser.getHover(res));
            }
            return new vscode.Hover(infoparser.getHoverNotAvailable(text));
        } else {
            return new vscode.Hover("Please connect to a REPL to retrieve information.");
        }
    }
};
