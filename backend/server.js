const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");                // Allow cross-origin requests
const dotenv = require("dotenv");               // Load .env variables
const authRoutes = require("./routes/authRoutes");
const thesisRoutes = require("./routes/thesisRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const importRoutes = require("./routes/importRoutes");
const semesterRoutes = require("./routes/semesterRoutes");
const backupRoutes = require("./routes/backupRoutes");
const manualPlanRoutes = require("./routes/manualPlanRoutes");


dotenv.config();

const app = express();                        // create express app
const PORT = process.env.PORT || 5000;        // Use .env or fallback to 5000

app.use(cors());        // enable cors
app.use(express.json());            // Parse incoming json

app.get('/', (req, res) => {
    res.send('Thesis Manager API is running...');
});

app.use('/api', authRoutes);
app.use('/api', thesisRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', importRoutes);
app.use('/api', semesterRoutes);
app.use('/api', backupRoutes);
app.use('/api', manualPlanRoutes);


// Connect to Mongoose and start server                             // process.env.MONGO_URI -> 
mongoose.connect(process.env.MONGO_URI, {
    // useNewUrlParser: true,
    // useUnifiedTopology: true
}).then(() => {
    console.log("Connected to MongoDB");
})
    .catch((err) => console.log(`MongoDB error: ${err}`));

// Drop any legacy manualplans index that is not the single-field unique
// semester index, so that exactly one plan per semester is enforced. (An
// intermediate deploy used a compound unique index on (semester, courseCode)
// that would block the new all-course plan layout.)
mongoose.connection.on('open', async () => {
    try {
        const col = mongoose.connection.collection('manualplans');
        const indexes = await col.indexes();
        for (const idx of indexes) {
            if (idx.name === '_id_') continue;
            const keys = Object.keys(idx.key || {});
            if (keys.length !== 1 || keys[0] !== 'semester' || !idx.unique) {
                await col.dropIndex(idx.name);
                console.log(`Dropped legacy manualplans index: ${idx.name}`);
            }
        }
    } catch (e) {
        // Collection may not exist yet; ignore.
    }
});

app.listen(PORT || 5000, () => console.log(`Server Running on port ${PORT}`));