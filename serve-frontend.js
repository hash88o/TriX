const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.svg': 'application/image/svg+xml'
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;

    // If requesting root, serve index.html
    if (pathname === '/') {
        pathname = '/index.html';
    }

    // Construct file path
    const filePath = path.join(__dirname, 'frontend', pathname);

    // Get file extension
    const ext = path.parse(filePath).ext;

    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // File not found
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('File not found');
            return;
        }

        // Read and serve file
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.end('Server error');
                return;
            }

            // Set content type
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            res.statusCode = 200;
            res.setHeader('Content-Type', contentType);
            res.end(data);
        });
    });
});

server.listen(PORT, () => {
    console.log(`🚀 TriX Frontend Server running at http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${path.join(__dirname, 'frontend')}`);
    console.log('🔗 Open http://localhost:3000 in your browser');
    console.log('📱 Make sure MetaMask is installed and connected to Sepolia testnet');
});

// Handle server errors
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is already in use. Please use a different port.`);
    } else {
        console.log('❌ Server error:', err);
    }
});
