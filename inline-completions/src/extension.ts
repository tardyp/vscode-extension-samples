import * as vscode from 'vscode';
import { Range } from 'vscode';
import axios from 'axios';


const API_ENDPOINT = "us-central1-aiplatform.googleapis.com";
const MODEL_ID = "code-gecko@001";

axios.interceptors.request.use(x => {
	// replace console with our logger of choice
	console.log("request", x);
	return x;
})

axios.interceptors.response.use(x => {
	console.log("response", x)
	return x;
})


export function activate(context: vscode.ExtensionContext) {

	const provider: vscode.InlineCompletionItemProvider = {
		async provideInlineCompletionItems(document, position, context, token) {
			const config = vscode.workspace.getConfiguration('codey');
			console.log(config);
			const TOKEN = config.get("gcloudtoken");
			const PROJECT_ID = config.get("projectid");
			const MAXOUTPUTTOKENS = config.get("maxOutputTokens");
			const TEMPERATURE = config.get("temperature");
			// if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
			// 	return [];
			// }
			let curline = document.lineAt(position.line).text;

			let prefix = ""//  `\`\`\`${document.languageId}\n`; //@TODO: not sure how to tell the language
			let suffix = curline.slice(position.character, curline.length)
			for (let i = Math.max(0, position.line - 2); i < position.line; i++) {
				prefix = prefix.concat(document.lineAt(i).text).concat("\n");
			}
			prefix = prefix.concat(curline.slice(0, position.character));
			for (let i = position.line; i < Math.min(document.lineCount, position.line + 2); i++) {
				suffix = suffix.concat(document.lineAt(i).text).concat("\n");
			}
			suffix = suffix.concat("\n```\n");
			console.log(prefix);
			console.log(suffix);
			const result: vscode.InlineCompletionList = {
				items: [],
			};
			if (prefix.trim().length < 10) {
				return result;
			}
			try {

				const response = await axios.post(
					`https://${API_ENDPOINT}/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/${MODEL_ID}:predict`,
					{
						"instances": [
							{
								"prefix": prefix,
								"suffix": suffix,
							}
						],
						"parameters": {
							"temperature": TEMPERATURE,
							"maxOutputTokens": MAXOUTPUTTOKENS,
						},
					}, {
					headers: {
						"Authorization": `Bearer ${TOKEN}`,
						"Content-Type": "application/json",
						"Accept": "application/json",
					}
				});
				let prediction = response.data.predictions[0].content;
				let first_line = prediction.split("\n")[0];
				// some heuristic to decide whether we propose multiline or not
				if (document.languageId === "python") {
					if (first_line[first_line.length - 1] !== ':')
						prediction = first_line;
				}
				else {
					if (first_line.indexOf("{") === -1)
						prediction = first_line;
				}
				result.items.push({
					insertText: prediction
				});
			} catch (error: any) {
				console.log(error);
			}
			return result;
		},
	};
	vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, provider);
}
