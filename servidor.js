const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'prime-session'
    }),
    puppeteer: {
        headless: true, // No Render deve ser true
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/opt/render/project/src/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome',
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
