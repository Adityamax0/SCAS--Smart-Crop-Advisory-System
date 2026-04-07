module.exports = {
  apps: [
    {
      name: "scas-backend",
      script: "./server.js",
      instances: 1, // Single instance: Socket.io cluster mode requires Redis adapter (@socket.io/redis-adapter) for multi-process room sync
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
