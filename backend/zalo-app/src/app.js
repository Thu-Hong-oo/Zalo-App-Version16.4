const path = require('path');

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads'))); 