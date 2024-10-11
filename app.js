const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const onlineUsers = new Set();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true,
}));

app.set('view engine', 'html');
app.use(express.static('views'));

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('A user connected');

    // Send online users to the new connection
    socket.emit('updateUserList', Array.from(onlineUsers));

    // Handle user logout
    socket.on('logout', (username) => {
        onlineUsers.delete(username); // Remove user from online users
        io.emit('updateUserList', Array.from(onlineUsers)); // Emit updated user list
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/views/login.html');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            return res.status(500).send('Server error');
        }
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).send('Invalid username or password');
        }
        req.session.userId = user.id;
        req.session.username = user.username; // Store username in session
        req.session.userRole = user.role; // Store the role in the session
        onlineUsers.add(user.username); // Add user to online users
        
        // Emit updated user list to all connected clients
        io.emit('updateUserList', Array.from(onlineUsers));
        
        res.redirect('/hub');
    });
});

app.get('/hub', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('You must log in first');
    }
    res.send(`
        <h1>Welcome to the Hub</h1>
        <p>Your role: ${req.session.userRole}</p>
        <div style="display: flex; justify-content: space-between;">
            <div style="flex: 1; padding-right: 20px;">
                <form action="/logout" method="POST">
                    <button type="submit">Logout</button>
                </form>
                ${req.session.userRole === 'admin' ? `
                    <h2>Admin Actions</h2>
                    <form action="/add-account" method="GET">
                        <button type="submit">Add Account</button>
                    </form>
                ` : ''}
                <h2>Other Actions</h2>
                <button onclick="alert('Feature coming soon!')">Feature 1</button>
                <button onclick="alert('Feature coming soon!')">Feature 2</button>
            </div>
            <div style="width: 200px;">
                <p>Online Users:</p>
                <ul id="userList" style="list-style-type: none; padding: 0;"></ul>
            </div>
        </div>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();

            // Emit logout event when the user is about to close the tab or navigate away
            window.addEventListener('beforeunload', () => {
                socket.emit('logout', '${req.session.username}');
            });

            socket.on('updateUserList', function(users) {
                const userListElement = document.getElementById('userList');
                userListElement.innerHTML = '';
                users.forEach(user => {
                    const li = document.createElement('li');
                    li.innerHTML = '<span style="color: green;">&#9679;</span> ' + user; // Green dot
                    userListElement.appendChild(li);
                });
            });
        </script>
    `);
});

app.post('/logout', (req, res) => {
    onlineUsers.delete(req.session.username); // Remove user from online users
    io.emit('updateUserList', Array.from(onlineUsers)); // Emit updated user list
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Logout failed');
        }
        res.redirect('/login');
    });
});

// Add account functionality remains unchanged
app.get('/add-account', (req, res) => {
    if (!req.session.userId || req.session.userRole !== 'admin') {
        return res.status(401).send('Access denied');
    }
    res.send(`
        <h1>Add Account</h1>
        <form action="/create-account" method="POST">
            <div>
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div>
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            <div>
                <label for="role">Role:</label>
                <select id="role" name="role">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
            <button type="submit">Create Account</button>
        </form>
    `);
});

app.post('/create-account', (req, res) => {
    const { username, password, role } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [username, hashedPassword, role], function(err) {
        if (err) {
            return res.status(500).send('Error creating account');
        }
        res.redirect('/hub');
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
