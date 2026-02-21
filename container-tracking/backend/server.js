require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');
const containerRoutes = require('./src/routes/containerRoutes');
const iotRoutes = require('./src/routes/iotRoutes');
const receiverRoutes = require('./src/routes/receiverRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
require('./socket').init(server);

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/containers', containerRoutes);
app.use('/iot', iotRoutes);
app.use('/receiver', receiverRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Backend Server running on port ${PORT}`));
