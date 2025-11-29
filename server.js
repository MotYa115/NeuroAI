const express = require('express');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3002;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Directory to store uploaded files
    },
    filename: function (req, file, cb) {
        // Create unique filename to prevent conflicts
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Serve static files from the 'public' directory
app.use(express.static('.'));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Parse JSON bodies
app.use(express.json());

// Admin user configuration
const ADMIN_USERNAME = 'motya';

// Store for user messages that need admin responses
// NOTE: Using in-memory storage which will reset on server restart
// In production, use a database for persistent storage
let pendingMessages = [];
// Store for admin responses to users
// NOTE: Using in-memory storage which will reset on server restart
// In production, use a database for persistent storage
let adminResponses = [];
// Store for active connections (for real-time messaging)
let connectedUsers = new Map(); // userId -> socket/connection
let connectedAdmin = null; // Only one admin connection at a time

// Route to get the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API route to authenticate user and check admin status
app.post('/api/auth', (req, res) => {
    const { username } = req.body;
    const isAdmin = username === ADMIN_USERNAME;

    res.json({
        success: true,
        isAdmin: isAdmin,
        username: username
    });
});

// API route to receive user messages
app.post('/api/message', (req, res) => {
    try {
        const { message, userId, username, targetUserId } = req.body; // Add targetUserId for admin responses

        // Validate required fields
        if (!username) {
            return res.status(400).json({
                error: 'Username is required'
            });
        }

        // Check if user is admin
        const isAdmin = username === ADMIN_USERNAME;

        if (isAdmin) {
            // This is an admin sending a response to a specific user's message
            console.log(`Администратор ${username} отправил сообщение: ${message}`);

            // Add the admin response to the responses array, targeting a specific user
            const responseObj = {
                id: Date.now(),
                adminUsername: username,
                response: message,
                targetUserId: targetUserId || 'all', // If no target specified, send to all users
                timestamp: new Date()
            };

            adminResponses.push(responseObj);

            res.json({
                status: 'admin response sent',
                message: 'Admin response processed'
            });
        } else {
            // Regular user sending a message - add to pending messages for admin
            const messageObj = {
                id: Date.now(),
                userId: userId || 'anonymous',
                username: username || 'Анонимный пользователь',
                message: message,
                timestamp: new Date(),
                status: 'pending' // Could be 'pending', 'assigned', 'responded'
            };

            pendingMessages.push(messageObj);

            // Log to console for admin awareness
            console.log(`Сообщение от пользователя ${messageObj.username}: ${messageObj.message}`);

            // Respond immediately to the client
            res.json({
                status: 'received',
                message: 'Генерируется ответ на ваш запрос. Это обычно занимает от 2 до 5 минут.',
                isAdmin: false
            });

            // If there's a connected admin, notify them of the new message
            if (connectedAdmin) {
                // In a real implementation with WebSockets this would be done via socket.emit
            }
        }
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// API route to receive user messages with files
app.post('/api/message-with-files', upload.any(), (req, res) => {
    try {
        const { message, userId, username, targetUserId, isAdmin } = req.body;

        // Validate required fields
        if (!username) {
            return res.status(400).json({
                error: 'Username is required'
            });
        }

        // Check if user is admin
        const isAdminUser = isAdmin === 'true' || username === ADMIN_USERNAME;

        // Get uploaded files
        const files = req.files || [];

        // Log uploaded files
        console.log(`${username} отправил ${files.length} файлов:`, files.map(f => f.originalname));

        if (isAdminUser) {
            // This is an admin sending a response with files to a specific user's message
            console.log(`Администратор ${username} отправил сообщение с ${files.length} файлами: ${message}`);

            // Add the admin response to the responses array, targeting a specific user
            const responseObj = {
                id: Date.now(),
                adminUsername: username,
                response: message || 'Admin sent files',
                files: files.map(f => ({
                    filename: f.filename,
                    originalname: f.originalname,
                    path: f.path,
                    size: f.size
                })),
                targetUserId: targetUserId || 'all', // If no target specified, send to all users
                timestamp: new Date()
            };

            adminResponses.push(responseObj);

            res.json({
                status: 'admin response with files sent',
                message: 'Admin response with files processed',
                fileCount: files.length
            });
        } else {
            // Regular user sending a message with files - add to pending messages for admin
            const messageObj = {
                id: Date.now(),
                userId: userId || 'anonymous',
                username: username || 'Анонимный пользователь',
                message: message || 'User sent files',
                files: files.map(f => ({
                    filename: f.filename,
                    originalname: f.originalname,
                    path: f.path,
                    size: f.size
                })),
                timestamp: new Date(),
                status: 'pending' // Could be 'pending', 'assigned', 'responded'
            };

            pendingMessages.push(messageObj);

            // Log to console for admin awareness
            console.log(`Сообщение от пользователя ${messageObj.username} с ${files.length} файлами: ${messageObj.message}`);

            // Respond immediately to the client
            res.json({
                status: 'received with files',
                message: `Генерируется ответ на ваш запрос. Это обычно занимает от 2 до 5 минут. Файлов отправлено: ${files.length}`,
                fileCount: files.length,
                isAdmin: false
            });
        }
    } catch (error) {
        console.error('Error processing message with files:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// API route for admin to get pending messages
app.get('/api/pending-messages', (req, res) => {
    res.json(pendingMessages);
});

// API route for admin to mark message as responded
app.post('/api/mark-responded', (req, res) => {
    const { messageId } = req.body;

    // Find the message in pendingMessages
    const messageIndex = pendingMessages.findIndex(msg => msg.id == messageId);
    if (messageIndex !== -1) {
        // Remove the message from pending list
        const removedMessage = pendingMessages.splice(messageIndex, 1)[0];

        console.log(`Сообщение от ${removedMessage.username} отмечено как отвеченное администратором`);

        res.json({
            status: 'marked as responded',
            message: 'Message marked as responded'
        });
    } else {
        res.status(404).json({ error: 'Message not found' });
    }
});

// API route for users to clear responses they've received
app.post('/api/clear-responses', (req, res) => {
    const { userId } = req.body;

    // In a real implementation, you would only clear responses that have been read
    // For this simplified version, we'll just keep responses that are not targeted to this user
    // (responses are currently cleared when received by the client)

    // For now, let's just return success
    res.json({
        status: 'responses cleared'
    });
});

// API route for regular users to get admin response
app.get('/api/user-response', (req, res) => {
    try {
        const { userId } = req.query;

        // Validate required fields
        if (!userId) {
            return res.status(400).json({
                error: 'UserId is required'
            });
        }

        // Filter responses for this specific user or responses marked for all users
        const userResponses = adminResponses.filter(response =>
            response.targetUserId === 'all' ||
            response.targetUserId === userId
        );

        res.json({
            responses: userResponses
        });
    } catch (error) {
        console.error('Error fetching user responses:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log('Откройте в браузере http://localhost:' + PORT + ' для использования фейковой нейросети');
});