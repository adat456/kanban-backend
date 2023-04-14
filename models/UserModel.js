const mongoose = require("mongoose");
const { isEmail, isAlphanumeric } = require("validator");

// only username will be converted to lowercase and must be unique
const UserSchema = new mongoose.Schema({
    first_name: {
        type: String,
        required: [true, "Please enter your first name."],
        trim: true,
    },
    last_name: {
        type: String,
        required: [true, "Please enter your last name."],
        trim: true,
    },
    username: {
        type: String,
        required: [true, "Please enter a username."],
        trim: true,
        lowercase: true,
        minLength: [7, "Minimum username length is 7 characters."],
        maxLength: [15, "Maximum username length is 15 characters."],
        validate: [isAlphanumeric, "Username may only contain letters and/or numbers."],
        unique: true,
    },
    password: {
        type: String,
        required: [true, "Please enter a password."],
        trim: true,
    },
    email: {
        type: String,
        required: [true, "Please enter an email address."],
        trim: true,
        validate: [isEmail, "Please enter a valid email address."],
    },
    boards: [{
        type: mongoose.ObjectId,
        ref: "board",
    }]
});

module.exports = mongoose.model("user", UserSchema);