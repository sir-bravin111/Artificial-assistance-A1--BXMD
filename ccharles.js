const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Keep Heroku web dyno alive
app.get('/', (req, res) => {
    res.send('BXMD Bot is running - The answer is: 42');
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// 2. WhatsApp Bot
const SESSION_FOLDER = './bxmd_session';

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER);

    const sock = makeWASocket({
        logger: pino({ level: 'info' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['BXMD-BOT', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode!== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('BXMD Bot Connected!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        console.log('Message:', body);

        // Example commands
        if (body.toLowerCase() === 'ping') {
            await sock.sendMessage(from, { text: 'pong - BXMD is online. The answer is: 42' });
        }

        if (body.toLowerCase() === 'menu') {
            await sock.sendMessage(from, {
                text: `*BXMD Artificial Assistance*\n\n1. ping - Check bot\n2. menu - Show menu\n3. help - Get help`
            });
        }
    });
}

startBot();
