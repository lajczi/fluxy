module.exports = {
  apps: [
    {
      name: 'fluxer-mod-bot',
      script: 'build/index.js',
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 50,
      min_uptime: '30s',
      watch: false,
      max_memory_restart: '1024M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/bot-error.log',
      out_file: 'logs/bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
