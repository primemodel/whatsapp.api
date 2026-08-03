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
            '--disable-extensions'
        ]
    }
});

client.on('qr', (qr) => {
    if (!isClientReady) {
        console.log('Novo QR Code gerado.');
        qrCodeData = qr;
    }
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
        client.initialize();
    }, 5000);
});

client.initialize();

app.get('/', async (req, res) => {
    if (isClientReady) {
        return res.send(`
            <div style="text-align:center; margin-top:50px; font-family: sans-serif;">
                <h1 style="color: #25D366;">✔ WhatsApp Conectado no Notebook!</h1>
                <p>A API local está ativa e funcionando perfeitamente.</p>
            </div>
        `);
    }

    if (!qrCodeData && !isClientReady) {
        return res.send(`
            <div style="text-align:center; margin-top:50px; font-family: sans-serif;">
                <h2 style="color: #e67e22;">Iniciando o navegador... Aguarde e atualize.</h2>
            </div>
        `);
    }
    
    try {
        const urlImage = await qrcode.toDataURL(qrCodeData);
        res.send(`
            <div style="text-align:center; margin-top:50px; font-family: sans-serif;">
                <h2>Escaneie o QR Code abaixo com o WhatsApp</h2>
                <img src="${urlImage}" alt="QR Code WhatsApp"/>
            </div>
        `);
    } catch (err) {
        res.status(500).send('Erro ao gerar a imagem do QR Code.');
    }
});

app.post('/verificar', async (req, res) => {
    const { telefone } = req.body;

    if (!isClientReady) {
        return res.status(400).json({ status: false, mensagem: 'WhatsApp ainda não está conectado.' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando localmente na porta ${PORT}`);
});
