const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./users.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to the users database.');
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT
        )`, () => {
            const defaultUsername = 'admin';
            const defaultPassword = 'admin123'; // Change as needed
            const hashedPassword = bcrypt.hashSync(defaultPassword, 8);
            db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`, [defaultUsername, hashedPassword, 'admin']);
        });
    }
});

module.exports = db;
