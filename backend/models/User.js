const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Define Schema
const userSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true,
        trim: true
    },
    email:{
        type: String,
        required: true,
        unique: true, 
        lowercase: true
    },
    password:{
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        enum: ['student', 'professor', 'admin'],
        default: 'student'
    }

});

// Pre-save: hash password before saving  
/* not required becase we are hashing pw manually in the registerUser  --> Otherwise it'll double hash it, and bcrypt.compare() will fail. */
/* userSchema.pre('save', async function (next) {
    if(!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
}); */

module.exports = mongoose.model('User', userSchema);