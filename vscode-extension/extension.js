const vscode = require('vscode');
const https = require('https');
const { URL } = require('url');

let statusBar;
let outputChannel;
let decorations = [];

function activate(context) {
    outputChannel = vscode.window.createOutputChannel('UTA Trust Verify');
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = '$(shield) UTA';
    statusBar.tooltip = 'UTA Trust Verify — Click to check all MCP servers';
    statusBar.command = 'uta.checkAllServers';
    statusBar.show();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('uta.verifyTrust', verifyTrust),
        vscode.commands.registerCommand('uta.checkAllServers', checkAllServers),
        vscode.commands.registerCommand('uta.showPlayground', showPlayground),
        statusBar,
        outputChannel
    );

    // Auto-verify on JSON file open
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.languageId === 'json') {
                autoVerify(editor);
            }
        })
    );

    // Decorator for trust badges
    const trustedDecoration = vscode.window.createTextEditorDecorationType({
        gutterIconPath: vscode.Uri.parse('data:image/svg+xml;base64,' + Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#00F299"/><path d="M5 8l2 2 4-4" stroke="#050505" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        ).toString('base64')),
        gutterIconSize: 'cover'
    });

    const untrustedDecoration = vscode.window.createTextEditorDecorationType({
        gutterIconPath: vscode.Uri.parse('data:image/svg+xml;base64,' + Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#fb2c36"/><path d="M5 5l6 6M11 5l-6 6" stroke="#050505" stroke-width="2" stroke-linecap="round"/></svg>'
        ).toString('base64')),
        gutterIconSize: 'cover'
    });

    decorations = [trustedDecoration, untrustedDecoration];
    context.subscriptions.push(...decorations);

    outputChannel.appendLine('[UTA] Extension activated');
}

async function autoVerify(editor) {
    const config = vscode.workspace.getConfiguration('uta');
    if (!config.get('autoVerify', true)) return;

    const text = editor.document.getText();
    if (!text.includes('mcp') && !text.includes('MCP') && !text.includes('server') && !text.includes('trust')) return;

    try {
        const parsed = JSON.parse(text);
        if (parsed.mcpServers || parsed.servers || parsed.tools || parsed.spec_version) {
            await verifyEditor(editor);
        }
    } catch {
        // Not valid JSON or not an MCP config
    }
}

async function verifyTrust() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('UTA: No active editor');
        return;
    }
    await verifyEditor(editor);
}

async function verifyEditor(editor) {
    const text = editor.document.getText();
    const config = vscode.workspace.getConfiguration('uta');
    const apiUrl = config.get('apiBaseUrl', 'https://www.marketnow.site/api/trust');
    const minScore = config.get('minTrustScore', 5);

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        statusBar.text = '$(shield) UTA: Invalid JSON';
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        return;
    }

    statusBar.text = '$(loading~spin) UTA: Verifying...';
    statusBar.backgroundColor = undefined;

    try {
        // If this is an MCP config with multiple servers, check each
        if (parsed.mcpServers) {
            const results = {};
            let allTrusted = true;
            let anyVerified = false;

            for (const [name, config] of Object.entries(parsed.mcpServers)) {
                const result = await checkServer(apiUrl, name, config);
                results[name] = result;
                if (result.verified) anyVerified = true;
                if (!result.trusted) allTrusted = false;
            }

            if (anyVerified) {
                statusBar.text = allTrusted
                    ? `$(shield) UTA: All ${Object.keys(results).length} servers trusted ✓`
                    : `$(shield) UTA: ${Object.values(results).filter(r => r.trusted).length}/${Object.keys(results).length} trusted`;
                statusBar.backgroundColor = allTrusted
                    ? undefined
                    : new vscode.ThemeColor('statusBarItem.warningBackground');
            } else {
                statusBar.text = `$(shield) UTA: ${Object.keys(results).length} servers (unverified)`;
                statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            }

            outputChannel.appendLine(`[UTA] Checked ${Object.keys(results).length} MCP servers`);
            for (const [name, result] of Object.entries(results)) {
                outputChannel.appendLine(`  ${result.trusted ? '✅' : '⚠️'} ${name}: score=${result.score} ${result.reason || ''}`);
            }

            // Apply decorations
            applyDecorations(editor, results);
        } else {
            // Single credential verification
            const result = await verifyCredential(apiUrl, parsed);
            if (result.valid) {
                statusBar.text = `$(shield) UTA: ✓ ${result.format} (score: ${result.score})`;
                statusBar.backgroundColor = undefined;
            } else {
                statusBar.text = `$(shield) UTA: ✗ Invalid`;
                statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            }
            outputChannel.appendLine(`[UTA] ${result.valid ? '✅' : '❌'} ${result.format || 'unknown'} — ${result.reason || 'valid'}`);
        }

        vscode.window.showInformationMessage(`UTA: Verification complete. See Output panel for details.`);
    } catch (err) {
        statusBar.text = '$(shield) UTA: Error';
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        outputChannel.appendLine(`[UTA] Error: ${err.message}`);
        vscode.window.showErrorMessage(`UTA: ${err.message}`);
    }
}

async function checkAllServers() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('UTA: No active editor');
        return;
    }
    await verifyEditor(editor);
}

async function checkServer(apiUrl, name, config) {
    // Try to verify the server's trust credentials
    const trustPayload = {
        name: name,
        command: config.command,
        args: config.args,
        url: config.url
    };

    try {
        const response = await postJson(`${apiUrl}?action=verify`, { payload: trustPayload });
        const score = response.uts?.trust?.score || 0;
        const format = response.detected_format || response.verified_via;
        const verified = response.valid || response.uts;
        const minScore = vscode.workspace.getConfiguration('uta').get('minTrustScore', 5);

        return {
            name,
            verified: !!verified,
            trusted: verified && score >= minScore,
            score,
            format,
            reason: verified ? (score >= minScore ? 'trusted' : `score ${score} < ${minScore}`) : 'unverified'
        };
    } catch (err) {
        return {
            name,
            verified: false,
            trusted: false,
            score: 0,
            format: null,
            reason: err.message
        };
    }
}

async function verifyCredential(apiUrl, credential) {
    const response = await postJson(`${apiUrl}?action=verify`, { payload: credential });
    return {
        valid: response.valid || !!response.uts,
        format: response.detected_format || response.verified_via,
        score: response.uts?.trust?.score || 0,
        uts: response.uts,
        reason: response.reason,
        warnings: response.warnings || []
    };
}

function applyDecorations(editor, results) {
    const config = vscode.workspace.getConfiguration('uta');
    const minScore = config.get('minTrustScore', 5);

    const trustedRanges = [];
    const untrustedRanges = [];

    const text = editor.document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        for (const [name, result] of Object.entries(results)) {
            if (lines[i].includes(`"${name}"`)) {
                const range = new vscode.Range(i, 0, i, 0);
                if (result.trusted) {
                    trustedRanges.push({ range });
                } else {
                    untrustedRanges.push({ range });
                }
            }
        }
    }

    editor.setDecorations(decorations[0], trustedRanges);
    editor.setDecorations(decorations[1], untrustedRanges);
}

async function showPlayground() {
    const panel = vscode.window.createWebviewPanel(
        'utaPlayground',
        'UTA Playground',
        vscode.ViewColumn.Two,
        { enableScripts: true }
    );

    panel.webview.html = getPlaygroundHtml();
}

function getPlaygroundHtml() {
    return `<!DOCTYPE html>
<html>
<head><style>
body{font-family:system-ui;background:#050505;color:#fff;padding:16px}
textarea{width:100%;min-height:200px;background:#0a0a0b;color:#fff;border:1px solid #1f1f23;border-radius:8px;padding:10px;font-family:monospace}
button{background:#00F299;color:#050505;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600}
pre{background:#0a0a0b;border:1px solid #1f1f23;border-radius:8px;padding:10px;overflow-x:auto;max-height:300px;font-size:12px}
</style></head>
<body>
<h2>UTA Playground</h2>
<p>Paste any credential JSON to verify and translate:</p>
<textarea id="inp" placeholder="Paste credential JSON..."></textarea>
<br><br>
<button onclick="verify()">Verify + Translate →</button>
<br><br>
<pre id="out">// Results will appear here</pre>
<script>
async function verify(){
const i=document.getElementById('inp').value;if(!i)return;
const r=await fetch('https://www.marketnow.site/api/trust?action=verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload:JSON.parse(i)})});
const d=await r.json();
document.getElementById('out').textContent=JSON.stringify(d,null,2);
}
</script>
</body>
</html>`;
}

function postJson(url, data) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const body = JSON.stringify(data);
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || 443,
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'User-Agent': 'UTA-VSCode-Extension/0.1.0'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function deactivate() {
    if (statusBar) statusBar.dispose();
    if (outputChannel) outputChannel.dispose();
}

module.exports = { activate, deactivate };
