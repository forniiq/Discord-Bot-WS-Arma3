module.exports = {
    apps: [
        {
            name: 'ws-arma-bot',
            script: './dist/index.js', // Укажите путь к вашему скомпилированному файлу (например, dist/index.js или dist/main.js)
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};