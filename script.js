document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    let username = localStorage.getItem('username');
    let isAdmin = localStorage.getItem('isAdmin') === 'true';
    const loginModal = document.getElementById('loginModal');

    if (!username) {
        // Show login modal
        loginModal.style.display = 'flex';
    } else {
        // Authenticate user with server to confirm role
        authenticateUser(username)
            .then(result => {
                if (result.success) {
                    isAdmin = result.isAdmin;
                    localStorage.setItem('isAdmin', isAdmin);
                    loginModal.style.display = 'none';
                    updateUserInfo(username, isAdmin);

                    // Initialize UI based on user type
                    initializeUserInterface(isAdmin);

                    // Restore chat history after UI initialization
                    restoreChatHistory();
                } else {
                    // If authentication fails, show login again
                    loginModal.style.display = 'flex';
                }
            })
            .catch(error => {
                console.error('Authentication error:', error);
                loginModal.style.display = 'flex';
            });
    }

    // Login button functionality
    const loginButton = document.getElementById('loginButton');
    const usernameInput = document.getElementById('usernameInput');

    loginButton.addEventListener('click', function() {
        const enteredUsername = usernameInput.value.trim();
        if (enteredUsername) {
            authenticateUser(enteredUsername)
                .then(result => {
                    if (result.success) {
                        username = result.username;
                        isAdmin = result.isAdmin;
                        localStorage.setItem('username', username);
                        localStorage.setItem('isAdmin', isAdmin);

                        loginModal.style.display = 'none';
                        updateUserInfo(username, isAdmin);

                        // Initialize UI based on user type
                        initializeUserInterface(isAdmin);
                    } else {
                        alert('Authentication failed. Please try again.');
                    }
                })
                .catch(error => {
                    console.error('Authentication error:', error);
                    alert('Authentication failed. Please try again.');
                });
        }
    });

    // Allow pressing Enter to login
    usernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginButton.click();
        }
    });

    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesContainer = document.getElementById('messages');
    const newChatBtn = document.getElementById('newChatBtn');
    const fileInput = document.getElementById('fileInput');
    const fileUploadButton = document.getElementById('fileUploadButton');

    console.log("Элементы DOM:", {
        messageInput: messageInput,
        sendButton: sendButton,
        messagesContainer: messagesContainer,
        newChatBtn: newChatBtn,
        fileInput: fileInput,
        fileUploadButton: fileUploadButton
    });

    // Set initial button text
    sendButton.textContent = "Отправить";

    // Function to authenticate user with server
    function authenticateUser(username) {
        return fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: username })
        })
        .then(response => response.json());
    }

    // Initialize UI based on user type (admin or regular user)
    function initializeUserInterface(isAdminUser) {
        // Generate a unique user ID if it doesn't exist
        if (!localStorage.getItem('userId')) {
            const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('userId', userId);
        }

        if (isAdminUser) {
            // Admin-specific initialization
            initializeAdminInterface();
        } else {
            // Regular user initialization
            initializeRegularUserInterface();
        }
    }

    // Update user info in the sidebar
    function updateUserInfo(username, isAdminUser) {
        const userInfoElement = document.querySelector('.user-info p');
        if (userInfoElement) {
            if (isAdminUser) {
                userInfoElement.textContent = username + " (Админ)";
            } else {
                userInfoElement.textContent = username;
            }
        }

        // Update placeholder in message input
        if (isAdminUser) {
            messageInput.placeholder = "Введите ответ для пользователей...";
        } else {
            messageInput.placeholder = `Напишите ваше сообщение, ${username}...`;
        }
    }

    // Admin-specific interface initialization
    function initializeAdminInterface() {
        console.log("Initializing admin interface");
        messageInput.placeholder = "Введите ответ для пользователей...";

        // Update UI for admin
        const userInfoElement = document.querySelector('.user-info p');
        if (userInfoElement) {
            userInfoElement.textContent = username + " (Админ)";
        }

        // Show admin panel - Remove 'hidden' class instead of using inline style
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) {
            adminPanel.classList.remove('hidden');
            console.log("Admin panel shown");
        } else {
            console.log("Admin panel element not found!");
        }

        // Add admin-specific functionality
        setupAdminFunctionality();
    }

    // Regular user interface initialization
    function initializeRegularUserInterface() {
        console.log("Initializing regular user interface");
        // Set placeholder with username if available
        messageInput.placeholder = username ? `Напишите ваше сообщение, ${username}...` : "Напишите ваше сообщение...";

        // Hide admin panel for regular users - Add 'hidden' class instead of using inline style
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) {
            adminPanel.classList.add('hidden');
            console.log("Admin panel hidden for regular user");
        } else {
            console.log("Admin panel element not found!");
        }

        // Start checking for admin responses (for regular users only)
        if (!isAdmin) {
            checkForAdminResponses();
            // Check for admin responses every 3 seconds
            setInterval(checkForAdminResponses, 3000);
        }

        // Check if user is returning (has interacted before) and hide welcome message accordingly
        const hasVisitedBefore = localStorage.getItem('hasVisitedBefore');

        // If user has visited before, remove the default welcome message to avoid duplication
        if (hasVisitedBefore === 'true') {
            const defaultWelcome = document.querySelector('.message.bot-message p');
            if (defaultWelcome && defaultWelcome.textContent === 'Привет! Я NeuroAI - лучшая нейросеть. Задайте мне любой вопрос, и я постараюсь ответить на него.') {
                defaultWelcome.parentElement.parentElement.remove();
            }
        } else {
            // First visit: mark that the user has visited
            localStorage.setItem('hasVisitedBefore', 'true');
        }
    }

    // Setup admin-specific functionality
    function setupAdminFunctionality() {
        // Load and display pending messages for admin
        loadPendingMessages();

        // Set up periodic checking for new messages
        setInterval(loadPendingMessages, 5000); // Check every 5 seconds

        console.log("Admin functionality set up");
    }

    // Load and display pending messages for admin
    function loadPendingMessages() {
        fetch('/api/pending-messages')
            .then(response => response.json())
            .then(messages => {
                const pendingMessagesContainer = document.getElementById('pendingMessages');
                if (!pendingMessagesContainer) return;

                // Clear current messages
                pendingMessagesContainer.innerHTML = '';

                if (messages.length === 0) {
                    pendingMessagesContainer.innerHTML = '<p style="color: #8e8ea0; font-size: 13px; padding: 10px;">Нет новых сообщений от пользователей</p>';
                    return;
                }

                // Add each pending message
                messages.forEach(message => {
                    const messageElement = document.createElement('div');
                    messageElement.classList.add('pending-message');

                    // Create message text that includes file count if there are files
                    let messageText = message.message;
                    if (message.files && message.files.length > 0) {
                        messageText += ` (Файлов: ${message.files.length})`;
                    }

                    messageElement.innerHTML = `
                        <div><strong>${message.username}</strong></div>
                        <div style="font-size: 11px; margin-top: 3px;">${messageText.substring(0, 60)}${messageText.length > 60 ? '...' : ''}</div>
                        <div style="font-size: 10px; margin-top: 3px; color: #8e8ea0;">${new Date(message.timestamp).toLocaleString()}</div>
                    `;

                    // When clicked, add the message to the chat for admin to respond
                    messageElement.addEventListener('click', () => {
                        // Add the user's message to the chat
                        addMessageToChat(`${message.username}: ${message.message}`, 'user');

                        // If there are files, add them to the chat as well
                        if (message.files && message.files.length > 0) {
                            message.files.forEach(file => {
                                addFileToChat(file, 'user');
                            });
                        }

                        // Focus on input for admin to respond
                        messageInput.focus();
                        messageInput.placeholder = `Ответить пользователю ${message.username}...`;

                        // Store the message ID and user ID in temporary variables for later use when sending response
                        messageInput.dataset.respondingToMessageId = message.id;
                        messageInput.dataset.targetUserId = message.userId; // Store target user ID
                    });

                    pendingMessagesContainer.appendChild(messageElement);
                });
            })
            .catch(error => {
                console.error('Error loading pending messages:', error);
            });
    }

    // Auto-resize textarea as user types
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Send message when pressing Enter (but allow Shift+Enter for new lines)
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            console.log("Нажат Enter, вызов sendMessage");
            sendMessage();
        }
    });

    // Add click event listener to send button
    sendButton.addEventListener('click', function() {
        console.log("Кнопка отправки нажата, вызов sendMessage");
        sendMessage();
    });

    // File upload button functionality
    fileUploadButton.addEventListener('click', function(e) {
        e.preventDefault();
        fileInput.click();
    });

    // Handle file selection
    fileInput.addEventListener('change', function() {
        const files = Array.from(this.files);
        if (files.length > 0) {
            displayFilePreviews(files);
        }
    });

    // New chat button functionality
    newChatBtn.addEventListener('click', function() {
        // Clear the chat
        messagesContainer.innerHTML = `
            <div class="message bot-message">
                <div class="message-content">
                    <p>Привет! Я NeuroAI - лучшая нейросеть. Задайте мне любой вопрос, и я постараюсь ответить на него.</p>
                </div>
            </div>
        `;
        messageInput.value = '';
        messageInput.style.height = 'auto';
    });

    // Function to send messages to the server
    // Handles both regular messages and admin responses to specific user queries
    function sendMessage() {
        console.log("Функция sendMessage вызвана");
        const message = messageInput.value.trim();
        const files = fileInput.files;

        console.log("Сообщение:", message, "Файлов:", files.length);
        console.log("isAdmin:", isAdmin, "respondingToMessageId:", messageInput.dataset.respondingToMessageId);

        // Check if there's a message or files to send
        if (message || files.length > 0) {
            console.log("Сообщение или файлы присутствуют, отправка");

            // If this is an admin responding to a specific user message
            if (isAdmin && messageInput.dataset.respondingToMessageId) {
                console.log("Отправка ответа администратора");
                // Add the admin's response to the chat
                addMessageToChat(message, 'admin');

                // Send the response with files to the server
                sendToServerWithFiles(message, files, messageInput.dataset.targetUserId)
                    .then(() => {
                        console.log("Админ ответ успешно отправлен");
                        // After sending response, mark the original message as responded
                        const originalMessageId = messageInput.dataset.respondingToMessageId;
                        if (originalMessageId) {
                            markMessageAsResponded(originalMessageId);
                        }
                    })
                    .catch(error => {
                        console.error('Error sending admin response:', error);
                        addMessageToChat('Ошибка при отправке сообщения. Пожалуйста, попробуйте еще раз.', 'bot');
                    });

                // Clear the responding-to ID and files
                delete messageInput.dataset.respondingToMessageId;
                delete messageInput.dataset.targetUserId;
                fileInput.value = ''; // Clear file input
                clearFilePreviews(); // Clear file previews

                // Reset placeholder
                messageInput.placeholder = "Введите ответ для пользователей...";
            } else {
                console.log("Отправка сообщения обычного пользователя или общего сообщения админа");
                // Regular user sending a message or admin sending a general message
                addMessageToChat(message, isAdmin ? 'admin' : 'user');

                // Send message with files to server
                sendToServerWithFiles(message, files)
                    .then(() => {
                        console.log("Сообщение успешно отправлено");
                    })
                    .catch(error => {
                        console.error('Error sending message:', error);
                        addMessageToChat('Ошибка при отправке сообщения. Пожалуйста, попробуйте еще раз.', 'bot');

                        // Remove the locally added message since the server request failed
                        const messages = document.querySelectorAll('.message');
                        if (messages.length > 0) {
                            messages[messages.length - 1].remove();
                        }
                    });

                // If this is a regular user, show waiting message
                if (!isAdmin) {
                    showWaitingMessage();
                }
            }

            // Clear input
            messageInput.value = '';
            messageInput.style.height = 'auto';
            fileInput.value = ''; // Clear file input
            clearFilePreviews(); // Clear file previews
        } else {
            console.log("Сообщение и файлы отсутствуют");
        }
    }

    // Function to display file previews in the chat interface
    // Creates preview elements for images or generic icons for other file types
    function displayFilePreviews(files) {
        // Create or update file preview container
        let previewContainer = document.querySelector('.file-preview-container');
        if (!previewContainer) {
            previewContainer = document.createElement('div');
            previewContainer.className = 'file-preview-container';

            // Insert after the textarea
            const inputContainer = document.querySelector('.input-container');
            inputContainer.insertBefore(previewContainer, sendButton);
        } else {
            // Clear existing previews
            previewContainer.innerHTML = '';
        }

        files.forEach(file => {
            const filePreview = document.createElement('div');
            filePreview.className = 'file-preview-item';

            // Check if file is an image
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.title = file.name;

                // Create object URL for preview
                const objectUrl = URL.createObjectURL(file);
                img.src = objectUrl;

                // Revoke object URL after loading to free memory
                img.onload = () => URL.revokeObjectURL(objectUrl);

                filePreview.appendChild(img);
            } else {
                // For non-image files, show a generic icon
                const fileIcon = document.createElement('div');
                fileIcon.className = 'file-icon';
                fileIcon.textContent = '📄'; // Generic file icon
                fileIcon.title = file.name;
                filePreview.appendChild(fileIcon);
            }

            // Add file name
            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name;
            filePreview.appendChild(fileName);

            previewContainer.appendChild(filePreview);
        });
    }

    function clearFilePreviews() {
        const previewContainer = document.querySelector('.file-preview-container');
        if (previewContainer) {
            previewContainer.remove();
        }
    }

    function sendToServerWithFiles(message, files, targetUserId = null) {
        const userId = localStorage.getItem('userId') || 'current_user';
        const username = localStorage.getItem('username');
        const isAdmin = localStorage.getItem('isAdmin') === 'true';

        console.log("Отправка сообщения с файлами на сервер:", message, files.length, "файлов");
        console.log("userId:", userId, "username:", username, "isAdmin:", isAdmin);

        // Create FormData to send files
        const formData = new FormData();

        // Add message text
        if (message) {
            formData.append('message', message);
        }

        // Add user info
        formData.append('userId', userId);
        formData.append('username', username);
        formData.append('isAdmin', isAdmin);

        // Add targetUserId if provided (for admin responses)
        if (targetUserId) {
            formData.append('targetUserId', targetUserId);
        }

        // Add files
        Array.from(files).forEach((file, index) => {
            formData.append(`file_${index}`, file);
        });

        console.log("FormData создан, отправляем запрос");

        return fetch('/api/message-with-files', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            console.log("Получен ответ от сервера при отправке файлов:", response.status);
            return response.json();
        })
        .then(data => {
            console.log('Сообщение с файлами отправлено на сервер:', data);

            // If admin, add a confirmation message
            if (isAdmin && (data.status === 'admin message received' || data.status === 'admin response sent')) {
                addMessageToChat('Ваше сообщение с файлами отправлено.', 'bot');
            }
            return data;
        })
        .catch(error => {
            console.error('Ошибка при отправке сообщения с файлами:', error);
            // Пробросим ошибку дальше, чтобы она была обработана в вызывающей функции
            throw error;
        });
    }

    function showWaitingMessage() {
        // Show message indicating that admin will respond
        const waitingDiv = document.createElement('div');
        waitingDiv.classList.add('message', 'bot-message');
        waitingDiv.id = 'waiting-message';

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        contentDiv.textContent = 'Генерируется ответ на ваш запрос. Это обычно занимает от 2 до 5 минут.';

        waitingDiv.appendChild(contentDiv);
        messagesContainer.appendChild(waitingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Save chat history after adding waiting message
        saveChatHistory();
    }

    function addMessageToChat(text, sender, responseId = null) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');

        // Apply different classes based on sender type
        if (sender === 'user') {
            messageDiv.classList.add('user-message');
        } else if (sender === 'admin') {
            messageDiv.classList.add('admin-message'); // Different style for admin messages
        } else {
            messageDiv.classList.add('bot-message');
        }

        // Add response ID as data attribute if provided
        if (responseId) {
            messageDiv.setAttribute('data-response-id', responseId);
        }

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        contentDiv.textContent = text;

        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Save chat history after adding a message
        saveChatHistory();
    }

    function addFileToChat(file, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'file-message');

        // Apply different classes based on sender type
        if (sender === 'user') {
            messageDiv.classList.add('user-message');
        } else if (sender === 'admin') {
            messageDiv.classList.add('admin-message');
        } else {
            messageDiv.classList.add('bot-message');
        }

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content', 'file-content');

        // Determine if it's an image file
        const fileExtension = file.originalname ? file.originalname.split('.').pop().toLowerCase() : '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension);

        if (isImage) {
            // Show image preview
            const img = document.createElement('img');
            img.src = `/uploads/${file.filename}`;
            img.alt = file.originalname;
            img.style.maxWidth = '150px';
            img.style.maxHeight = '150px';
            img.style.borderRadius = '4px';
            img.style.objectFit = 'cover';
            contentDiv.appendChild(img);
        } else {
            // Show file icon and name for non-image files
            const fileIcon = document.createElement('div');
            fileIcon.style.fontSize = '24px';
            fileIcon.style.marginBottom = '5px';
            fileIcon.textContent = '📄';
            contentDiv.appendChild(fileIcon);
        }

        // Add file name
        const fileName = document.createElement('div');
        fileName.style.textAlign = 'center';
        fileName.style.fontSize = '12px';
        fileName.style.wordBreak = 'break-all';
        fileName.textContent = file.originalname;
        contentDiv.appendChild(fileName);

        // Add download link
        const downloadLink = document.createElement('a');
        downloadLink.href = `/uploads/${file.filename}`;
        downloadLink.textContent = 'Скачать';
        downloadLink.target = '_blank';
        downloadLink.style.display = 'block';
        downloadLink.style.textAlign = 'center';
        downloadLink.style.marginTop = '5px';
        downloadLink.style.color = '#6b6b6b';
        downloadLink.style.textDecoration = 'underline';
        downloadLink.style.fontSize = '11px';
        contentDiv.appendChild(downloadLink);

        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Save chat history after adding a file
        saveChatHistory();
    }

    // Function to send message to server
    function sendToServer(message, targetUserId = null) {
        console.log("Отправка сообщения на сервер:", message);
        const userId = localStorage.getItem('userId') || 'current_user';
        console.log("Username:", username, "Is Admin:", isAdmin);
        return fetch('/api/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                userId: userId,
                username: username,
                targetUserId: targetUserId // Send target user ID for admin responses
            })
        })
        .then(response => {
            console.log("Получен ответ от сервера:", response);
            return response.json();
        })
        .then(data => {
            console.log('Сообщение отправлено на сервер:', data);

            // If admin, add a confirmation message
            if (isAdmin && (data.status === 'admin message received' || data.status === 'admin response sent')) {
                addMessageToChat('Ваш ответ отправлен.', 'bot');
            }
            return data;
        })
        .catch(error => {
            console.error('Ошибка при отправке сообщения:', error);
        });
    }

    // Function to mark a message as responded by admin
    function markMessageAsResponded(messageId) {
        fetch('/api/mark-responded', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messageId: messageId
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Message marked as responded:', data);
            // Refresh the pending messages list
            loadPendingMessages();
        })
        .catch(error => {
            console.error('Error marking message as responded:', error);
        });
    }

    // Function to check for admin responses (for regular users)
    // NOTE: This is a polling implementation, consider using WebSockets for real-time communication
    function checkForAdminResponses() {
        // Only regular users should check for admin responses
        if (isAdmin) return;

        const userId = localStorage.getItem('userId') || 'current_user';

        fetch(`/api/user-response?userId=${userId}`)
            .then(response => response.json())
            .then(data => {
                if (data.responses && data.responses.length > 0) {
                    // Process each admin response
                    data.responses.forEach(response => {
                        // Check if this response was already displayed to avoid duplicates
                        if (!document.querySelector(`[data-response-id="${response.id}"]`)) {
                            // Remove the waiting message before adding the admin response
                            const waitingMessage = document.getElementById('waiting-message');
                            if (waitingMessage) {
                                waitingMessage.remove();
                                // Save chat history after removing waiting message
                                saveChatHistory();
                            }

                            // Add the admin response to the chat
                            addMessageToChat(response.response, 'bot', response.id);

                            // If the admin response includes files, add file info to the chat
                            if (response.files && response.files.length > 0) {
                                response.files.forEach(file => {
                                    addFileToChat(file, 'bot');
                                });
                            }
                        }
                    });
                }
            })
            .catch(error => {
                console.error('Error checking for admin responses:', error);
            });
    }

    // Function to update user info in the sidebar
    function updateUserInfo(username, isAdminUser) {
        const userInfoElement = document.querySelector('.user-info p');
        if (userInfoElement) {
            if (isAdminUser) {
                userInfoElement.textContent = username + " (Админ)";
            } else {
                userInfoElement.textContent = username;
            }
        }

        // Update placeholder in message input
        if (isAdminUser) {
            messageInput.placeholder = "Введите ответ для пользователей...";
        } else {
            messageInput.placeholder = `Напишите ваше сообщение, ${username}...`;
        }
    }

    // Save chat messages to localStorage
    function saveChatHistory() {
        const messagesContainer = document.getElementById('messages');
        const messages = [];

        // Get all messages from the chat container
        const messageElements = messagesContainer.querySelectorAll('.message');

        messageElements.forEach(messageEl => {
            const contentEl = messageEl.querySelector('.message-content');
            const content = contentEl ? contentEl.textContent : '';

            // Get message type from class
            let type = 'bot';
            if (messageEl.classList.contains('user-message')) {
                type = 'user';
            } else if (messageEl.classList.contains('admin-message')) {
                type = 'admin';
            }

            // Get response ID if it exists
            const responseId = messageEl.getAttribute('data-response-id');

            // Get file information if it's a file message
            const fileContent = messageEl.querySelector('.file-content');
            let fileData = null;

            if (fileContent) {
                const img = fileContent.querySelector('img');
                const fileName = fileContent.querySelector('.file-name');
                const downloadLink = fileContent.querySelector('a');

                if (img || fileName) {
                    fileData = {
                        type: img ? 'image' : 'file',
                        src: img ? img.src : null,
                        alt: img ? img.alt : null,
                        originalname: fileName ? fileName.textContent : null,
                        downloadUrl: downloadLink ? downloadLink.href : null
                    };
                }
            }

            messages.push({
                type: type,
                content: content,
                responseId: responseId,
                fileData: fileData
            });
        });

        // Save to localStorage
        try {
            localStorage.setItem('chatHistory', JSON.stringify(messages));
        } catch (e) {
            console.error('Error saving chat history:', e);
        }
    }

    // Restore chat messages from localStorage
    function restoreChatHistory() {
        try {
            const chatHistoryJSON = localStorage.getItem('chatHistory');
            if (!chatHistoryJSON) {
                // If no chat history exists, add the default welcome message only if it's the first visit
                if (!localStorage.getItem('hasVisitedBefore')) {
                    addDefaultWelcomeMessage();
                    localStorage.setItem('hasVisitedBefore', 'true');
                }
                return;
            }

            const messages = JSON.parse(chatHistoryJSON);

            // Clear existing messages
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = '';

            // Add all saved messages back to the chat
            messages.forEach(msg => {
                if (msg.fileData) {
                    // Add file message
                    const fileObj = {
                        originalname: msg.fileData.originalname,
                        filename: msg.fileData.src ? msg.fileData.src.split('/').pop() : null
                    };
                    addFileToChat(fileObj, msg.type);
                } else {
                    // Add regular message
                    addMessageToChat(msg.content, msg.type, msg.responseId);
                }
            });
        } catch (e) {
            console.error('Error restoring chat history:', e);
            // If there's an error restoring, add the default welcome message
            addDefaultWelcomeMessage();
        }
    }

    // Add default welcome message for new users
    function addDefaultWelcomeMessage() {
        const messagesContainer = document.getElementById('messages');
        if (messagesContainer) {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', 'bot-message');

            const contentDiv = document.createElement('div');
            contentDiv.classList.add('message-content');
            contentDiv.innerHTML = '<p>Привет! Я NeuroAI - лучшая нейросеть. Задайте мне любой вопрос, и я постараюсь ответить на него.</p>';

            messageDiv.appendChild(contentDiv);
            messagesContainer.appendChild(messageDiv);
        }
    }

    // New chat button functionality
    newChatBtn.addEventListener('click', function() {
        // Clear the chat
        messagesContainer.innerHTML = `
            <div class="message bot-message">
                <div class="message-content">
                    <p>Привет! Я NeuroAI - лучшая нейросеть. Задайте мне любой вопрос, и я постараюсь ответить на него.</p>
                </div>
            </div>
        `;
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // Clear chat history in localStorage
        try {
            localStorage.removeItem('chatHistory');
        } catch (e) {
            console.error('Error clearing chat history:', e);
        }
    });
});