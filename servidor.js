const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
app.use(express.json());

let qrCodeData = '';
let isClientReady = false;

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'prime-session'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process',
            '--disable-extensions',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-features=IsolateOrigins,site-per-process',
            '--aggressive-cache-discard',
            '--disable-cache',
            '--disable-application-cache',
            '--disable-offline-load-stale-cache',
            '--disk-cache-size=0'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('Novo QR Code gerado.');
    qrCodeData = qr;
    isClientReady = false;
});

client.on('authenticated', () => {
    console.log('WhatsApp autenticado com sucesso!');
    qrCodeData = '';
});

client.on('auth_failure', (msg) => {
    console.error('Falha na autenticação:', msg);
    isClientReady = false;
});

client.on('ready', () => {
    console.log('WhatsApp conectado e pronto para uso!');
    isClientReady = true;
    qrCodeData = '';
});

client.on('disconnected', (reason) => {
    console.log('WhatsApp desconectado:', reason);
    isClientReady = false;
    qrCodeData = '';
});

client.initialize();

app.get('/', async (req, res) => {
    if (isClientReady) {
        return res.send(`
            <div style="text-align:center; margin-top:50px; font-family: sans-serif;">
                <h1 style="color: #25D366;">✔ WhatsApp Conectado com Sucesso!</h1>
                <p>A API na nuvem está pronta para receber os disparos do WordPress.</p>
            </div>
        `);
    }

    if (!qrCodeData) {
        return res.send(`
            <div style="text-align:center; margin-top:50px; font-family: sans-serif;">
                <h2 style="color: #e67e22;">Gerando QR Code, aguarde alguns segundos e atualize a página...</h2>
            </div>
        `);
    }
    
    try {
        const urlImage = await qrcode.toDataURL(qrCodeData);
        res.send(`
            <div style="text-align:center; margin-top:50px; font-family: sans-serif;">
                <h2>Escaneie o QR Code abaixo com o seu WhatsApp</h2>
                <img src="${urlImage}" alt="QR Code WhatsApp" style="width:300px; height:300px;"/>
            </div>
        `);
    } catch (err) {
        res.status(500).send('Erro ao gerar a imagem do QR Code.');
    }
});

app.post('/verificar', async (req, res) => {
    const { telefone } = req.body;
    if (!isClientReady) {
        return res.status(400).json({ status: false, mensagem: 'WhatsApp ainda não está conectado na API.' });
    }
    if (!telefone) {
        return res.status(400).json({ status: false, mensagem: 'Número não informado.' });
    }

    try {
        const numeroLimpo = telefone.replace(/\D/g, '');
        const chatId = `55${numeroLimpo}@c.us`;
        const registered = await client.isRegisteredUser(chatId);
        
        if (registered) {
            return res.json({ status: true, mensagem: 'Número possui WhatsApp válido.' });
        } else {
            return res.json({ status: false, mensagem: 'Número não cadastrado no WhatsApp.' });
        }
    } catch (error) {
        console.error('Erro ao verificar número:', error);
        return res.status(500).json({ status: false, mensagem: 'Erro interno ao verificar número.' });
    }
});

app.post('/enviar', async (req, res) => {
    const { telefone, mensagem } = req.body;

    if (!isClientReady) {
        return res.status(400).json({ status: false, erro: 'WhatsApp não está conectado.' });
    }

    if (!telefone || !mensagem) {
        return res.status(400).json({ status: false, erro: 'Telefone ou mensagem ausentes.' });
    }

    try {
        const numeroLimpo = telefone.replace(/\D/g, '');
        const chatId = `55${numeroLimpo}@c.us`;

        await client.sendMessage(chatId, mensagem);
        return res.json({ status: true, sucesso: 'Mensagem enviada com sucesso pelo WhatsApp!' });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        return res.status(500).json({ status: false, erro: 'Erro interno ao enviar mensagem.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
