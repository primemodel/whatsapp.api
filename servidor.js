process.env.PUPPETEER_CACHE_DIR = '/opt/render/project/src/.cache/puppeteer';

process.on('uncaughtException', (err) => {
    console.error('ERRO NÃO CAPTURADO:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('REJEIÇÃO NÃO TRATADA:', reason);
});

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
        executablePath: '/opt/render/project/src/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome',
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
            '--disable-web-security'
        ]
    }
});

client.on('qr', (qr) => {
    if (!isClientReady) {
        console.log('Novo QR Code gerado.');
        qrCodeData = qr;
    }
});

// Força a limpeza imediata assim que autentica no celular
client.on('authenticated', () => {
    console.log('WhatsApp autenticado com sucesso!');
    qrCodeData = ''; // Limpa o QR Code imediatamente para sumir da tela
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
        client.initialize();
    }, 5000);
});

client.initialize();

app.get('/', async (req, res) => {
    if (isClientReady) {
        return res.send(`
            <div style="text-align:center; margin-top:50px; font-family: sans-serif;">
                <h1 style="color: #25D366;">✔ WhatsApp Conectado e Pronto para Uso!</h1>
                <p>A API já está ativa e integrada ao seu site.</p>
            </div>
        `);
    }

    // Se autenticou mas ainda está carregando o ready
    if (!qrCodeData && !isClientReady) {
        return res.send(`
            <div style="text-align:center; margin-top:50px; font-family: sans-serif;">
                <h2 style="color: #e67e22;">Dispositivo conectado! Carregando dados da sessão...</h2>
                <p>Atualize esta página em 10 segundos.</p>
            </div>
        `);
    }
    
    try {
        const urlImage = await qrcode.toDataURL(qrCodeData);
        res.send(`
            <div style="text-align:center; margin-top:50px; font-family: sans-serif;">
                <h2>Escaneie o QR Code abaixo com o WhatsApp</h2>
                <img src="${urlImage}" alt="QR Code WhatsApp"/>
                <p style="margin-top:20px; color: #666;">Após escanear, atualize esta página.</p>
            </div>
        `);
    } catch (err) {
        res.status(500).send('Erro ao gerar a imagem do QR Code.');
    }
});

app.post('/verificar', async (req, res) => {
    const { telefone } = req.body;

    if (!isClientReady) {
        return res.status(400).json({ status: false, mensagem: 'WhatsApp ainda não está conectado no servidor.' });
    }

    if (!telefone) {
        return res.status(400).json({ status: false, mensagem: 'Número de telefone não informado.' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
