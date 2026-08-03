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
    authStrategy: new LocalAuth(),
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
            '--no-zygote'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('Novo QR Code gerado.');
    qrCodeData = qr;
});

client.on('ready', () => {
    console.log('WhatsApp conectado com sucesso!');
    isClientReady = true;
    qrCodeData = '';
});

client.on('auth_failure', (msg) => {
    console.error('Falha na autenticação:', msg);
    isClientReady = false;
});

client.initialize();

app.get('/', async (req, res) => {
    if (isClientReady) {
        return res.send('<h1>WhatsApp já está conectado e pronto para uso!</h1>');
    }
    if (!qrCodeData) {
        return res.send('<h1>Gerando QR Code, aguarde alguns segundos e atualize a página...</h1>');
    }
    
    try {
        const urlImage = await qrcode.toDataURL(qrCodeData);
        res.send(`
            <div style="text-align:center; margin-top:50px;">
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
        return res.status(400).json({ status: false, mensagem: 'Número de telefone não informado.' });
    }

    try {
        const numeroLimpo = telefone.replace(/\D/g, '');
        const chatId = `55${numeroLimpo}@c.us`;

        const registered = await client.isRegisteredUser(chatId);
        if (registered) {
            return res.json({ status: false, mensagem: 'Número possui WhatsApp válido.' });
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
