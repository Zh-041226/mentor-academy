module.exports = {
  apps: [{
    name: 'mentor-academy-backend',
    script: './src/server.js',
    cwd: '/var/www/mentor-academy/backend',
    instances: 2,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    restart_delay: 5000,
    kill_timeout: 5000,
    listen_timeout: 10000,
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/mentor-academy/error.log',
    out_file: '/var/log/mentor-academy/out.log',
    log_file: '/var/log/mentor-academy/combined.log',
    time: true
  }]
};
