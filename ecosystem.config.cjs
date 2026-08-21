// PM2 ecosystem config for Nalik Academy
// Usage: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: "nalik-academy",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/nalik-academy",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/nalik-academy/error.log",
      out_file: "/var/log/nalik-academy/out.log",
      merge_logs: true,
      // Graceful restart
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
