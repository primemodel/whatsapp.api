const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');

const app = express();

// Libera o CORS para permitir requisições de qualquer painel WordPress
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

let qrCodeData = '';
let isClientReady = false;

process.on('unhandledRejection', (reason, promise) => {
    console.error('Erro não tratado capturado:', reason);
});

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'prime-session'
    }),
    puppeteer: {
        headless: true,
        executablePath: '/opt/render/project/src/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--mute-audio',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-breakpad',
            '--disable-component-extensions-with-background-pages',
            '--disable-features=TranslateUI,BlinkGenPropertyTrees,IsolateOrigins,site-per-process',
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding',
            '--enable-features=NetworkService,NetworkServiceInProcess',
            '--force-color-profile=srgb',
            '--metrics-recording-only',
            '--no-pings'
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
    setTimeout(() => {
        console.log('Tentando reiniciar o cliente do WhatsApp...');
        client.initialize().catch(err => console.error('Erro ao reiniciar:', err));
    }, 5000);
});

client.initialize().catch(err => {
    console.error('Erro fatal ao inicializar o cliente:', err);
});

app.get('/', async (req, res) => {
    if (isClientReady) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"><title>WhatsApp Conectado</title></head>
            <body style="text-align:center; margin-top:50px; font-family: sans-serif;">
                <h1 style="color: #25D366;">✔ WhatsApp Conectado com Sucesso!</h1>
                <p>A API na nuvem está pronta para receber os disparos do WordPress.</p>
            </body>
            </html>
        `);
    }

    if (!qrCodeData) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"><meta http-equiv="refresh" content="3"><title>Aguardando QR Code</title></head>
            <body style="text-align:center; margin-top:50px; font-family: sans-serif;">
                <h2 style="color: #e67e22;">Iniciando o navegador e gerando o QR Code...</h2>
                <p>Isso pode levar alguns segundos. A página atualizará sozinha.</p>
            </body>
            </html>
        `);
    }
    
    try {
        const urlImage = await qrcode.toDataURL(qrCodeData);
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"><meta http-equiv="refresh" content="10"><title>Conectar WhatsApp</title></head>
            <body style="text-align:center; margin-top:50px; font-family: sans-serif;">
                <h2>Escaneie o QR Code abaixo com o seu WhatsApp</h2>
                <img src="${urlImage}" alt="QR Code WhatsApp" style="width:300px; height:300px;"/>
                <p style="color: #666; font-size: 14px; margin-top: 15px;">O QR Code expira rápido. Esta página atualizará sozinha para gerar um novo se necessário.</p>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('Erro ao gerar a imagem do QR Code.');
    }
});

app.get('/qrcode', async (req, res) => {
    if (isClientReady) {
        return res.json({ status: 'conectado', mensagem: 'O WhatsApp já está conectado!' });
    }

    if (!qrCodeData) {
        return res.json({ status: 'gerando', mensagem: 'QR Code ainda está sendo gerado, tente novamente em instantes.' });
    }

    try {
        const urlImage = await qrcode.toDataURL(qrCodeData);
        return res.json({ status: 'qrcode_disponivel', imagem_base64: urlImage });
    } catch (err) {
        return res.status(500).json({ status: 'erro', mensagem: 'Erro ao converter o QR Code.' });
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
