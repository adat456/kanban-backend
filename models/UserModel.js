const mongoose = require("mongoose");
const { isEmail, isAlphanumeric } = require("validator");
const bcrypt = require("bcryptjs");

// only username will be converted to lowercase and must be unique
const UserSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, "Please enter your first name."],
        trim: true,
    },
    lastName: {
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

UserSchema.pre("save", async function(next) {
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

module.exports = mongoose.model("user", UserSchema);