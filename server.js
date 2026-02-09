/**
 * NLSH Web UI Server
 * Serves the web interface and provides API endpoints for command execution
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const WEB_UI_DIR = join(__dirname, 'web-ui');

// MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Shell configuration
const EXEC_SHELL = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
let currentWorkingDir = process.cwd();

// Execute command and return result
function executeCommand(command) {
    return new Promise((resolve) => {
        let output = '';
        let error = '';

        const child = spawn(command, {
            shell: EXEC_SHELL,
            cwd: currentWorkingDir
        });

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            error += data.toString();
        });

        child.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });

        child.on('exit', (code) => {
            if (code === 0) {
                resolve({ success: true, output: output.trim() });
            } else {
                resolve({ success: false, error: error.trim() || output.trim() });
            }
        });

        // Timeout after 30 seconds
        setTimeout(() => {
            child.kill();
            resolve({ success: false, error: 'Command timed out' });
        }, 30000);
    });
}

// Handle API requests
async function handleApiRequest(req, res, body) {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/api/execute' && req.method === 'POST') {
        try {
            const data = JSON.parse(body);
            const command = data.command;

            if (!command) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No command provided' }));
                return;
            }

            // Handle CD commands specially
            if (command.toLowerCase().startsWith('cd ') || command.toLowerCase().startsWith('set-location ')) {
                const target = command.replace(/^(cd|set-location)\s+/i, '').replace(/['"]/g, '').trim();
                try {
                    const newPath = join(currentWorkingDir, target);
                    if (existsSync(newPath)) {
                        currentWorkingDir = newPath;
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            output: `Changed directory to: ${currentWorkingDir}`,
                            cwd: currentWorkingDir
                        }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: `Directory not found: ${target}` }));
                    }
                } catch (err) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
                return;
            }

            const result = await executeCommand(command);
            result.cwd = currentWorkingDir;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    if (url.pathname === '/api/cwd' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ cwd: currentWorkingDir }));
        return;
    }

    if (url.pathname === '/api/cwd' && req.method === 'POST') {
        try {
            const data = JSON.parse(body);
            if (data.path && existsSync(data.path)) {
                currentWorkingDir = data.path;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, cwd: currentWorkingDir }));
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid path' }));
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // 404 for unknown API routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}

// Serve static files
function serveStatic(req, res) {
    let filePath = join(WEB_UI_DIR, req.url === '/' ? 'index.html' : req.url);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
        if (!existsSync(filePath)) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        const content = readFileSync(filePath);
        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
    } catch (err) {
        res.writeHead(500);
        res.end('Server Error');
    }
}

// Create HTTP server
const server = createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Collect body for POST requests
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        // API routes
        if (req.url.startsWith('/api/')) {
            await handleApiRequest(req, res, body);
            return;
        }

        // Static files
        serveStatic(req, res);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧠  NLSH Web UI Server                                  ║
║                                                           ║
║   Server running at: http://localhost:${PORT}               ║
║                                                           ║
║   Open your browser and navigate to the URL above         ║
║   to use the Natural Language Shell interface.            ║
║                                                           ║
║   Press Ctrl+C to stop the server.                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
});
